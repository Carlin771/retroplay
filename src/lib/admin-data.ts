import { prisma } from "@/lib/db";

export async function getAdminSeriesList() {
  const series = await prisma.series.findMany({
    orderBy: { title: "asc" },
    include: {
      seasons: { include: { _count: { select: { episodes: true } } } },
    },
  });
  return series.map((s) => ({
    id: s.id,
    title: s.title,
    hidden: s.hidden,
    seasons: s.seasons.length,
    episodes: s.seasons.reduce((acc, se) => acc + se._count.episodes, 0),
  }));
}

export async function getAdminSeries(id: string) {
  return prisma.series.findUnique({
    where: { id },
    include: {
      seasons: {
        orderBy: { order: "asc" },
        include: { _count: { select: { episodes: true } } },
      },
    },
  });
}
