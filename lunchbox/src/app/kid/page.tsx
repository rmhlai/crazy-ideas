import Link from "next/link";
import { dayView } from "@/lib/services/days";
import { formatDate, isAwaitingFeedbackDate, todayISO } from "@/lib/dates";
import { listChildren } from "@/lib/services/children";
import { KidButtons } from "@/components/KidButtons";

export const dynamic = "force-dynamic";

export default async function KidMode({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const sp = await searchParams;
  const kids = listChildren();
  const today = todayISO();
  const child = kids.find((k) => String(k.id) === sp.child) ?? (kids.length === 1 ? kids[0] : undefined);

  if (!child) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6">
        <h1 className="text-3xl font-bold">Who&apos;s eating? 😋</h1>
        <div className="flex flex-wrap justify-center gap-4">
          {kids.map((k) => (
            <Link
              key={k.id}
              href={`/kid?child=${k.id}`}
              className="flex h-32 w-32 items-center justify-center rounded-3xl text-2xl font-bold text-white shadow-lg"
              style={{ backgroundColor: k.color }}
            >
              {k.name}
            </Link>
          ))}
        </div>
        <Link href="/" className="text-sm text-slate-400 underline">
          Grown-up view
        </Link>
      </div>
    );
  }

  const v = dayView(today, child.id).children[0];
  const lunch = v?.orders.filter((o) => o.status === "ordered") ?? [];
  const canRate = isAwaitingFeedbackDate(today);
  return (
    <div className="flex min-h-[85vh] flex-col items-center justify-center gap-6 text-center">
      <p className="text-lg font-semibold" style={{ color: child.color }}>
        Hi {child.name}! {formatDate(today, { weekday: "long" })}
      </p>
      {lunch.length === 0 ? (
        <p className="text-3xl font-bold">{v?.state === "no_school" ? "No school today! 🎉" : v?.state === "weekend" ? "It's the weekend! 🎉" : "Lunch from home today 🥪"}</p>
      ) : (
        lunch.map((o) => (
          <div key={o.id} className="flex flex-col items-center gap-6">
            <p className="text-sm uppercase tracking-wide text-slate-500">Today&apos;s lunch</p>
            <p className="text-4xl font-extrabold">{o.dishName}</p>
            {canRate ? (
              <>
                <p className="text-xl">Did you like it?</p>
                <KidButtons orderId={o.id} rating={o.rating} />
              </>
            ) : (
              <p className="text-slate-500">Come back after lunch to tell us how it was!</p>
            )}
          </div>
        ))
      )}
      <div className="mt-8 flex gap-4 text-sm text-slate-400">
        {kids.length > 1 && (
          <Link href="/kid" className="underline">
            Switch kid
          </Link>
        )}
        <Link href="/" className="underline">
          Grown-up view
        </Link>
      </div>
    </div>
  );
}
