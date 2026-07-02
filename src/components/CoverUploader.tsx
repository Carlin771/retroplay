"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CoverUploader({
  seriesId,
  currentCoverUrl,
}: {
  seriesId: string;
  currentCoverUrl: string | null;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(currentCoverUrl);
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(cover: string) {
    setSaving(true);
    setMsg(null);
    const r = await fetch("/api/admin/series-cover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesId, cover }),
    });
    setSaving(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setMsg(d.error ?? "Erro ao salvar a capa.");
      return;
    }
    setPreview(cover);
    setMsg("Capa salva!");
    router.refresh();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    try {
      const dataUrl = await resizeToDataUrl(file, 500, 750);
      await save(dataUrl);
    } catch {
      setSaving(false);
      setMsg("Não consegui processar essa imagem. Tente outra.");
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="h-48 w-32 shrink-0 overflow-hidden rounded-md bg-zinc-800">
        {preview ? (
          <img src={preview} alt="Capa" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
            sem capa
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Enviar imagem do dispositivo</label>
          <input
            type="file"
            accept="image/*"
            onChange={onFile}
            disabled={saving}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white hover:file:bg-white/20"
          />
          <span className="text-xs text-zinc-500">
            De preferência uma imagem em pé (formato pôster). Ela é
            redimensionada automaticamente.
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">ou colar uma URL de imagem</label>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button
              type="button"
              disabled={saving || !url.trim()}
              onClick={() => save(url.trim())}
              className="rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/20 disabled:opacity-40"
            >
              Usar
            </button>
          </div>
        </div>

        {saving && <span className="text-xs text-zinc-400">salvando...</span>}
        {msg && <span className="text-xs text-zinc-300">{msg}</span>}
      </div>
    </div>
  );
}

/** Redimensiona a imagem no navegador e devolve um data URL JPEG leve. */
async function resizeToDataUrl(
  file: File,
  maxW: number,
  maxH: number,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(maxW / bitmap.width, maxH / bitmap.height, 1);
  const width = Math.round(bitmap.width * ratio);
  const height = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sem contexto de canvas");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}
