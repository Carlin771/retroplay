import "dotenv/config";
import { prisma } from "../src/lib/db";
import { fetchMessageThumbnail } from "../src/lib/telegram";

/**
 * Reprocessa as capas (miniaturas) dos capítulos.
 *
 * Uso:
 *   npm run backfill:thumbs           -> só os capítulos SEM capa
 *   npm run backfill:thumbs -- --all  -> TODOS (para melhorar/atualizar a qualidade)
 *
 * Baixa devagar (pausa entre cada) para não bater no limite de taxa do Telegram.
 */

const ALL = process.argv.includes("--all");
const DELAY_MS = 400;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const episodes = await prisma.episode.findMany({
    orderBy: [{ seasonId: "asc" }, { number: "asc" }],
    select: {
      id: true,
      number: true,
      telegramMessageId: true,
      thumbDataUrl: true,
      season: { select: { telegramChannelId: true } },
    },
  });

  const targets = episodes.filter((e) => ALL || !e.thumbDataUrl);
  console.log(
    `Capítulos a processar: ${targets.length} de ${episodes.length} ` +
      `(${ALL ? "todos" : "só sem capa"}).`,
  );

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

    if ((i + 1) % 10 === 0 || i + 1 === targets.length) {
      console.log(`... ${i + 1}/${targets.length} (capas: ${ok}, falhas: ${fail})`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nConcluído. Capas atualizadas: ${ok}. Falhas: ${fail}.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
