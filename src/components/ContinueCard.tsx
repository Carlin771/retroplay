/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Play } from "lucide-react";
import type { ContinueItem } from "@/lib/catalog";
import { watchedPercent } from "@/lib/format";

export default function ContinueCard({ item }: { item: ContinueItem }) {
  const pct = watchedPercent(item.positionSec, item.durationSec);
  return (
    <Link
      href={`/assistir/${item.episodeId}`}
      className="group block w-56 shrink-0 sm:w-64"
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-800">
        <img
          src={`/api/thumb/${item.episodeId}`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
          <Play className="h-10 w-10" />
        </div>
        <div className="absolute bottom-0 left-0 h-1 w-full bg-white/20">
          <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="mt-2">
        <p className="truncate text-sm font-medium">{item.seriesTitle}</p>
        <p className="text-xs text-zinc-400">
          {item.seasonLabel} · Cap. {item.number}
        </p>
      </div>
    </Link>
  );
}
