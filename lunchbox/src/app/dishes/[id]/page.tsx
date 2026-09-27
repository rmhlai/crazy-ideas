import Link from "next/link";
import { notFound } from "next/navigation";
import { getDishDetail } from "@/lib/services/dishes";
import { flattenIngredients, normalizeIngredient } from "@/lib/ingredients";
import { formatDate, formatMonth } from "@/lib/dates";
import { AllergenChips, ChildDot, DishDescription, Empty, WatchFlag } from "@/components/bits";
import { RenameDish } from "@/components/RenameDish";

export const dynamic = "force-dynamic";

export default async function DishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = getDishDetail(Number(id));
  if (!d) notFound();
  return (
    <div className="flex flex-col gap-4">
      <Link href="/dishes" className="text-sm text-slate-500 hover:underline">
        ← Dishes
      </Link>
      <header>
        <h1 className="h1 mb-1">{d.dish.canonicalName}</h1>
        {d.aliases.length > 0 && <p className="text-sm text-slate-500">Also printed as: {d.aliases.map((a) => a.aliasName).join(", ")}</p>}
        <RenameDish id={d.dish.id} name={d.dish.canonicalName} />
      </header>

      {d.watch.length > 0 && (
        <div role="alert" className="flex flex-col gap-1 rounded-2xl border-2 border-red-500 bg-red-50 p-3">
          {d.watch.map((w) => (
            <WatchFlag key={w.child.id} childName={w.child.name} terms={w.terms} loud />
          ))}
        </div>
      )}

      <section className="card flex flex-col gap-2">
        <h2 className="h2 mb-0">What&apos;s in it</h2>
        <DishDescription description={d.info.description} dishId={d.dish.id} />
        <AllergenChips allergens={d.info.allergens} />
      </section>

      <section className="card">
        <h2 className="h2">Ratings</h2>
        {d.ratings.length === 0 ? (
          <p className="text-sm text-slate-500">Never ordered.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {d.ratings.map((r) => (
              <li key={r.childId} className="flex items-center gap-2 text-sm">
                <ChildDot color={r.color} /> <span className="font-medium">{r.name}</span>
                <span className="text-slate-500">
                  {r.ups} 👍 · {r.downs} 👎
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="h2">Ingredient history</h2>
        {d.history.length === 0 ? (
          <Empty>
            No ingredients on file.{" "}
            <Link href="/uploads/new?kind=ingredients" className="underline">
              Upload an ingredients list
            </Link>
          </Empty>
        ) : (
          <ol className="relative flex flex-col gap-4 border-l-2 border-slate-200 pl-4">
            {d.history.map((s) => {
              const added = new Set(s.change?.added ?? []);
              return (
                <li key={s.id}>
                  <p className="text-sm font-semibold">
                    {formatMonth(s.effectiveMonth)}
                    {s.uploadId && (
                      <Link href={`/uploads/${s.uploadId}`} className="ml-2 text-xs font-normal text-slate-400 hover:underline">
                        upload #{s.uploadId}
                      </Link>
                    )}
                  </p>
                  <p className="text-sm leading-relaxed text-slate-700">
                    {s.ingredients.map((ing, i) => {
                      const isNew = added.has(normalizeIngredient(ing.name));
                      return (
                        <span key={i}>
                          {i > 0 && ", "}
                          <span className={isNew ? "rounded bg-emerald-100 px-1 font-semibold text-emerald-800" : ""}>
                            {ing.name}
                            {isNew && <sup className="ml-0.5 text-[9px] font-bold">NEW</sup>}
                          </span>
                          {ing.sub_ingredients && ing.sub_ingredients.length > 0 && (
                            <>
                              {" ("}
                              {ing.sub_ingredients.map((sub, j) => {
                                const subNew = added.has(normalizeIngredient(sub));
                                return (
                                  <span key={j}>
                                    {j > 0 && ", "}
                                    <span className={subNew ? "rounded bg-emerald-100 px-1 font-semibold text-emerald-800" : ""}>
                                      {sub}
                                      {subNew && <sup className="ml-0.5 text-[9px] font-bold">NEW</sup>}
                                    </span>
                                  </span>
                                );
                              })}
                              {")"}
                            </>
                          )}
                        </span>
                      );
                    })}
                  </p>
                  {s.change && s.change.removed.length > 0 && (
                    <p className="mt-1 text-sm text-slate-500">
                      Removed: {s.change.removed.map((r) => <s key={r} className="mr-2">{r}</s>)}
                    </p>
                  )}
                  {s.change && (s.change.allergensAdded.length > 0 || s.change.allergensRemoved.length > 0) && (
                    <p className="mt-1 text-sm">
                      {s.change.allergensAdded.map((a) => (
                        <span key={a} className="chip mr-1 bg-amber-100 text-amber-900">
                          NEW allergen: {a}
                        </span>
                      ))}
                      {s.change.allergensRemoved.map((a) => (
                        <s key={a} className="chip mr-1">
                          {a}
                        </s>
                      ))}
                    </p>
                  )}
                  <AllergenChips allergens={s.allergens} />
                  <details className="mt-1 text-xs text-slate-400">
                    <summary>As printed ({flattenIngredients(s.ingredients).length} ingredients)</summary>
                    <p className="mt-1 whitespace-pre-wrap">{s.rawText || "—"}</p>
                  </details>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="card">
        <h2 className="h2">Dates ordered</h2>
        {d.orders.length === 0 ? (
          <p className="text-sm text-slate-500">Not ordered yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {d.orders.map((o) => (
              <li key={o.id} className="flex items-center gap-2">
                <ChildDot color={o.color} />
                <Link href={`/calendar?month=${o.date.slice(0, 7)}&day=${o.date}`} className="hover:underline">
                  {formatDate(o.date)}
                </Link>
                <span className="text-slate-500">{o.childName}</span>
                {o.status !== "ordered" && <span className="chip">{o.status.replace("_", " ")}</span>}
                {o.rating === 1 && "👍"}
                {o.rating === -1 && "👎"}
                {o.note && <span className="italic text-slate-400">“{o.note}”</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
