"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import type { MatchResult } from "@/lib/normalize";
import type { IngredientsExtraction } from "@/lib/extraction/types";
import { formatIngredients, parseIngredientText, parseList } from "@/lib/ingredients";
import { formatMonth, isValidMonth } from "@/lib/dates";
import { confidenceClass, decisionsForSubmit, DishMatchPanel, useDishList, useDishMatching } from "./shared";

type Row = {
  key: string;
  dish_name: string;
  raw_text: string;
  ingredientsText: string;
  allergensText: string;
  confidence: "high" | "medium" | "low";
};

type Preview = {
  dishName: string;
  dishId: number | null;
  fromMonth: string | null;
  diff: { added: string[]; removed: string[]; allergensAdded: string[]; allergensRemoved: string[] };
  watchAlerts: { childId: number; childName: string; terms: string[] }[];
}[];

let seq = 0;
const k = () => `i${++seq}`;

export function IngredientsEditor({
  uploadId,
  initial,
  initialMatches,
  defaultMonth,
  confirmed,
}: {
  uploadId: number;
  initial: IngredientsExtraction;
  initialMatches: Record<string, MatchResult>;
  defaultMonth: string;
  confirmed: boolean;
}) {
  const router = useRouter();
  const [month, setMonth] = useState(initial.effective_month ?? defaultMonth);
  const [vendor, setVendor] = useState(initial.vendor ?? "");
  const [rows, setRows] = useState<Row[]>(() =>
    initial.dishes.map((d) => ({
      key: k(),
      dish_name: d.dish_name,
      raw_text: d.raw_text,
      ingredientsText: formatIngredients(d.ingredients),
      allergensText: d.declared_allergens.join(", "),
      confidence: d.confidence,
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const names = useMemo(() => rows.map((r) => r.dish_name.trim()).filter(Boolean), [rows]);
  const { matches, decisions, setDecisions } = useDishMatching(names, initialMatches);
  const dishes = useDishList();

  const extraction = useMemo<IngredientsExtraction>(
    () => ({
      vendor: vendor.trim() || null,
      effective_month: isValidMonth(month) ? month : null,
      warnings: initial.warnings,
      dishes: rows
        .filter((r) => r.dish_name.trim())
        .map((r) => ({
          dish_name: r.dish_name.trim(),
          raw_text: r.raw_text,
          ingredients: parseIngredientText(r.ingredientsText).map((i) => ({ name: i.name, sub_ingredients: i.sub_ingredients ?? [] })),
          declared_allergens: parseList(r.allergensText).map((a) => a.toLowerCase()),
          confidence: r.confidence,
        })),
    }),
    [vendor, month, rows, initial.warnings],
  );
  const submitDecisions = useMemo(() => decisionsForSubmit(names, decisions), [names, decisions]);

  // "3 dishes changed since September" — computed before anything is saved.
  useEffect(() => {
    const t = setTimeout(() => {
      api<Preview>(`/api/uploads/${uploadId}/preview`, { method: "POST", json: { extraction, dishDecisions: submitDecisions } })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 600);
    return () => clearTimeout(t);
  }, [uploadId, extraction, submitDecisions]);

  const undecided = [...new Set(names)].filter((n) => decisions[n]?.action === "undecided");
  const problems: string[] = [];
  if (!isValidMonth(month)) problems.push("Choose the month this list applies to.");
  if (undecided.length) problems.push(`Confirm or reject ${undecided.length} suggested dish match${undecided.length === 1 ? "" : "es"}.`);

  const upd = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await api(`/api/uploads/${uploadId}/confirm`, { method: "POST", json: { extraction, dishDecisions: submitDecisions } });
      router.replace(`/uploads/${uploadId}?saved=${encodeURIComponent(JSON.stringify(res))}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const alerts = preview?.filter((p) => p.watchAlerts.length) ?? [];
  const since = preview?.[0]?.fromMonth;

  return (
    <div className="flex flex-col gap-4">
      {initial.warnings.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">The reader flagged:</p>
          <ul className="list-disc pl-5">
            {initial.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <section className="card grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="eff-month">
            Applies to month
          </label>
          <input
            id="eff-month"
            type="month"
            className={`input ${!initial.effective_month ? "border-amber-400 bg-amber-50" : ""}`}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          {!initial.effective_month && <p className="mt-1 text-xs text-amber-700">No month printed — please check.</p>}
        </div>
        <div>
          <label className="label" htmlFor="ing-vendor">
            Vendor
          </label>
          <input id="ing-vendor" className="input" value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </div>
      </section>

      {alerts.map((p) => (
        <div key={`al-${p.dishName}`} role="alert" className="rounded-2xl border-2 border-red-500 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-bold">⚠️ {p.dishName}: watched ingredient added</p>
          {p.watchAlerts.map((a) => (
            <p key={a.childId}>
              {a.childName} watches {a.terms.join(", ")}
            </p>
          ))}
        </div>
      ))}

      {preview && preview.length > 0 && (
        <section className="card border-blue-200 bg-blue-50">
          <h2 className="h2">
            {preview.length} dish{preview.length === 1 ? "" : "es"} changed{since ? ` since ${formatMonth(since)}` : ""}
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {preview.map((p) => (
              <li key={p.dishName}>
                <span className="font-semibold">{p.dishName}</span>{" "}
                {p.diff.added.map((a) => (
                  <span key={a} className="chip mr-1 bg-emerald-100 text-emerald-800">
                    + {a}
                  </span>
                ))}
                {p.diff.removed.map((a) => (
                  <span key={a} className="chip mr-1 line-through">
                    {a}
                  </span>
                ))}
                {p.diff.allergensAdded.map((a) => (
                  <span key={a} className="chip mr-1 bg-amber-100 text-amber-900">
                    + allergen {a}
                  </span>
                ))}
                {p.diff.allergensRemoved.map((a) => (
                  <span key={a} className="chip mr-1 line-through">
                    allergen {a}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="h2 mb-0">Dishes ({rows.length})</h2>
          <button
            type="button"
            className="btn"
            onClick={() => setRows((rs) => [...rs, { key: k(), dish_name: "", raw_text: "", ingredientsText: "", allergensText: "", confidence: "high" }])}
          >
            + Add dish
          </button>
        </div>
        {rows.map((r) => (
          <div key={r.key} className={`card flex flex-col gap-2 border-2 ${confidenceClass(r.confidence)}`}>
            <div className="flex items-center gap-2">
              <input
                className="input font-semibold"
                aria-label="Dish name"
                value={r.dish_name}
                onChange={(e) => upd(r.key, { dish_name: e.target.value })}
              />
              {r.confidence !== "high" && <span className="chip bg-amber-100 text-amber-900">{r.confidence} confidence</span>}
              <button
                type="button"
                aria-label="Remove dish"
                className="text-slate-400 hover:text-red-600"
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
              >
                ✕
              </button>
            </div>
            <label className="label mb-0" htmlFor={`ing-${r.key}`}>
              Ingredients — use (parentheses) for sub-ingredients
            </label>
            <textarea
              id={`ing-${r.key}`}
              className="input min-h-20"
              value={r.ingredientsText}
              onChange={(e) => upd(r.key, { ingredientsText: e.target.value, confidence: "high" })}
            />
            <label className="label mb-0" htmlFor={`al-${r.key}`}>
              Declared allergens
            </label>
            <input
              id={`al-${r.key}`}
              className="input"
              placeholder="wheat, milk, soy"
              value={r.allergensText}
              onChange={(e) => upd(r.key, { allergensText: e.target.value })}
            />
            <details className="text-xs text-slate-500">
              <summary>As printed</summary>
              <textarea
                className="input mt-1 min-h-16"
                aria-label="Ingredients as printed"
                value={r.raw_text}
                onChange={(e) => upd(r.key, { raw_text: e.target.value })}
              />
            </details>
          </div>
        ))}
      </section>

      <DishMatchPanel names={names} matches={matches} decisions={decisions} setDecisions={setDecisions} dishes={dishes} />

      <div className="sticky bottom-20 z-10 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        {problems.length > 0 && (
          <ul className="text-xs text-amber-800">
            {problems.map((p) => (
              <li key={p}>• {p}</li>
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="button" className="btn-primary" disabled={busy || problems.length > 0} onClick={submit}>
          {busy ? "Saving…" : confirmed ? "Save changes" : `Confirm ${rows.length} dish${rows.length === 1 ? "" : "es"}`}
        </button>
      </div>
    </div>
  );
}
