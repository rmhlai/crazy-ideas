import Link from "next/link";
import { dayView } from "@/lib/services/days";
import { addDays, formatDate, nextSchoolDay, todayISO } from "@/lib/dates";
import { pendingFeedbackCount } from "@/lib/services/orders";
import { listChanges } from "@/lib/services/uploads";
import { listChildren } from "@/lib/services/children";
import { ChildName, Empty } from "@/components/bits";
import { OrderCard } from "@/components/OrderCard";
import { ChangesCard } from "@/components/ChangesCard";

export const dynamic = "force-dynamic";

function DayColumn({ title, date }: { title: string; date: string }) {
  const view = dayView(date);
  return (
    <section className="card">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        <Link href={`/calendar?month=${date.slice(0, 7)}&day=${date}`} className="text-sm text-slate-500 hover:underline">
          {formatDate(date)}
        </Link>
      </div>
      {view.note && <p className="mb-3 rounded-lg bg-purple-50 px-3 py-2 text-sm text-purple-800">📌 {view.note}</p>}
      <ul className="flex flex-col divide-y divide-slate-100">
        {view.children.map(({ child, orders, state }) => (
          <li key={child.id} className="py-3 first:pt-0 last:pb-0">
            <div className="mb-1">
              <ChildName name={child.name} color={child.color} />
            </div>
            {state === "lunch" &&
              orders
                .filter((o) => o.status === "ordered")
                .map((o) => <OrderCard key={o.id} order={o} />)}
            {state === "no_school" && <p className="text-slate-600">🏫 No school</p>}
            {state === "weekend" && <p className="text-slate-500">Weekend</p>}
            {state === "none" && <p className="font-medium text-amber-700">🥪 No lunch ordered — pack a lunch</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Home() {
  const kids = listChildren();
  const today = todayISO();
  const next = nextSchoolDay(today);
  const pending = pendingFeedbackCount();
  const changes = listChanges({ undismissedOnly: true });
  const tomorrowIsNext = next === addDays(today, 1);

  if (!kids.length) {
    return (
      <div>
        <h1 className="h1">Welcome to LunchBox 🥪</h1>
        <div className="card flex flex-col gap-3">
          <p>Track school lunches, collect 👍/👎 after each one, and see each child&apos;s favourites.</p>
          <ol className="list-decimal pl-5 text-sm text-slate-600">
            <li>Add your children.</li>
            <li>Upload the school&apos;s monthly order form (PDF or a photo).</li>
            <li>Upload the matching ingredients list.</li>
          </ol>
          <div className="flex gap-2">
            <Link href="/children" className="btn-primary">
              Add a child
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1 mb-0">{formatDate(today, { weekday: "long", month: "long", day: "numeric" })}</h1>
        <div className="flex gap-2">
          <Link href="/uploads/new" className="btn">
            ⬆️ Upload
          </Link>
          <Link href="/kid" className="btn">
            😀 Kid mode
          </Link>
        </div>
      </header>

      {pending > 0 && (
        <Link href="/feedback" className="card flex items-center justify-between border-brand-200 bg-brand-50 hover:bg-brand-100">
          <span className="font-semibold text-brand-700">
            {pending} lunch{pending === 1 ? "" : "es"} waiting for a 👍 or 👎
          </span>
          <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-sm font-bold text-white">{pending}</span>
        </Link>
      )}

      <ChangesCard changes={changes} />

      <div className="grid gap-4 md:grid-cols-2">
        <DayColumn title="Today" date={today} />
        <DayColumn title={tomorrowIsNext ? "Tomorrow" : formatDate(next, { weekday: "long" })} date={next} />
      </div>
      {kids.length > 0 && changes.length === 0 && (
        <Empty>
          Tip: tap a day in the <Link href="/calendar" className="underline">calendar</Link> to add or change an order by hand.
        </Empty>
      )}
    </div>
  );
}
