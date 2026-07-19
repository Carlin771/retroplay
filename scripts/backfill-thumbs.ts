import "dotenv/config";
import { prisma } from "../src/lib/db";
import { fetchMessageThumbnail } from "../src/lib/telegram";

/**
 * Reprocessa as capas (miniaturas) dos capítulos que estão SEM capa.
 *
 * Processa em LOTES para não estourar a memória (a lib do Telegram acumula
 * estado em execuções muito longas). É resumível: cada rodada pega o próximo
 * lote de capítulos ainda sem capa. Rode de novo até dizer "0 restantes".
 *
 * Uso:
 *   npm run backfill:thumbs                -> processa até 1500 por vez
 *   npm run backfill:thumbs -- --limit 800 -> muda o tamanho do lote
 */

const DELAY_MS = 400;

function getLimit(): number {
  const i = process.argv.indexOf("--limit");
  if (i >= 0 && process.argv[i + 1]) {
    const n = parseInt(process.argv[i + 1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 1500;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const LIMIT = getLimit();

  const pending = await prisma.episode.count({ where: { thumbDataUrl: null } });
  if (pending === 0) {
    console.log("Nenhum capítulo sem capa. Nada a fazer.");
    return;
  }
  console.log(`Capítulos sem capa: ${pending}. Processando até ${LIMIT} neste lote.`);

  // Só os campos necessários (sem carregar as miniaturas existentes na memória).
  const targets = await prisma.episode.findMany({
    where: { thumbDataUrl: null },
    orderBy: [{ seasonId: "asc" }, { number: "asc" }],
    take: LIMIT,
    select: {
      id: true,
      number: true,
      telegramMessageId: true,
      season: { select: { telegramChannelId: true } },
    },
  });

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < targets.length; i++) {
    const ep = targets[i];
    const channel = ep.season?.telegramChannelId;
    if (!channel) {
      fail++;
      continue;
    }
    try {
      const thumb = await fetchMessageThumbnail(channel, ep.telegramMessageId);
      if (thumb) {
        await prisma.episode.update({
          where: { id: ep.id },
          data: { thumbDataUrl: thumb },
        });
        ok++;
      } else {
        fail++;
      }
    } catch (e) {
      fail++;
      console.warn(`  falha no capítulo ${ep.number}:`, (e as Error).message);
    }

    if ((i + 1) % 25 === 0 || i + 1 === targets.length) {
      console.log(`... ${i + 1}/${targets.length} (capas: ${ok}, falhas: ${fail})`);
    }
    await sleep(DELAY_MS);
  }

  const remaining = await prisma.episode.count({ where: { thumbDataUrl: null } });
  console.log(`\nLote concluído. Capas atualizadas: ${ok}. Falhas: ${fail}.`);
  if (remaining > 0) {
    console.log(
      `Ainda faltam ${remaining} sem capa. Rode o comando de novo para continuar.`,
    );
  } else {
    console.log("Pronto! Todas as capas foram preenchidas.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
