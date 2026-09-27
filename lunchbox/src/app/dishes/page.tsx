import Link from "next/link";
import { listDishes } from "@/lib/services/dishes";
import { listChildren } from "@/lib/services/children";
import { AllergenChips, Empty, WatchFlag } from "@/components/bits";

export const dynamic = "force-dynamic";

export default async function DishesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const dishes = listDishes(q);
  const kids = new Map(listChildren().map((k) => [k.id, k]));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1 mb-0">Dishes</h1>
      <form className="flex gap-2" role="search">
        <input name="q" defaultValue={q} className="input" placeholder="Search dishes or ingredients…" aria-label="Search dishes" />
        <button className="btn">Search</button>
      </form>
      {dishes.length === 0 ? (
        <Empty>{q ? "No dishes match." : "No dishes yet — they appear when you confirm an order form or ingredients list."}</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {dishes.map((d) => (
            <li key={d.id}>
              <Link href={`/dishes/${d.id}`} className="card flex flex-col gap-1 hover:border-brand-300">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{d.canonicalName}</span>
                  <span className="text-xs text-slate-500">
                    {d.orderCount} order{d.orderCount === 1 ? "" : "s"}
                    {d.snapshotCount === 0 && " · no ingredients"}
                  </span>
                </div>
                {d.aliases.length > 0 && <span className="text-xs text-slate-400">also: {d.aliases.join(", ")}</span>}
                <AllergenChips allergens={d.info.allergens} />
                <span className="flex flex-wrap gap-1">
                  {Object.entries(d.info.watch).map(([cid, terms]) => (
                    <WatchFlag key={cid} terms={terms} childName={kids.get(Number(cid))?.name} />
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
