/**
 * Tenta separar o nome de um canal em "série" + "temporada".
 * Ex.: "malhacao 1995" -> { seriesTitle: "Malhacao", seasonLabel: "1995" }
 *      "Chocolate com Pimenta" -> { seriesTitle: "Chocolate Com Pimenta", seasonLabel: "1" }
 *
 * O administrador pode corrigir título/temporada depois no painel (inclusive acentos).
 */
export function parseChannelName(name: string): {
  seriesTitle: string;
  seasonLabel: string;
} {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const m = /^(.*?)[\s\-_]*((?:19|20)\d{2}|\d{1,3})$/.exec(trimmed);
  if (m && m[1].trim().length >= 2) {
    return { seriesTitle: titleCase(m[1].trim()), seasonLabel: m[2] };
  }
  return { seriesTitle: titleCase(trimmed), seasonLabel: "1" };
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
