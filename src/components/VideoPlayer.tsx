"use client";

import { useEffect, useRef } from "react";
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

  function sendProgress(position: number, completed = false) {
    const v = ref.current;
    const dur = Math.floor(v?.duration || durationSec || 0);
    const payload = JSON.stringify({
      episodeId,
      positionSec: Math.floor(position),
      durationSec: dur,
      completed,
    });
    fetch("/api/progresso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
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
  );
}
