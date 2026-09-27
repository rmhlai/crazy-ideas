import Link from "next/link";
import { listChildren } from "@/lib/services/children";
import { getInsights, getRankings } from "@/lib/services/rankings";
import { ChildDot, Empty, ScoreBar, WatchFlag } from "@/components/bits";

export const dynamic = "force-dynamic";

export default async function RankingsPage({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const sp = await searchParams;
  const kids = listChildren();
  const sel: number | "all" = sp.child === "all" || !kids.length ? "all" : sp.child ? Number(sp.child) : kids.length === 1 ? kids[0].id : "all";
  const r = getRankings(sel);
  const insights = sel !== "all" ? getInsights(sel) : null;
  const kid = sel !== "all" ? kids.find((k) => k.id === sel) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1 mb-0">Favourites</h1>
      <div className="flex flex-wrap gap-2" role="tablist">
        {kids.map((k) => (
          <Link key={k.id} role="tab" aria-selected={sel === k.id} href={`/rankings?child=${k.id}`} className={`chip gap-1.5 px-3 py-1.5 text-sm ${sel === k.id ? "bg-slate-800 text-white" : ""}`}>
            <ChildDot color={k.color} /> {k.name}
          </Link>
        ))}
        <Link role="tab" aria-selected={sel === "all"} href="/rankings?child=all" className={`chip px-3 py-1.5 text-sm ${sel === "all" ? "bg-slate-800 text-white" : ""}`}>
          🏠 Household
        </Link>
      </div>

      <section className="card">
        <h2 className="h2">🏆 Favourites</h2>
        {r.favourites.length === 0 ? (
          <Empty>No ratings yet. Rate lunches in the Feedback tab.</Empty>
        ) : (
          <ol className="flex flex-col gap-3">
            {r.favourites.map((f, i) => (
              <li key={f.dishId} className="grid grid-cols-[2rem_1fr] items-center gap-x-2">
                <span className="text-lg font-bold text-slate-400">{i + 1}</span>
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/dishes/${f.dishId}`} className="font-semibold hover:underline">
                      {f.dishName}
                    </Link>
                    <span className="text-sm text-slate-500">
                      {f.ups} 👍 · {f.downs} 👎
                    </span>
                  </div>
                  <ScoreBar score={f.score} />
                  <WatchFlag terms={f.watch} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {r.notAHit.length > 0 && (
        <section className="card">
          <h2 className="h2">🙅 Not a hit</h2>
          <ul className="flex flex-col gap-2">
            {r.notAHit.map((f) => (
              <li key={f.dishId} className="flex items-center justify-between gap-2">
                <Link href={`/dishes/${f.dishId}`} className="hover:underline">
                  {f.dishName}
                </Link>
                <span className="text-sm text-slate-500">
                  {f.ups} 👍 · {f.downs} 👎
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.unrated.length > 0 && (
        <section className="card">
          <h2 className="h2">❔ Not rated yet</h2>
          <ul className="flex flex-wrap gap-2">
            {r.unrated.map((f) => (
              <li key={f.dishId}>
                <Link href={`/dishes/${f.dishId}`} className="chip px-3 py-1 hover:bg-slate-200">
                  {f.dishName}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {insights && kid && (
        <section className="card">
          <h2 className="h2">🔎 Ingredient insights for {kid.name}</h2>
          {insights.insights.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nothing stands out yet. Insights appear once an ingredient shows up in at least 3 rated dishes that have ingredient lists
              ({insights.ratedWithIngredients} rated so far).
            </p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {insights.insights.map((i) => (
                <li key={i.ingredient}>
                  Dishes containing <strong>{i.ingredient}</strong> are usually{" "}
                  {i.delta < 0 ? <span className="font-semibold text-red-700">thumbs down 👎</span> : <span className="font-semibold text-emerald-700">thumbs up 👍</span>}{" "}
                  for {kid.name}{" "}
                  <span className="text-slate-500">
                    ({Math.round(i.upRateWith * 100)}% 👍 with vs {Math.round(i.upRateWithout * 100)}% without, {i.dishesWith} dishes)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <p className="text-xs text-slate-400">
        Score = (👍 + {r.prior.a}) / (ratings + {r.prior.a + r.prior.b}) so one lucky thumbs-up doesn&apos;t beat a dish loved ten times. Adjust in Settings.
      </p>
    </div>
  );
}
