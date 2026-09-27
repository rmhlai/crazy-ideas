import { spendingByMonth } from "@/lib/services/orders";
import { listChildren } from "@/lib/services/children";
import { formatCents, formatMonth } from "@/lib/dates";
import { ChildName, Empty } from "@/components/bits";

export const dynamic = "force-dynamic";

export default function SpendingPage() {
  const rows = spendingByMonth();
  const kids = listChildren(true);
  const months = [...new Set(rows.map((r) => r.month))];
  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1 mb-0">Spending</h1>
      {months.length === 0 ? (
        <Empty>No lunches yet. Prices come from the order form when it lists them.</Empty>
      ) : (
        months.map((m) => {
          const mine = rows.filter((r) => r.month === m);
          const total = mine.reduce((s, r) => s + Number(r.cents), 0);
          const unpriced = mine.reduce((s, r) => s + Number(r.unpriced), 0);
          return (
            <section key={m} className="card">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="h2 mb-0">{formatMonth(m)}</h2>
                <span className="text-lg font-bold">{formatCents(total)}</span>
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {mine.map((r) => {
                  const k = kids.find((c) => c.id === r.childId);
                  return (
                    <li key={r.childId} className="flex items-center justify-between">
                      {k ? <ChildName name={k.name} color={k.color} /> : "?"}
                      <span>
                        {r.lunches} lunches · <strong>{formatCents(Number(r.cents))}</strong>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {unpriced > 0 && <p className="mt-2 text-xs text-slate-400">{unpriced} lunch(es) had no price on the form and aren&apos;t counted.</p>}
            </section>
          );
        })
      )}
    </div>
  );
}
