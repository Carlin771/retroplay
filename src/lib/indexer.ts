import { prisma } from "@/lib/db";
import { iterateChannelVideos, getEntityTitle } from "@/lib/telegram";
import { parseChannelName } from "@/lib/channel-name";

export type IndexResult = {
  seriesId: string;
  seasonId: string;
  imported: number;
  skipped: number;
  total: number;
};

export type IndexOptions = {
  identifier: string; // @canal, link t.me ou id
  seriesTitle?: string; // sobrescreve a série detectada
  seasonLabel?: string; // sobrescreve a temporada detectada
  channelTitle?: string;
  withThumbnails?: boolean;
  onProgress?: (imported: number, total: number) => void;
};

/**
 * Importa os vídeos de um canal do Telegram como capítulos.
 * - 1 canal = 1 temporada (agrupada sob uma série).
 * - Capítulos numerados pela ordem no canal (do mais antigo ao mais novo).
 * - Deduplicação por (temporada, mensagem): re-executar importa só o que é novo.
 */
export async function indexChannel(opts: IndexOptions): Promise<IndexResult> {
  const channelTitle =
    opts.channelTitle ?? (await getEntityTitle(opts.identifier)) ?? opts.identifier;
  const parsed = parseChannelName(channelTitle);
  const seriesTitle = (opts.seriesTitle ?? parsed.seriesTitle).trim();
  const seasonLabel = (opts.seasonLabel ?? parsed.seasonLabel).trim();

  const series = await prisma.series.upsert({
    where: { title: seriesTitle },
    update: {},
    create: { title: seriesTitle },
  });

  let season = await prisma.season.findUnique({
    where: { seriesId_label: { seriesId: series.id, label: seasonLabel } },
  });
  if (!season) {
    const order = await prisma.season.count({ where: { seriesId: series.id } });
    season = await prisma.season.create({
      data: {
        seriesId: series.id,
        label: seasonLabel,
        order,
        telegramChannelId: opts.identifier,
        telegramChannelTitle: channelTitle,
      },
    });
  } else {
    await prisma.season.update({
      where: { id: season.id },
      data: {
        telegramChannelId: opts.identifier,
        telegramChannelTitle: channelTitle,
      },
    });
  }

  const existing = await prisma.episode.findMany({
    where: { seasonId: season.id },
    select: { telegramMessageId: true, number: true },
  });
  const seen = new Set(existing.map((e) => e.telegramMessageId));
  let maxNumber = existing.reduce((mx, e) => Math.max(mx, e.number), 0);

  let imported = 0;
  let skipped = 0;
  let total = 0;

  for await (const video of iterateChannelVideos(opts.identifier, {
    withThumbnails: opts.withThumbnails,
  })) {
    total++;
    if (seen.has(video.messageId)) {
      skipped++;
      continue;
    }
    maxNumber++;
    await prisma.episode.create({
      data: {
        seasonId: season.id,
        number: maxNumber,
        title: video.caption,
        telegramMessageId: video.messageId,
        durationSec: video.durationSec,
        sizeBytes: video.sizeBytes ? BigInt(video.sizeBytes) : null,
        thumbDataUrl: video.thumbDataUrl,
      },
    });
    seen.add(video.messageId);
    imported++;
    opts.onProgress?.(imported, total);
  }

  return { seriesId: series.id, seasonId: season.id, imported, skipped, total };
}
