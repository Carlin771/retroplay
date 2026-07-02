/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { SeriesCardData } from "@/lib/catalog";

export default function SeriesCard({ series }: { series: SeriesCardData }) {
  return (
    <Link
      href={`/serie/${series.id}`}
      className="group block w-36 shrink-0 sm:w-44"
    >
      <div className="aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800">
        {series.coverUrl ? (
          <img
            src={series.coverUrl}
            alt={series.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 p-3 text-center">
            <span className="text-sm font-semibold">{series.title}</span>
          </div>
        )}
      </div>
      <div className="mt-2">
        <p className="truncate text-sm font-medium">{series.title}</p>
        <p className="text-xs text-zinc-400">
          {series.episodeCount}{" "}
          {series.episodeCount === 1 ? "episódio" : "episódios"}
        </p>
      </div>
    </Link>
  );
}
