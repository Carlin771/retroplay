import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, SkipForward } from "lucide-react";
import { getActiveUser } from "@/lib/auth";
import { getPlaybackInfo } from "@/lib/catalog";
import VideoPlayer from "@/components/VideoPlayer";

export const dynamic = "force-dynamic";

export default async function AssistirPage({
  params,
}: {
  params: Promise<{ episodeId: string }>;
}) {
  const { episodeId } = await params;
  // getActiveUser barra quem não está logado e quem tem acesso de teste expirado.
  const user = await getActiveUser();
  if (!user) redirect("/login");

  const info = await getPlaybackInfo(episodeId, user.id);
  if (!info) notFound();

  return (
    <div className="flex flex-col">
      <div className="flex justify-center bg-black">
        <VideoPlayer
          episodeId={info.episode.id}
          startPositionSec={info.startPositionSec}
          durationSec={info.episode.durationSec}
          nextEpisodeId={info.nextEpisodeId}
        />
      </div>

      <div className="px-4 py-5 md:px-8">
        <Link
          href={`/serie/${info.series.id}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" /> {info.series.title}
        </Link>
        <h1 className="text-xl font-bold">
          Capítulo {info.episode.number}
          {info.episode.title ? ` — ${info.episode.title}` : ""}
        </h1>
        <p className="text-sm text-zinc-400">
          {info.series.title} · {info.seasonLabel}
        </p>

        <div className="mt-4 flex gap-3">
          {info.prevEpisodeId && (
            <Link
              href={`/assistir/${info.prevEpisodeId}`}
              className="inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Link>
          )}
          {info.nextEpisodeId && (
            <Link
              href={`/assistir/${info.nextEpisodeId}`}
              className="inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              <SkipForward className="h-4 w-4" /> Próximo capítulo
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
