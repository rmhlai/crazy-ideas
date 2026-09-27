"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { MatchResult } from "@/lib/normalize";

export type Decision = { action: "link"; dishId: number } | { action: "new"; canonicalName?: string } | { action: "undecided" };
export type DishLite = { id: number; canonicalName: string };

export function defaultDecision(m: MatchResult | undefined): Decision {
  if (!m) return { action: "new" };
  if (m.kind === "exact") return { action: "link", dishId: m.dishId };
  if (m.kind === "fuzzy") return { action: "undecided" };
  return { action: "new" };
}

/** Match results for the current set of dish names, re-queried as names are edited. */
export function useDishMatching(names: string[], initial: Record<string, MatchResult>) {
  const [matches, setMatches] = useState<Record<string, MatchResult>>(initial);
  const [decisions, setDecisions] = useState<Record<string, Decision>>(() =>
    Object.fromEntries(Object.entries(initial).map(([n, m]) => [n, defaultDecision(m)])),
  );
  const key = useMemo(() => [...new Set(names)].sort().join("\u0000"), [names]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const missing = key.split("\u0000").filter((n) => n && !(n in matches));
    if (!missing.length) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await api<Record<string, MatchResult>>("/api/dishes/match", { method: "POST", json: { names: missing } });
        setMatches((m) => ({ ...m, ...res }));
        setDecisions((d) => {
          const next = { ...d };
          for (const [n, m] of Object.entries(res)) if (!(n in next)) next[n] = defaultDecision(m);
          return next;
        });
      } catch {
        /* keep going; server falls back to exact-or-new */
      }
    }, 400);
  }, [key, matches]);

  return { matches, decisions, setDecisions };
}

export function useDishList() {
  const [dishes, setDishes] = useState<DishLite[]>([]);
  useEffect(() => {
    api<DishLite[]>("/api/dishes").then(setDishes).catch(() => {});
  }, []);
  return dishes;
}

export function decisionsForSubmit(names: string[], decisions: Record<string, Decision>) {
  const out: Record<string, { action: "link"; dishId: number } | { action: "new"; canonicalName?: string }> = {};
  for (const n of new Set(names)) {
    const d = decisions[n];
    if (d && d.action !== "undecided") out[n] = d;
  }
  return out;
}

/** Match status + decision controls for each distinct dish name on the upload. */
export function DishMatchPanel({
  names,
  matches,
  decisions,
  setDecisions,
  dishes,
}: {
  names: string[];
  matches: Record<string, MatchResult>;
  decisions: Record<string, Decision>;
  setDecisions: (f: (d: Record<string, Decision>) => Record<string, Decision>) => void;
  dishes: DishLite[];
}) {
  const unique = [...new Set(names)].filter(Boolean).sort();
  const set = (n: string, d: Decision) => setDecisions((all) => ({ ...all, [n]: d }));
  const undecided = unique.filter((n) => (decisions[n] ?? defaultDecision(matches[n])).action === "undecided");
  if (!unique.length) return null;
  return (
    <section className="card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="h2 mb-0">Dish matching</h2>
        {undecided.length > 0 && (
          <button
            type="button"
            className="btn"
            onClick={() =>
              setDecisions((all) => {
                const next = { ...all };
                for (const n of undecided) {
                  const m = matches[n];
                  if (m?.kind === "fuzzy") next[n] = { action: "link", dishId: m.dishId };
                }
                return next;
              })
            }
          >
            Accept all {undecided.length} suggestions
          </button>
        )}
      </div>
      <ul className="flex flex-col divide-y divide-slate-100">
        {unique.map((n) => {
          const m = matches[n];
          const d = decisions[n] ?? defaultDecision(m);
          const linkedName = d.action === "link" ? dishes.find((x) => x.id === d.dishId)?.canonicalName ?? (m && "canonicalName" in m ? m.canonicalName : `#${d.dishId}`) : null;
          return (
            <li key={n} className={`flex flex-col gap-1 py-2 ${d.action === "undecided" ? "rounded-lg bg-amber-50 px-2" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">“{n}”</span>
                {!m && <span className="chip">checking…</span>}
                {m?.kind === "exact" && d.action === "link" && d.dishId === m.dishId && (
                  <span className="chip bg-emerald-100 text-emerald-800">✓ matched</span>
                )}
                {d.action === "undecided" && m?.kind === "fuzzy" && (
                  <span className="chip bg-amber-200 text-amber-900">
                    looks like “{m.canonicalName}” ({Math.round(m.score * 100)}%)
                  </span>
                )}
                {d.action === "new" && <span className="chip bg-blue-100 text-blue-800">new dish</span>}
                {d.action === "link" && !(m?.kind === "exact" && d.dishId === m.dishId) && (
                  <span className="chip bg-emerald-100 text-emerald-800">→ {linkedName}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {m?.kind === "fuzzy" && !(d.action === "link" && d.dishId === m.dishId) && (
                  <button type="button" className="btn py-1" onClick={() => set(n, { action: "link", dishId: m.dishId })}>
                    Same as “{m.canonicalName}”
                  </button>
                )}
                {d.action !== "new" && (
                  <button type="button" className="btn py-1" onClick={() => set(n, { action: "new" })}>
                    It&apos;s a new dish
                  </button>
                )}
                {m?.kind === "new" &&
                  m.suggestions.map((s) =>
                    d.action === "link" && d.dishId === s.dishId ? null : (
                      <button key={s.dishId} type="button" className="btn py-1" onClick={() => set(n, { action: "link", dishId: s.dishId })}>
                        Same as “{s.canonicalName}”?
                      </button>
                    ),
                  )}
                <select
                  aria-label={`Link “${n}” to an existing dish`}
                  className="input w-auto max-w-56 py-1"
                  value={d.action === "link" ? d.dishId : ""}
                  onChange={(e) => e.target.value && set(n, { action: "link", dishId: Number(e.target.value) })}
                >
                  <option value="">Link to existing…</option>
                  {dishes.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.canonicalName}
                    </option>
                  ))}
                </select>
              </div>
              {d.action === "new" && (
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  Save as
                  <input
                    className="input max-w-72 py-1"
                    value={d.canonicalName ?? n}
                    onChange={(e) => set(n, { action: "new", canonicalName: e.target.value })}
                  />
                </label>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function confidenceClass(c: string | undefined) {
  if (c === "low") return "border-amber-400 bg-amber-50";
  if (c === "medium") return "border-yellow-200";
  return "border-slate-200";
}
