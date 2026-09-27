import { lt } from "drizzle-orm";
import { getDb, schema } from "../db";
import { monthDates } from "../dates";
import { dishInfo } from "./dishes";
import { listChildren } from "./children";
import { listDayNotes, listOfferings, listOrders } from "./orders";
import { scoreLookup } from "./rankings";
import { getPrior } from "./settings";
import { smoothedScore } from "../ranking";

/**
 * Next-month ordering helper: each day's options annotated with each child's record,
 * watch-list flags and "new dish" badges, plus a suggested pick per child.
 */
export function planMonth(month: string) {
  const db = getDb();
  const from = `${month}-01`;
  const to = monthDates(month).at(-1)!;
  const offerings = listOfferings(from, to);
  const notes = listDayNotes(from, to);
  const kids = listChildren();
  const existing = listOrders({ from, to });
  const scores = scoreLookup();
  const prior = getPrior();
  const neutral = smoothedScore(0, 0, prior);
  const info = dishInfo(offerings.map((o) => o.dishId), db);

  // "new" = never on any menu or order before this month
  const seenBefore = new Set<number>();
  for (const o of db.select({ dishId: schema.menuOffering.dishId }).from(schema.menuOffering).where(lt(schema.menuOffering.date, from)).all())
    seenBefore.add(o.dishId);
  for (const o of db.select({ dishId: schema.orders.dishId }).from(schema.orders).where(lt(schema.orders.date, from)).all())
    seenBefore.add(o.dishId);

  const dates = [...new Set(offerings.map((o) => o.date))].sort();
  const days = dates.map((date) => {
    const opts = offerings
      .filter((o) => o.date === date)
      .map((o) => ({
        ...o,
        isNew: !seenBefore.has(o.dishId),
        description: info.get(o.dishId)?.description ?? null,
        perChild: kids.map((k) => {
          const s = scores.get(k.id)?.get(o.dishId);
          return {
            childId: k.id,
            ups: s?.ups ?? 0,
            downs: s?.downs ?? 0,
            score: s?.score ?? neutral,
            watch: info.get(o.dishId)?.watch[k.id] ?? [],
          };
        }),
      }));
    const note = notes.find((n) => n.date === date);
    const suggestions = kids.map((k) => {
      const already = existing.filter((e) => e.date === date && e.childId === k.id && e.status === "ordered");
      const candidates = opts
        .map((o) => ({ o, pc: o.perChild.find((p) => p.childId === k.id)! }))
        .filter(({ pc }) => pc.watch.length === 0)
        .sort((a, b) => b.pc.score - a.pc.score || b.pc.ups - a.pc.ups);
      const pick = candidates[0];
      return {
        childId: k.id,
        ordered: already.map((a) => a.dishName),
        pick: pick ? { dishId: pick.o.dishId, dishName: pick.o.dishName, label: pick.o.optionLabel, score: pick.pc.score } : null,
      };
    });
    return { date, noService: !!note?.noService, note: note?.note ?? null, options: opts, suggestions };
  });
  return { month, children: kids, days, neutral };
}

/** Months (YYYY-MM) that have menu offerings, newest first. */
export function monthsWithOfferings(): string[] {
  const rows = getDb().select({ date: schema.menuOffering.date }).from(schema.menuOffering).all();
  return [...new Set(rows.map((r) => r.date.slice(0, 7)))].sort().reverse();
}

