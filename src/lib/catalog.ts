import { prisma } from "@/lib/db";

export type SeriesCardData = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  seasonsCount: number;
  episodeCount: number;
};

/** Todas as séries visíveis, com capa e contagem de temporadas/capítulos. */
export async function getVisibleSeries(): Promise<SeriesCardData[]> {
  const series = await prisma.series.findMany({
    where: { hidden: false },
    orderBy: { title: "asc" },
    include: {
      seasons: {
        where: { hidden: false },
        select: { _count: { select: { episodes: true } } },
      },
    },
  });

  return series.map((s) => {
    const episodeCount = s.seasons.reduce(
      (acc, se) => acc + se._count.episodes,
      0,
    );
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      coverUrl: s.coverUrl,
      seasonsCount: s.seasons.length,
      episodeCount,
    };
  });
}

export type ContinueItem = {
  episodeId: string;
  number: number;
  title: string | null;
  positionSec: number;
  durationSec: number;
  seriesId: string;
  seriesTitle: string;
  seasonLabel: string;
};

/** Fileira "Continuar assistindo" para um usuário. */
export async function getContinueWatching(
  userId: string,
): Promise<ContinueItem[]> {
  const rows = await prisma.watchProgress.findMany({
    where: { userId, completed: false, positionSec: { gt: 5 } },
    orderBy: { updatedAt: "desc" },
    take: 12,
    include: {
      episode: { include: { season: { include: { series: true } } } },
    },
  });

  return rows
    .filter((r) => !r.episode.hidden && !r.episode.season.hidden)
    .map((r) => ({
      episodeId: r.episodeId,
      number: r.episode.number,
      title: r.episode.title,
      positionSec: r.positionSec,
      durationSec: r.durationSec || r.episode.durationSec || 0,
      seriesId: r.episode.season.seriesId,
      seriesTitle: r.episode.season.series.title,
      seasonLabel: r.episode.season.label,
    }));
}

export type EpisodeLite = {
  id: string;
  number: number;
  title: string | null;
  durationSec: number | null;
};

export type SeasonWithEpisodes = {
  id: string;
  label: string;
  order: number;
  episodes: EpisodeLite[];
};

export type SeriesDetail = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  seasons: SeasonWithEpisodes[];
};

/** Detalhe de uma série com temporadas e capítulos (tipo limpo, sem BigInt). */
export async function getSeriesDetail(id: string): Promise<SeriesDetail | null> {
  const s = await prisma.series.findFirst({
    where: { id, hidden: false },
    include: {
      seasons: {
        where: { hidden: false },
        orderBy: { order: "asc" },
        include: {
          episodes: {
            where: { hidden: false },
            orderBy: { number: "asc" },
            select: {
              id: true,
              number: true,
              title: true,
              durationSec: true,
            },
          },
        },
      },
    },
  });
  if (!s) return null;
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    coverUrl: s.coverUrl,
    seasons: s.seasons.map((se) => ({
      id: se.id,
      label: se.label,
      order: se.order,
      episodes: se.episodes.map((e) => ({
        id: e.id,
        number: e.number,
        title: e.title,
        durationSec: e.durationSec,
      })),
    })),
  };
}

export type ProgressInfo = {
  positionSec: number;
  durationSec: number;
  completed: boolean;
};

/** Mapa de progresso (episodeId -> progresso) do usuário para os capítulos dados. */
export async function getProgressMap(
  userId: string,
  episodeIds: string[],
): Promise<Record<string, ProgressInfo>> {
  if (episodeIds.length === 0) return {};
  const rows = await prisma.watchProgress.findMany({
    where: { userId, episodeId: { in: episodeIds } },
  });
  const map: Record<string, ProgressInfo> = {};
  for (const r of rows) {
    map[r.episodeId] = {
      positionSec: r.positionSec,
      durationSec: r.durationSec,
      completed: r.completed,
    };
  }
  return map;
}

/** Busca simples por título (case-insensitive, feita em memória). */
export async function searchSeries(q: string): Promise<SeriesCardData[]> {
  const all = await getVisibleSeries();
  const needle = q.trim().toLowerCase();
  if (!needle) return all;
  return all.filter((s) => s.title.toLowerCase().includes(needle));
}

export type PlaybackInfo = {
  episode: {
    id: string;
    number: number;
    title: string | null;
    durationSec: number | null;
  };
  series: { id: string; title: string };
  seasonLabel: string;
  prevEpisodeId: string | null;
  nextEpisodeId: string | null;
  startPositionSec: number;
};

/** Dados para a página do player, incluindo posição salva e próximo/anterior capítulo. */
export async function getPlaybackInfo(
  episodeId: string,
  userId: string,
): Promise<PlaybackInfo | null> {
  const ep = await prisma.episode.findFirst({
    where: { id: episodeId, hidden: false },
    include: { season: { include: { series: true } } },
  });
  if (!ep || ep.season.hidden || ep.season.series.hidden) return null;

  const [prev, next, progress] = await Promise.all([
    prisma.episode.findFirst({
      where: { seasonId: ep.seasonId, hidden: false, number: { lt: ep.number } },
      orderBy: { number: "desc" },
      select: { id: true },
    }),
    prisma.episode.findFirst({
      where: { seasonId: ep.seasonId, hidden: false, number: { gt: ep.number } },
      orderBy: { number: "asc" },
      select: { id: true },
    }),
    prisma.watchProgress.findUnique({
      where: { userId_episodeId: { userId, episodeId } },
    }),
  ]);

  return {
    episode: {
      id: ep.id,
      number: ep.number,
      title: ep.title,
      durationSec: ep.durationSec,
    },
    series: { id: ep.season.series.id, title: ep.season.series.title },
    seasonLabel: ep.season.label,
    prevEpisodeId: prev?.id ?? null,
    nextEpisodeId: next?.id ?? null,
    startPositionSec:
      progress && !progress.completed ? progress.positionSec : 0,
  };
}
