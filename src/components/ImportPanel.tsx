"use client";

import { useEffect, useState } from "react";
import type { IndexJob } from "@/lib/index-jobs";

export default function ImportPanel() {
  const [identifier, setIdentifier] = useState("");
  const [seriesTitle, setSeriesTitle] = useState("");
  const [seasonLabel, setSeasonLabel] = useState("");
  const [withThumbnails, setWithThumbnails] = useState(true);
  const [jobs, setJobs] = useState<IndexJob[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadJobs() {
    try {
      const r = await fetch("/api/admin/jobs");
      if (r.ok) {
        const d = await r.json();
        setJobs(d.jobs ?? []);
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadJobs();
    const t = setInterval(loadJobs, 2000);
    return () => clearInterval(t);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    const r = await fetch("/api/admin/index-channel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier,
        seriesTitle: seriesTitle || undefined,
        seasonLabel: seasonLabel || undefined,
        withThumbnails,
      }),
    });
    const d = await r.json().catch(() => ({}));
    setSubmitting(false);
    if (!r.ok) {
      setMsg(d.error ?? "Erro ao iniciar a importação.");
      return;
    }
    setMsg("Importação iniciada! Acompanhe o progresso abaixo.");
    setIdentifier("");
    setSeriesTitle("");
    setSeasonLabel("");
    loadJobs();
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={submit}
        className="flex flex-col gap-3 rounded-lg border border-white/10 p-4"
      >
        {msg && (
          <div className="rounded-md bg-white/10 px-3 py-2 text-sm">{msg}</div>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Canal (@usuario ou link t.me)
          <input
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="@malhacao1995"
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-brand"
          />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Série (opcional — detectada automaticamente)
            <input
              value={seriesTitle}
              onChange={(e) => setSeriesTitle(e.target.value)}
              placeholder="Malhação"
              className="rounded-md border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:w-40">
            Temporada (opcional)
            <input
              value={seasonLabel}
              onChange={(e) => setSeasonLabel(e.target.value)}
              placeholder="1995"
              className="rounded-md border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={withThumbnails}
            onChange={(e) => setWithThumbnails(e.target.checked)}
          />
          Baixar miniaturas (deixa a importação mais lenta, mas o catálogo fica
          bonito)
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="mt-1 self-start rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Iniciando..." : "Importar canal"}
        </button>
      </form>

      {jobs.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-zinc-300">Importações</h3>
          {jobs.map((j) => (
            <div
              key={j.id}
              className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2 text-sm"
            >
              <span className="truncate">{j.identifier}</span>
              <span className="ml-3 shrink-0 text-zinc-400">
                {j.status === "running" &&
                  `importando... ${j.imported} cap.`}
                {j.status === "done" &&
                  `✓ ${j.imported} novos (${j.total} no canal)`}
                {j.status === "error" && (
                  <span className="text-red-300">erro: {j.error}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
