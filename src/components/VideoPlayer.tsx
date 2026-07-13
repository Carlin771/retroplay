"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  episodeId: string;
  startPositionSec: number;
  durationSec: number | null;
  nextEpisodeId: string | null;
};

export default function VideoPlayer({
  episodeId,
  startPositionSec,
  durationSec,
  nextEpisodeId,
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const lastSent = useRef(0);
  const [blocked, setBlocked] = useState(false);

  async function sendProgress(position: number, completed = false) {
    const v = ref.current;
    const dur = Math.floor(v?.duration || durationSec || 0);
    const payload = JSON.stringify({
      episodeId,
      positionSec: Math.floor(position),
      durationSec: dur,
      completed,
    });
    try {
      const res = await fetch("/api/progresso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
      const data = await res.json().catch(() => null);
      // Acesso de teste sem saldo: pausa e mostra o aviso.
      if (data?.blocked) {
        setBlocked(true);
        const vid = ref.current;
        if (vid && !vid.paused) vid.pause();
      }
    } catch {
      /* silencioso: salvar progresso é best-effort */
    }
  }

  useEffect(() => {
    const v = ref.current;
    if (!v) return;

    const onLoaded = () => {
      if (startPositionSec > 2 && startPositionSec < (v.duration || Infinity)) {
        v.currentTime = startPositionSec;
      }
    };
    v.addEventListener("loadedmetadata", onLoaded);

    const onHide = () => {
      if (v.currentTime > 0) sendProgress(v.currentTime);
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide();
    });

    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      window.removeEventListener("pagehide", onHide);
      if (v.currentTime > 0) sendProgress(v.currentTime);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId, startPositionSec]);

  function onTimeUpdate() {
    const v = ref.current;
    if (!v) return;
    const now = Date.now();
    if (now - lastSent.current > 10000) {
      lastSent.current = now;
      sendProgress(v.currentTime);
    }
  }

  function onPause() {
    const v = ref.current;
    if (v && v.currentTime > 0) sendProgress(v.currentTime);
  }

  function onEnded() {
    const v = ref.current;
    if (v) sendProgress(v.duration || 0, true);
    if (nextEpisodeId) router.push(`/assistir/${nextEpisodeId}`);
  }

  return (
    <div className="relative mx-auto w-fit max-w-full">
      <video
        ref={ref}
        src={`/api/stream/${episodeId}`}
        controls
        autoPlay
        playsInline
        onTimeUpdate={onTimeUpdate}
        onPause={onPause}
        onEnded={onEnded}
        className="mx-auto max-h-[85vh] w-auto max-w-full bg-black"
      />
      {blocked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 px-6 text-center">
          <p className="text-lg font-semibold text-white">
            Seu tempo de teste acabou
          </p>
          <p className="max-w-sm text-sm text-zinc-300">
            Peça um novo acesso ao administrador para continuar assistindo.
          </p>
        </div>
      )}
    </div>
  );
}
