export type ByteRange = { start: number; end: number };

/**
 * Interpreta o cabeçalho HTTP Range (ex.: "bytes=1048576-").
 * Retorna o intervalo [start, end] (inclusivo) já limitado ao tamanho do arquivo,
 * ou null se não houver Range válido.
 */
export function parseRange(
  header: string | null,
  size: number,
): ByteRange | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;

  const hasStart = m[1] !== "";
  const hasEnd = m[2] !== "";
  let start: number;
  let end: number;

  if (!hasStart) {
    // sufixo: "bytes=-N" => últimos N bytes
    if (!hasEnd) return null;
    const n = parseInt(m[2], 10);
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = parseInt(m[1], 10);
    end = hasEnd ? parseInt(m[2], 10) : size - 1;
  }

  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  end = Math.min(end, size - 1);
  if (start < 0 || start > end) return null;

  return { start, end };
}
