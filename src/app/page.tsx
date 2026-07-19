import { getVisibleSeries, getContinueWatching } from "@/lib/catalog";
import { getSession } from "@/lib/auth";
import SeriesCard from "@/components/SeriesCard";
import ContinueCard from "@/components/ContinueCard";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  const isAdmin = session?.role === "ADMIN";
  const [series, continueItems] = await Promise.all([
    getVisibleSeries(),
    session ? getContinueWatching(session.userId) : Promise.resolve([]),
  ]);

  if (series.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="mb-3 text-2xl font-bold">Bem-vindo ao {SITE_NAME}</h1>
        <p className="text-zinc-400">
          Ainda não há séries por aqui.{" "}
          {session
            ? "Use o painel de administração para importar um canal do Telegram."
            : "Volte em breve!"}
        </p>
      </div>
    );
  }

  return (
    <div className="py-6">
      {continueItems.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 px-4 text-lg font-bold md:px-8">
            Continuar assistindo
          </h2>
          <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 md:px-8 lg:grid-cols-4">
            {continueItems.map((it) => (
              <ContinueCard key={it.episodeId} item={it} fill />
            ))}
          </div>
        </section>
      )}
      {isAdmin ? (
        // Visão do admin: grade de 2 por linha, empilhando para baixo.
        <section className="mb-8">
          <h2 className="mb-3 px-4 text-lg font-bold md:px-8">
            Todas as séries
          </h2>
          <div className="grid grid-cols-2 gap-3 px-4 md:px-8">
            {series.map((s) => (
              <SeriesCard key={s.id} series={s} fill />
            ))}
          </div>
        </section>
      ) : (
        // Grade que rola para BAIXO: navegável no controle remoto da TV.
        <section className="mb-8">
          <h2 className="mb-3 px-4 text-lg font-bold md:px-8">
            Todas as séries
          </h2>
          <div className="grid grid-cols-3 gap-3 px-4 sm:grid-cols-4 md:grid-cols-5 md:px-8 lg:grid-cols-6">
            {series.map((s) => (
              <SeriesCard key={s.id} series={s} fill />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
