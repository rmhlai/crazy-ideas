"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { formatMonth } from "@/lib/dates";

export type ChangeItem = {
  id: number;
  dishId: number;
  dishName: string;
  fromMonth: string | null;
  toMonth: string;
  added: string[];
  removed: string[];
  allergensAdded: string[];
  allergensRemoved: string[];
  watchAlerts: { childId: number; childName: string; terms: string[] }[];
};

/** Dismissible "What's changed" summary. Watch-list hits are shown as prominent warnings. */
export function ChangesCard({ changes }: { changes: ChangeItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!changes.length) return null;
  const alerts = changes.filter((c) => c.watchAlerts.length);
  async function dismiss(ids: number[] | "all") {
    setBusy(true);
    try {
      await api("/api/changes/dismiss", { method: "POST", json: { ids } });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="flex flex-col gap-3">
      {alerts.map((c) => (
        <div key={`alert-${c.id}`} role="alert" className="rounded-2xl border-2 border-red-500 bg-red-50 p-4">
          <p className="font-bold text-red-800">
            ⚠️ Watched ingredient added to{" "}
            <Link className="underline" href={`/dishes/${c.dishId}`}>
              {c.dishName}
            </Link>
          </p>
          {c.watchAlerts.map((a) => (
            <p key={a.childId} className="mt-1 text-sm text-red-900">
              <strong>{a.childName}</strong> watches: {a.terms.join(", ")}. New in {formatMonth(c.toMonth)}:{" "}
              {[...c.added, ...c.allergensAdded.map((x) => `${x} (allergen)`)].join(", ")}
            </p>
          ))}
          <button type="button" disabled={busy} className="mt-2 text-xs font-semibold text-red-800 underline" onClick={() => dismiss([c.id])}>
            I&apos;ve seen this
          </button>
        </div>
      ))}
      <div className="card">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="h2 mb-0">What&apos;s changed</h2>
          <button type="button" disabled={busy} className="text-xs font-medium text-slate-500 underline" onClick={() => dismiss(changes.map((c) => c.id))}>
            Dismiss
          </button>
        </div>
        <p className="mb-2 text-sm text-slate-500">
          {changes.length} dish{changes.length === 1 ? "" : "es"} changed ingredients
          {changes[0].fromMonth ? ` since ${formatMonth(changes[0].fromMonth)}` : ""}.
        </p>
        <ul className="flex flex-col gap-2">
          {changes.map((c) => (
            <li key={c.id} className="text-sm">
              <Link href={`/dishes/${c.dishId}`} className="font-semibold hover:underline">
                {c.dishName}
              </Link>
              <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                {c.added.map((a) => (
                  <span key={`a${a}`} className="chip bg-emerald-100 text-emerald-800">
                    + {a}
                  </span>
                ))}
                {c.removed.map((a) => (
                  <span key={`r${a}`} className="chip line-through">
                    {a}
                  </span>
                ))}
                {c.allergensAdded.map((a) => (
                  <span key={`aa${a}`} className="chip bg-amber-100 text-amber-900">
                    + allergen: {a}
                  </span>
                ))}
                {c.allergensRemoved.map((a) => (
                  <span key={`ar${a}`} className="chip line-through">
                    allergen: {a}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
