import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getAdminSeriesList } from "@/lib/admin-data";
import ImportPanel from "@/components/ImportPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const series = await getAdminSeriesList();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <h1 className="mb-6 text-2xl font-bold">Administração</h1>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">
          Importar canal do Telegram
        </h2>
        <ImportPanel />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Séries ({series.length})</h2>
        {series.length === 0 ? (
          <p className="text-zinc-400">
            Nenhuma série ainda. Importe um canal acima.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-white/10 rounded-lg border border-white/10">
            {series.map((s) => (
              <Link
                key={s.id}
                href={`/admin/serie/${s.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-white/5"
              >
                <div>
                  <span className="font-medium">{s.title}</span>
                  {s.hidden && (
                    <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-xs text-zinc-400">
                      oculta
                    </span>
                  )}
                </div>
                <span className="text-sm text-zinc-400">
                  {s.seasons} temp. · {s.episodes} cap.
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
