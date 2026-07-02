"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";
import { Play, Check } from "lucide-react";
import type { SeriesDetail, ProgressInfo } from "@/lib/catalog";
import { formatDuration, watchedPercent } from "@/lib/format";

export default function SeriesView({
  series,
  progress,
}: {
  series: SeriesDetail;
  progress: Record<string, ProgressInfo>;
}) {
  const [seasonIdx, setSeasonIdx] = useState(0);
  const season = series.seasons[seasonIdx];

  return (
    <div>
      <div className="bg-gradient-to-b from-zinc-800/60 to-background px-4 py-10 md:px-8">
        <h1 className="text-3xl font-extrabold md:text-4xl">{series.title}</h1>
        {series.description && (
          <p className="mt-3 max-w-2xl text-sm text-zinc-300">
            {series.description}
          </p>
        )}
        <p className="mt-2 text-sm text-zinc-400">
          {series.seasons.length}{" "}
          {series.seasons.length === 1 ? "temporada" : "temporadas"}
        </p>
      </div>

      {series.seasons.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 md:px-8">
          {series.seasons.map((se, i) => (
            <button
              key={se.id}
              onClick={() => setSeasonIdx(i)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${
                i === seasonIdx
                  ? "bg-white text-black"
                  : "bg-white/10 text-zinc-300 hover:bg-white/20"
              }`}
            >
              {se.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 px-4 py-6 md:px-8">
        {season && season.episodes.length > 0 ? (
          season.episodes.map((ep) => {
            const p = progress[ep.id];
            const pct = p
              ? watchedPercent(p.positionSec, p.durationSec || ep.durationSec || 0)
              : 0;
            return (
              <Link
                key={ep.id}
                href={`/assistir/${ep.id}`}
                className="group flex gap-4 rounded-lg p-2 hover:bg-white/5"
              >
                <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-md bg-zinc-800 sm:w-48">
                  {ep.thumbDataUrl ? (
                    <img
                      src={ep.thumbDataUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-zinc-700 to-zinc-900" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                    <Play className="h-8 w-8" />
                  </div>
                  {pct > 0 && (
                    <div className="absolute bottom-0 left-0 h-1 w-full bg-white/20">
                      <div
                        className="h-full bg-brand"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      Capítulo {ep.number}
                    </span>
                    {p?.completed && <Check className="h-4 w-4 text-brand" />}
                  </div>
                  {ep.title && (
                    <p className="text-sm text-zinc-400">{ep.title}</p>
                  )}
                  {ep.durationSec ? (
                    <p className="text-xs text-zinc-500">
                      {formatDuration(ep.durationSec)}
                    </p>
                  ) : null}
                </div>
              </Link>
            );
          })
        ) : (
          <p className="text-zinc-400">
            Nenhum capítulo nesta temporada ainda.
          </p>
        )}
      </div>
    </div>
  );
}
