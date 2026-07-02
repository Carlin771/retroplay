import fs from "node:fs/promises";
import path from "node:path";

/**
 * Cache de vídeo em disco, por segmentos de tamanho fixo.
 *
 * Cada capítulo tem uma pasta; cada segmento é um arquivo. Ao servir um trecho,
 * buscamos o segmento no cache; se faltar, baixamos do Telegram e gravamos.
 * Uma política LRU (por data de modificação) remove os segmentos mais antigos
 * quando o cache passa do teto configurado.
 */

const CACHE_DIR = process.env.CACHE_DIR || "./cache";
const MAX_BYTES = Number(
  process.env.CACHE_MAX_BYTES || 150 * 1024 * 1024 * 1024,
);
export const SEGMENT_SIZE = 4 * 1024 * 1024; // 4MB

function segmentPaths(episodeId: string, segIndex: number) {
  // sanitiza o episodeId para uso seguro como nome de pasta
  const safe = episodeId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dir = path.join(CACHE_DIR, safe);
  const file = path.join(dir, `${String(segIndex).padStart(8, "0")}.seg`);
  return { dir, file };
}

async function readSegment(
  episodeId: string,
  segIndex: number,
): Promise<Buffer | null> {
  const { file } = segmentPaths(episodeId, segIndex);
  try {
    const buf = await fs.readFile(file);
    const now = new Date();
    fs.utimes(file, now, now).catch(() => {}); // marca como usado recentemente (LRU)
    return buf;
  } catch {
    return null;
  }
}

async function writeSegment(
  episodeId: string,
  segIndex: number,
  buf: Buffer,
): Promise<void> {
  const { dir, file } = segmentPaths(episodeId, segIndex);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, buf);
  await fs.rename(tmp, file);
  void maybeEvict();
}

/**
 * Retorna o segmento pedido, buscando no cache ou baixando via `fetcher`.
 * `fetcher(offset, length)` deve devolver os bytes do arquivo original.
 */
export async function getSegment(
  episodeId: string,
  segIndex: number,
  fetcher: (offset: number, length: number) => Promise<Buffer>,
): Promise<Buffer> {
  const cached = await readSegment(episodeId, segIndex);
  if (cached) return cached;

  const buf = await fetcher(segIndex * SEGMENT_SIZE, SEGMENT_SIZE);
  if (buf.length > 0) {
    writeSegment(episodeId, segIndex, buf).catch(() => {});
  }
  return buf;
}

// ---- Remoção LRU (throttled) --------------------------------------------

let lastEvict = 0;
let evicting = false;

async function maybeEvict(): Promise<void> {
  const now = Date.now();
  if (evicting || now - lastEvict < 60_000) return;
  evicting = true;
  lastEvict = now;
  try {
    const files: { path: string; size: number; mtime: number }[] = [];

    async function walk(dir: string) {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          await walk(p);
        } else if (e.name.endsWith(".seg")) {
          try {
            const st = await fs.stat(p);
            files.push({ path: p, size: st.size, mtime: st.mtimeMs });
          } catch {
            /* ignore */
          }
        }
      }
    }

    await walk(CACHE_DIR);
    let total = files.reduce((acc, f) => acc + f.size, 0);
    if (total <= MAX_BYTES) return;

    files.sort((a, b) => a.mtime - b.mtime); // mais antigos primeiro
    const target = MAX_BYTES * 0.9;
    for (const f of files) {
      if (total <= target) break;
      try {
        await fs.unlink(f.path);
        total -= f.size;
      } catch {
        /* ignore */
      }
    }
  } finally {
    evicting = false;
  }
}
