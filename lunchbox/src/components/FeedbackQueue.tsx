"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate } from "@/lib/dates";
import { FeedbackButtons } from "./FeedbackButtons";

type Item = {
  id: number;
  date: string;
  childName: string;
  color: string;
  dishId: number;
  dishName: string;
  rating: number | null;
  note: string | null;
};

/** Keeps rated items on screen (so the note field can open) until the page is reloaded. */
export function FeedbackQueue({ items }: { items: Item[] }) {
  const [list] = useState(items);
  const [rated, setRated] = useState<Record<number, number | null>>({});
  const left = list.filter((i) => rated[i.id] == null).length;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-500" aria-live="polite">
        {left === 0 ? "All caught up! 🎉" : `${left} to rate`}
      </p>
      <ul className="flex flex-col gap-3">
        {list.map((i) => (
          <li
            key={i.id}
            className={`card flex flex-col gap-3 border-l-8 sm:flex-row sm:items-center sm:justify-between ${rated[i.id] != null ? "bg-slate-50" : ""}`}
            style={{ borderLeftColor: i.color }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {i.childName} · {formatDate(i.date)}
              </p>
              <Link href={`/dishes/${i.dishId}`} className="text-lg font-semibold hover:underline">
                {i.dishName}
              </Link>
              {rated[i.id] != null && <p className="text-xs text-emerald-700">Saved ✓</p>}
            </div>
            <FeedbackButtons
              orderId={i.id}
              rating={i.rating}
              note={i.note}
              onChange={(r) => setRated((m) => ({ ...m, [i.id]: r }))}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
