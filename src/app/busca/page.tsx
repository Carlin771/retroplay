import { searchSeries } from "@/lib/catalog";
import SeriesCard from "@/components/SeriesCard";

export const dynamic = "force-dynamic";

export default async function BuscaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const results = await searchSeries(q);

  return (
    <div className="px-4 py-8 md:px-8">
      <h1 className="mb-6 text-xl font-bold">
        {q ? `Resultados para "${q}"` : "Todas as séries"}
      </h1>
      {results.length === 0 ? (
        <p className="text-zinc-400">Nada encontrado.</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {results.map((s) => (
            <SeriesCard key={s.id} series={s} />
          ))}
        </div>
      )}
    </div>
  );
}
