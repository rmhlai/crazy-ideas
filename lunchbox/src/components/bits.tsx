import Link from "next/link";

export function ChildDot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ backgroundColor: color, width: size, height: size }}
    />
  );
}

export function ChildName({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold">
      <ChildDot color={color} />
      {name}
    </span>
  );
}

export function AllergenChips({ allergens }: { allergens: string[] }) {
  if (!allergens.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {allergens.map((a) => (
        <span key={a} className="chip bg-amber-100 text-amber-900">
          {a}
        </span>
      ))}
    </span>
  );
}

/** Watch-list flag; `loud` for prominent warnings. */
export function WatchFlag({ terms, childName, loud }: { terms: string[]; childName?: string; loud?: boolean }) {
  if (!terms.length) return null;
  return (
    <span
      className={
        loud
          ? "inline-flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white"
          : "inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800"
      }
    >
      ⚠️ {childName ? `${childName}: ` : ""}
      {terms.join(", ")}
    </span>
  );
}

export function DishDescription({ description, dishId }: { description: string | null; dishId: number }) {
  if (description) return <p className="text-sm leading-snug text-slate-600">{description}</p>;
  return (
    <p className="text-sm italic text-slate-400">
      No ingredients on file —{" "}
      <Link href="/uploads/new?kind=ingredients" className="text-brand-600 underline">
        upload an ingredients list
      </Link>
      <span className="sr-only"> for dish {dishId}</span>
    </p>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{children}</div>;
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    uploaded: "bg-slate-100 text-slate-700",
    parsing: "bg-blue-100 text-blue-800",
    needs_review: "bg-amber-100 text-amber-900",
    confirmed: "bg-emerald-100 text-emerald-800",
    failed: "bg-red-100 text-red-800",
    ordered: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-slate-200 text-slate-600",
    no_school: "bg-purple-100 text-purple-800",
  };
  return <span className={`chip ${map[status] ?? ""}`}>{status.replace("_", " ")}</span>;
}

export function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.6 ? "bg-emerald-500" : score >= 0.4 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" title={`score ${score.toFixed(2)}`}>
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
