import { notFound } from "next/navigation";
import Link from "next/link";
import CoverUploader from "@/components/CoverUploader";
import { requireAdmin } from "@/lib/auth";
import { getAdminSeries } from "@/lib/admin-data";
import {
  updateSeriesAction,
  renameSeasonAction,
  toggleSeasonHiddenAction,
  deleteSeasonAction,
  moveSeasonAction,
} from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminSeriePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const series = await getAdminSeries(id);
  if (!series) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <Link href="/admin" className="text-sm text-zinc-400 hover:text-white">
        ← Voltar
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-bold">Editar série</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Capa da série</h2>
        <CoverUploader
          seriesId={series.id}
          currentCoverUrl={series.coverUrl}
        />
      </section>

      <form action={updateSeriesAction} className="mb-10 flex flex-col gap-3">
        <input type="hidden" name="id" value={series.id} />
        <label className="flex flex-col gap-1 text-sm">
          Título
          <input
            name="title"
            defaultValue={series.title}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Descrição
          <textarea
            name="description"
            defaultValue={series.description ?? ""}
            rows={3}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="hidden" defaultChecked={series.hidden} />
          Ocultar do catálogo
        </label>
        <button className="mt-1 self-start rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
          Salvar
        </button>
      </form>

      <h2 className="mb-3 text-lg font-semibold">
        Temporadas ({series.seasons.length})
      </h2>
      <div className="flex flex-col gap-3">
        {series.seasons.map((se, i) => (
          <div key={se.id} className="rounded-lg border border-white/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <form
                action={renameSeasonAction}
                className="flex items-center gap-2"
              >
                <input type="hidden" name="seasonId" value={se.id} />
                <input type="hidden" name="seriesId" value={series.id} />
                <input
                  name="label"
                  defaultValue={se.label}
                  className="w-28 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm"
                />
                <button className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20">
                  Renomear
                </button>
              </form>
              <span className="text-sm text-zinc-400">
                {se._count.episodes} cap.
                {se.hidden && " · oculta"}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <form action={moveSeasonAction}>
                <input type="hidden" name="seasonId" value={se.id} />
                <input type="hidden" name="seriesId" value={series.id} />
                <input type="hidden" name="direction" value="up" />
                <button
                  disabled={i === 0}
                  className="rounded bg-white/10 px-2 py-1 text-xs disabled:opacity-40"
                >
                  ↑
                </button>
              </form>
              <form action={moveSeasonAction}>
                <input type="hidden" name="seasonId" value={se.id} />
                <input type="hidden" name="seriesId" value={series.id} />
                <input type="hidden" name="direction" value="down" />
                <button
                  disabled={i === series.seasons.length - 1}
                  className="rounded bg-white/10 px-2 py-1 text-xs disabled:opacity-40"
                >
                  ↓
                </button>
              </form>
              <form action={toggleSeasonHiddenAction}>
                <input type="hidden" name="seasonId" value={se.id} />
                <input type="hidden" name="seriesId" value={series.id} />
                <button className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20">
                  {se.hidden ? "Exibir" : "Ocultar"}
                </button>
              </form>
              <form action={deleteSeasonAction}>
                <input type="hidden" name="seasonId" value={se.id} />
                <input type="hidden" name="seriesId" value={series.id} />
                <button className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/30">
                  Excluir
                </button>
              </form>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Canal: {se.telegramChannelId}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
