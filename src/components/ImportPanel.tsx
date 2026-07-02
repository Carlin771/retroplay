"use client";

import { useEffect, useState } from "react";
import type { IndexJob } from "@/lib/index-jobs";

/** Interpreta a lista em blocos de 3 linhas: nome, link, endereço da capa. */
function parseBulkList(
  text: string,
): { name: string; link: string; cover?: string }[] {
  let blocks = text
    .split(/\n\s*\n/)
    .map((b) =>
      b
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .filter((b) => b.length > 0);

  // Se veio tudo grudado (um bloco só grande), agrupa de 3 em 3.
  if (blocks.length === 1 && blocks[0].length > 3) {
    const lines = blocks[0];
    blocks = [];
    for (let i = 0; i < lines.length; i += 3) {
      blocks.push(lines.slice(i, i + 3));
    }
  }

  return blocks
    .map((b) => ({ name: b[0], link: b[1], cover: b[2] || undefined }))
    .filter((e) => e.name && e.link);
}

export default function ImportPanel() {
  const [identifier, setIdentifier] = useState("");
  const [seriesTitle, setSeriesTitle] = useState("");
  const [seasonLabel, setSeasonLabel] = useState("");
  const [withThumbnails, setWithThumbnails] = useState(true);
  const [jobs, setJobs] = useState<IndexJob[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bulk, setBulk] = useState("");
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

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

  async function submitBulk(e: React.FormEvent) {
    e.preventDefault();
    const entries = parseBulkList(bulk);
    if (entries.length === 0) {
      setBulkMsg(
        "Cole ao menos uma série (3 linhas: nome, link, endereço da imagem).",
      );
      return;
    }
    setBulkSubmitting(true);
    setBulkMsg(null);
    const r = await fetch("/api/admin/index-many", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channels: entries, withThumbnails }),
    });
    const d = await r.json().catch(() => ({}));
    setBulkSubmitting(false);
    if (!r.ok) {
      setBulkMsg(d.error ?? "Erro ao importar.");
      return;
    }
    setBulkMsg(
      `${entries.length} série(s) na fila! Vão importar uma por uma — acompanhe abaixo.`,
    );
    setBulk("");
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

      <form
        onSubmit={submitBulk}
        className="flex flex-col gap-3 rounded-lg border border-white/10 p-4"
      >
        <h3 className="text-sm font-semibold">Importar várias de uma vez</h3>
        <p className="text-xs text-zinc-400">
          Para cada série, <strong>3 linhas</strong> nesta ordem:
          <br />
          <span className="text-zinc-500">
            nome
            <br />
            link do canal
            <br />
            endereço da imagem (capa)
          </span>
          <br />
          Separe cada série com uma linha em branco.
        </p>
        {bulkMsg && (
          <div className="rounded-md bg-white/10 px-3 py-2 text-sm">
            {bulkMsg}
          </div>
        )}
        <textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={10}
          placeholder={
            "Malhação 1998\nhttps://t.me/+xxxx\nhttps://site.com/poster1998.jpg\n\nMalhação 1999\nhttps://t.me/+yyyy\nhttps://site.com/poster1999.jpg"
          }
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={bulkSubmitting}
          className="mt-1 self-start rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {bulkSubmitting ? "Enviando..." : "Importar todas"}
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
