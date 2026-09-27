import { isWeekend } from "../dates";
import { listChildren } from "./children";
import { listDayNotes, listOfferings, ordersWithInfo } from "./orders";

export type ChildDay = ReturnType<typeof dayView>["children"][number];

/** What's happening on one date, per child. */
export function dayView(date: string, childId?: number) {
  const kids = listChildren().filter((k) => !childId || k.id === childId);
  const orders = ordersWithInfo({ from: date, to: date });
  const notes = listDayNotes(date, date);
  const noService = notes.some((n) => n.noService);
  const note = notes.map((n) => n.note).filter(Boolean).join(" · ") || null;
  return {
    date,
    weekend: isWeekend(date),
    noService,
    note,
    offerings: listOfferings(date, date),
    children: kids.map((k) => {
      const mine = orders.filter((o) => o.childId === k.id);
      const active = mine.filter((o) => o.status === "ordered");
      const noSchool = noService || (mine.length > 0 && mine.every((o) => o.status === "no_school"));
      return {
        child: k,
        orders: mine,
        state: (active.length ? "lunch" : noSchool ? "no_school" : isWeekend(date) ? "weekend" : "none") as
          | "lunch"
          | "no_school"
          | "weekend"
          | "none",
      };
    }),
  };
}
