import "dotenv/config";
import { indexChannel } from "../src/lib/indexer";

/**
 * Importa um canal do Telegram como uma temporada.
 *
 * Uso:
 *   npm run index:channel -- <@canal|link> [--series "Nome"] [--season "1995"] [--no-thumbs]
 *
 * Exemplos:
 *   npm run index:channel -- @malhacao1995
 *   npm run index:channel -- https://t.me/malhacao1995 --series "Malhação" --season "1995"
 */
async function main() {
  const args = process.argv.slice(2);
  const identifier = args[0];
  if (!identifier || identifier.startsWith("--")) {
    console.error(
      'Uso: npm run index:channel -- <@canal|link> [--series "Nome"] [--season "1995"] [--no-thumbs]',
    );
    process.exit(1);
  }

  const getFlag = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const seriesTitle = getFlag("--series");
  const seasonLabel = getFlag("--season");
  const withThumbnails = !args.includes("--no-thumbs");

  console.log(`Indexando ${identifier}...`);
  const res = await indexChannel({
    identifier,
    seriesTitle,
    seasonLabel,
    withThumbnails,
    onProgress: (imported) => {
      if (imported % 10 === 0) {
        process.stdout.write(`  ${imported} capítulos importados...\r`);
      }
    },
  });

  console.log(
    `\nConcluído: ${res.imported} novos, ${res.skipped} já existiam (total no canal: ${res.total}).`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
