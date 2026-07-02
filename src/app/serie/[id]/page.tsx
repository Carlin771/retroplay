import { notFound } from "next/navigation";
import { getSeriesDetail, getProgressMap } from "@/lib/catalog";
import { getSession } from "@/lib/auth";
import SeriesView from "@/components/SeriesView";

export const dynamic = "force-dynamic";

export default async function SeriePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const series = await getSeriesDetail(id);
  if (!series) notFound();

  const session = await getSession();
  const episodeIds = series.seasons.flatMap((s) => s.episodes.map((e) => e.id));
  const progress = session
    ? await getProgressMap(session.userId, episodeIds)
    : {};

  return <SeriesView series={series} progress={progress} />;
}
