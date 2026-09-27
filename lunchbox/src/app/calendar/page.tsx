import Link from "next/link";
import { addMonths, currentMonth, formatDate, formatMonth, isValidDate, isValidMonth, isWeekend, monthDates, parseISODate, todayISO } from "@/lib/dates";
import { listChildren } from "@/lib/services/children";
import { listDayNotes, listOrders } from "@/lib/services/orders";
import { dayView } from "@/lib/services/days";
import { ChildDot, ChildName, Empty } from "@/components/bits";
import { OrderCard } from "@/components/OrderCard";
import { AddOrder, NoSchoolToggle } from "@/components/AddOrder";

export const dynamic = "force-dynamic";

type SP = Promise<{ month?: string; child?: string; day?: string }>;

export default async function CalendarPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month! : currentMonth();
  const childId = sp.child ? Number(sp.child) : undefined;
  const kids = listChildren();
  const shownKids = kids.filter((k) => !childId || k.id === childId);
  const dates = monthDates(month);
  const orders = listOrders({ from: dates[0], to: dates.at(-1), childId });
  const notes = listDayNotes(dates[0], dates.at(-1)!);
  const today = todayISO();
  const selected = isValidDate(sp.day) ? sp.day! : null;
  const lead = (parseISODate(dates[0]).getDay() + 6) % 7; // Monday-first grid
  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { month, child: childId ? String(childId) : undefined, ...o };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/calendar?${p}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1 mb-0">{formatMonth(month)}</h1>
        <div className="flex gap-2">
          <Link className="btn" href={q({ month: addMonths(month, -1), day: undefined })} aria-label="Previous month">
            ←
          </Link>
          <Link className="btn" href={q({ month: currentMonth(), day: undefined })}>
            Today
          </Link>
          <Link className="btn" href={q({ month: addMonths(month, 1), day: undefined })} aria-label="Next month">
            →
          </Link>
        </div>
      </header>

      {kids.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by child">
          <Link href={q({ child: undefined, day: selected ?? undefined })} className={`chip px-3 py-1 ${!childId ? "bg-slate-800 text-white" : ""}`}>
            Everyone
          </Link>
          {kids.map((k) => (
            <Link key={k.id} href={q({ child: String(k.id), day: selected ?? undefined })} className={`chip gap-1.5 px-3 py-1 ${childId === k.id ? "bg-slate-800 text-white" : ""}`}>
              <ChildDot color={k.color} /> {k.name}
            </Link>
          ))}
        </div>
      )}

      <div className="card p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-400">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: lead }, (_, i) => (
            <div key={`lead${i}`} />
          ))}
          {dates.map((date) => {
            const dayOrders = orders.filter((o) => o.date === date);
            const note = notes.find((n) => n.date === date);
            const weekend = isWeekend(date);
            const noSchool = !!note?.noService;
            const missing = !weekend && !noSchool && shownKids.some((k) => !dayOrders.some((o) => o.childId === k.id && o.status === "ordered"));
            return (
              <Link
                key={date}
                href={q({ day: date })}
                scroll={false}
                aria-label={`${formatDate(date)}${dayOrders.length ? `, ${dayOrders.length} lunches` : ""}${noSchool ? ", no school" : ""}`}
                className={`flex min-h-16 flex-col rounded-lg border p-1 text-left text-xs sm:min-h-20 ${
                  selected === date ? "border-brand-500 ring-2 ring-brand-100" : "border-slate-100"
                } ${weekend ? "bg-slate-50 text-slate-400" : "bg-white"} ${missing && !dayOrders.length ? "border-dashed border-slate-300" : ""}`}
              >
                <span className={`font-semibold ${date === today ? "rounded bg-brand-600 px-1 text-white" : ""} self-start`}>{Number(date.slice(8))}</span>
                {noSchool && <span className="truncate text-[10px] text-purple-700">{note?.note ?? "No school"}</span>}
                <span className="mt-auto flex flex-col gap-0.5">
                  {dayOrders.map((o) => (
                    <span key={o.id} className="flex items-center gap-1 truncate">
                      <ChildDot color={o.color} size={8} />
                      <span className={`hidden truncate sm:inline ${o.status !== "ordered" ? "line-through opacity-60" : ""}`}>{o.dishName}</span>
                      {o.rating === 1 && <span aria-label="liked">👍</span>}
                      {o.rating === -1 && <span aria-label="disliked">👎</span>}
                    </span>
                  ))}
                  {missing && !dayOrders.length && <span className="text-[10px] text-slate-400">no order</span>}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {selected && <DayPanel date={selected} childId={childId} kids={kids} />}
      {!selected && <p className="text-center text-sm text-slate-500">Tap a day to see dishes, ingredients and feedback.</p>}
    </div>
  );
}

function DayPanel({ date, childId, kids }: { date: string; childId?: number; kids: { id: number; name: string }[] }) {
  const v = dayView(date, childId);
  const uploadNoService = v.noService;
  return (
    <section className="card flex flex-col gap-4" id="day">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{formatDate(date, { weekday: "long", month: "long", day: "numeric" })}</h2>
        <NoSchoolToggle date={date} noSchool={uploadNoService} />
      </div>
      {v.note && <p className="rounded-lg bg-purple-50 px-3 py-2 text-sm text-purple-800">📌 {v.note}</p>}
      {v.children.length === 0 && <Empty>No children yet.</Empty>}
      {v.children.map(({ child, orders, state }) => (
        <div key={child.id} className="flex flex-col gap-2 border-t border-slate-100 pt-3 first:border-0 first:pt-0">
          <ChildName name={child.name} color={child.color} />
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} editable />
          ))}
          {state === "none" && <p className="text-sm text-amber-700">No lunch ordered</p>}
          {state === "no_school" && !orders.length && <p className="text-sm text-slate-600">No school</p>}
        </div>
      ))}
      <AddOrder date={date} kids={kids.filter((k) => !childId || k.id === childId)} defaultChildId={childId} />
      {v.offerings.length > 0 && (
        <div>
          <h3 className="label">On the menu</h3>
          <ul className="text-sm text-slate-700">
            {v.offerings.map((o) => (
              <li key={o.id}>
                {o.optionLabel && <span className="mr-1 font-semibold">{o.optionLabel}.</span>}
                <Link href={`/dishes/${o.dishId}`} className="hover:underline">
                  {o.dishName}
                </Link>
                {o.priceCents != null && <span className="ml-1 text-slate-400">${(o.priceCents / 100).toFixed(2)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
