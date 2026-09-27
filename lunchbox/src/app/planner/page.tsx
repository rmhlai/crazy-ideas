import Link from "next/link";
import { planMonth, monthsWithOfferings } from "@/lib/services/planner";
import { formatDate, formatMonth, isValidMonth, upcomingMonth } from "@/lib/dates";
import { ChildDot, Empty, WatchFlag } from "@/components/bits";
import { CopyButton, PrintButton } from "@/components/CopyButton";

export const dynamic = "force-dynamic";

export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const months = monthsWithOfferings();
  const month = isValidMonth(sp.month) ? sp.month! : months.includes(upcomingMonth()) ? upcomingMonth() : (months[0] ?? upcomingMonth());
  const plan = planMonth(month);
  const kidName = new Map(plan.children.map((k) => [k.id, k]));

  const summary = [
    `Lunch picks — ${formatMonth(month)}`,
    ...plan.days.map((d) => {
      if (d.noService) return `${formatDate(d.date)}: no service${d.note ? ` (${d.note})` : ""}`;
      const picks = d.suggestions
        .map((s) => `${kidName.get(s.childId)?.name}: ${s.pick ? `${s.pick.label ? s.pick.label + " – " : ""}${s.pick.dishName}` : "pack a lunch"}`)
        .join("; ");
      return `${formatDate(d.date)}: ${picks}`;
    }),
  ].join("\n");

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1 mb-0">Plan {formatMonth(month)}</h1>
        <div className="no-print flex flex-wrap gap-2">
          {months.length > 1 &&
            months.slice(0, 4).map((m) => (
              <Link key={m} href={`/planner?month=${m}`} className={`chip px-3 py-1 ${m === month ? "bg-slate-800 text-white" : ""}`}>
                {formatMonth(m)}
              </Link>
            ))}
        </div>
      </header>
      {plan.days.length === 0 ? (
        <Empty>
          Upload next month&apos;s blank order form (the menu) and the options will show here with each child&apos;s ratings.{" "}
          <Link href="/uploads/new" className="underline">
            Upload a form
          </Link>
        </Empty>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            Suggestions pick each child&apos;s best-rated option and skip anything on their watch-list. Unrated dishes count as neutral (
            {plan.neutral.toFixed(2)}). LunchBox never submits orders to the school.
          </p>
          <div className="no-print flex gap-2">
            <CopyButton text={summary} />
            <PrintButton />
          </div>
          <ul className="flex flex-col gap-3">
            {plan.days.map((d) => (
              <li key={d.date} className="card break-inside-avoid">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 className="font-semibold">{formatDate(d.date, { weekday: "long", month: "short", day: "numeric" })}</h2>
                  {d.note && <span className="text-sm text-purple-700">{d.note}</span>}
                </div>
                {d.noService ? (
                  <p className="text-sm text-slate-500">No lunch service</p>
                ) : (
                  <>
                    <ul className="flex flex-col gap-2">
                      {d.options.map((o) => (
                        <li key={o.id} className="flex flex-col gap-1 border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {o.optionLabel && <span className="font-bold text-slate-400">{o.optionLabel}</span>}
                            <Link href={`/dishes/${o.dishId}`} className="font-medium hover:underline">
                              {o.dishName}
                            </Link>
                            {o.isNew && <span className="chip bg-blue-100 text-blue-800">new dish</span>}
                            {o.priceCents != null && <span className="text-xs text-slate-400">${(o.priceCents / 100).toFixed(2)}</span>}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs">
                            {o.perChild.map((pc) => (
                              <span key={pc.childId} className="inline-flex items-center gap-1">
                                <ChildDot color={kidName.get(pc.childId)?.color ?? "#999"} size={8} />
                                {pc.ups + pc.downs > 0 ? `${pc.ups}👍 ${pc.downs}👎` : "unrated"}
                                <WatchFlag terms={pc.watch} />
                              </span>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2 rounded-lg bg-brand-50 p-2 text-sm">
                      {d.suggestions.map((s) => (
                        <span key={s.childId} className="inline-flex items-center gap-1">
                          <ChildDot color={kidName.get(s.childId)?.color ?? "#999"} />
                          <strong>{kidName.get(s.childId)?.name}:</strong>
                          {s.ordered.length ? (
                            <span className="text-emerald-700">ordered {s.ordered.join(", ")}</span>
                          ) : s.pick ? (
                            <span>
                              {s.pick.label ? `${s.pick.label} – ` : ""}
                              {s.pick.dishName}
                            </span>
                          ) : (
                            <span className="text-amber-700">pack a lunch</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
