/** Formata segundos como "1h 02min" ou "45min". */
export function formatDuration(totalSec?: number | null): string {
  if (!totalSec || totalSec <= 0) return "";
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  return `${m}min`;
}

/** Percentual assistido (0-100). */
export function watchedPercent(positionSec: number, durationSec: number): number {
  if (!durationSec || durationSec <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((positionSec / durationSec) * 100)));
}
