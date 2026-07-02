import { getVisibleSeries, getContinueWatching } from "@/lib/catalog";
import { getSession } from "@/lib/auth";
import Row from "@/components/Row";
import SeriesCard from "@/components/SeriesCard";
import ContinueCard from "@/components/ContinueCard";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
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
        <Row title="Continuar assistindo">
          {continueItems.map((it) => (
            <ContinueCard key={it.episodeId} item={it} />
          ))}
        </Row>
      )}
      <Row title="Todas as séries">
        {series.map((s) => (
          <SeriesCard key={s.id} series={s} />
        ))}
      </Row>
    </div>
  );
}
