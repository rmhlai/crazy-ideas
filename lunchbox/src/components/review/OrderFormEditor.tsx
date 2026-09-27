"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ApiError, api } from "@/lib/client";
import type { MatchResult } from "@/lib/normalize";
import type { OrderFormExtraction } from "@/lib/extraction/types";
import { daysInMonth, formatDate, formatMonth, isValidMonth } from "@/lib/dates";
import { confidenceClass, decisionsForSubmit, DishMatchPanel, useDishList, useDishMatching } from "./shared";
import type { Kid } from "./ReviewScreen";

type Sel = {
  key: string;
  child_name: string | null;
  child_id: number | "auto";
  dish_name: string;
  quantity: number;
  confidence: "high" | "medium" | "low";
};
type Opt = { key: string; label: string; dish_name: string; price: string };
type Day = { key: string; day_of_month: number; no_service: boolean; note: string; options: Opt[]; selections: Sel[] };

let seq = 0;
const k = () => `k${++seq}`;
const pad = (n: number) => String(n).padStart(2, "0");

function toState(x: OrderFormExtraction): Day[] {
  return x.days.map((d) => ({
    key: k(),
    day_of_month: d.day_of_month || (d.date ? Number(d.date.slice(8)) : 1),
    no_service: d.no_service,
    note: d.note ?? "",
    options: d.options.map((o) => ({ key: k(), label: o.label ?? "", dish_name: o.dish_name, price: o.price == null ? "" : String(o.price) })),
    selections: d.selections.map((s) => ({
      key: k(),
      child_name: s.child_name,
      child_id: (s as { child_id?: number | null }).child_id ?? "auto",
      dish_name: s.dish_name,
      quantity: s.quantity,
      confidence: s.confidence,
    })),
  }));
}

export function OrderFormEditor({
  uploadId,
  initial,
  initialMatches,
  kids,
  defaultMonth,
  confirmed,
}: {
  uploadId: number;
  initial: OrderFormExtraction;
  initialMatches: Record<string, MatchResult>;
  kids: Kid[];
  defaultMonth: string;
  confirmed: boolean;
}) {
  const router = useRouter();
  const [month, setMonth] = useState(initial.month ?? defaultMonth);
  const monthMissing = !initial.month;
  const [vendor, setVendor] = useState(initial.vendor ?? "");
  const [days, setDays] = useState<Day[]>(() => toState(initial));
  const namesOnForm = useMemo(() => {
    const s = new Set(initial.children_named_on_form);
    for (const d of initial.days) for (const x of d.selections) if (x.child_name) s.add(x.child_name);
    return [...s];
  }, [initial]);
  // Guess child mapping locally by name — nothing leaves this computer.
  const [childMap, setChildMap] = useState<Record<string, number | "">>(() =>
    Object.fromEntries(
      namesOnForm.map((n) => [n, kids.find((c) => c.name.trim().toLowerCase() === n.trim().toLowerCase())?.id ?? ""]),
    ),
  );
  const [formChild, setFormChild] = useState<number | "">(() => {
    if (kids.length === 1) return kids[0].id;
    const mapped = namesOnForm.map((n) => kids.find((c) => c.name.toLowerCase() === n.toLowerCase())).filter(Boolean);
    return namesOnForm.length === 1 && mapped[0] ? mapped[0]!.id : "";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<{ orderId: number; date: string; child?: string; dish?: string }[] | null>(null);

  const dishNames = useMemo(
    () =>
      days
        .flatMap((d) => [...d.options.map((o) => o.dish_name.trim()), ...d.selections.map((s) => s.dish_name.trim())])
        .filter(Boolean),
    [days],
  );
  const { matches, decisions, setDecisions } = useDishMatching(dishNames, initialMatches);
  const dishes = useDishList();

  const effectiveChild = (s: Sel): number | "" => {
    if (s.child_id !== "auto") return s.child_id;
    if (s.child_name && childMap[s.child_name]) return childMap[s.child_name];
    return formChild;
  };

  const validMonth = isValidMonth(month);
  const maxDay = validMonth ? daysInMonth(month) : 31;
  const problems: string[] = [];
  if (!validMonth) problems.push("Choose the month this form is for.");
  if (!kids.length) problems.push("Add a child first (Children page).");
  for (const d of days) {
    if (d.day_of_month < 1 || d.day_of_month > maxDay) problems.push(`Day ${d.day_of_month} isn't in ${validMonth ? formatMonth(month) : "this month"}.`);
    if (!d.no_service) {
      for (const s of d.selections) {
        if (!effectiveChild(s)) {
          problems.push(`Choose which child ordered on day ${d.day_of_month} (or use “This whole form is for”).`);
          break;
        }
        if (!s.dish_name.trim()) problems.push(`A selection on day ${d.day_of_month} has no dish.`);
      }
    }
  }
  const undecided = [...new Set(dishNames)].filter((n) => decisions[n]?.action === "undecided");
  if (undecided.length) problems.push(`Confirm or reject ${undecided.length} suggested dish match${undecided.length === 1 ? "" : "es"}.`);
  const uniqProblems = [...new Set(problems)];
  const selectionCount = days.reduce((n, d) => n + (d.no_service ? 0 : d.selections.length), 0);
  const lowCount = days.reduce((n, d) => n + d.selections.filter((s) => s.confidence === "low").length, 0);

  const updDay = (key: string, f: (d: Day) => Day) => setDays((ds) => ds.map((d) => (d.key === key ? f(d) : d)));

  async function submit(keepConflicting = false) {
    setBusy(true);
    setError(null);
    const extraction = {
      month,
      vendor: vendor.trim() || null,
      children_named_on_form: initial.children_named_on_form,
      warnings: initial.warnings,
      days: days
        .slice()
        .sort((a, b) => a.day_of_month - b.day_of_month)
        .map((d) => ({
          date: `${month}-${pad(d.day_of_month)}`,
          day_of_month: d.day_of_month,
          no_service: d.no_service,
          note: d.note.trim() || null,
          options: d.options
            .filter((o) => o.dish_name.trim())
            .map((o) => ({ label: o.label.trim() || null, dish_name: o.dish_name.trim(), price: o.price.trim() === "" ? null : Number(o.price) })),
          selections: d.selections
            .filter((s) => s.dish_name.trim())
            .map((s) => ({
              child_name: s.child_name,
              child_id: effectiveChild(s) || null,
              dish_name: s.dish_name.trim(),
              quantity: Math.max(1, s.quantity),
              confidence: s.confidence,
            })),
        })),
    };
    try {
      const res = await api<Record<string, number>>(`/api/uploads/${uploadId}/confirm`, {
        method: "POST",
        json: { extraction, dishDecisions: decisionsForSubmit(dishNames, decisions), keepConflicting },
      });
      setConflicts(null);
      router.replace(`/uploads/${uploadId}?saved=${encodeURIComponent(JSON.stringify(res))}`);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setConflicts((e.details as { conflicts: typeof conflicts }).conflicts);
      } else setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const optionNames = (d: Day) => [...new Set(d.options.map((o) => o.dish_name).filter(Boolean))];

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
          <label className="label" htmlFor="month">
            Month
          </label>
          <input
            id="month"
            type="month"
            className={`input ${monthMissing ? "border-amber-400 bg-amber-50" : ""}`}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          {monthMissing && <p className="mt-1 text-xs text-amber-700">No month printed on the form — please check.</p>}
        </div>
        <div>
          <label className="label" htmlFor="vendor">
            Vendor
          </label>
          <input id="vendor" className="input" value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="form-child">
            This whole form is for
          </label>
          <select
            id="form-child"
            className="input"
            value={formChild}
            onChange={(e) => setFormChild(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">— choose a child —</option>
            {kids.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">Used for any selection without a child name (you can override per line).</p>
        </div>
        {namesOnForm.length > 0 && (
          <div className="sm:col-span-2">
            <p className="label">Names on the form</p>
            <div className="flex flex-col gap-2">
              {namesOnForm.map((n) => (
                <label key={n} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="max-w-32 truncate font-medium">“{n}”</span> is
                  <select
                    className="input w-auto max-w-full flex-1"
                    value={childMap[n] ?? ""}
                    onChange={(e) => setChildMap((m) => ({ ...m, [n]: e.target.value ? Number(e.target.value) : "" }))}
                  >
                    <option value="">— same as whole form —</option>
                    {kids.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="h2 mb-0">
            Days <span className="text-sm font-normal text-slate-500">({selectionCount} lunches{lowCount ? `, ${lowCount} unsure` : ""})</span>
          </h2>
          <button
            type="button"
            className="btn"
            onClick={() =>
              setDays((ds) => [
                ...ds,
                { key: k(), day_of_month: Math.min(maxDay, (ds.at(-1)?.day_of_month ?? 0) + 1), no_service: false, note: "", options: [], selections: [] },
              ])
            }
          >
            + Add day
          </button>
        </div>
        {days.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">No days yet — add them by hand.</p>
        )}
        {days.map((d) => (
          <div key={d.key} className={`card flex flex-col gap-3 ${d.no_service ? "bg-slate-50" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-sm">
                Day
                <input
                  type="number"
                  min={1}
                  max={maxDay}
                  aria-label="Day of month"
                  className="input w-16"
                  value={d.day_of_month}
                  onChange={(e) => updDay(d.key, (x) => ({ ...x, day_of_month: Number(e.target.value) }))}
                />
              </label>
              <span className="text-sm font-semibold text-slate-600">
                {validMonth && d.day_of_month >= 1 && d.day_of_month <= maxDay ? formatDate(`${month}-${pad(d.day_of_month)}`) : ""}
              </span>
              <label className="ml-auto flex items-center gap-1 text-sm">
                <input type="checkbox" checked={d.no_service} onChange={(e) => updDay(d.key, (x) => ({ ...x, no_service: e.target.checked }))} />
                No lunch service
              </label>
              <button type="button" className="text-xs text-red-600 underline" onClick={() => setDays((ds) => ds.filter((x) => x.key !== d.key))}>
                Remove day
              </button>
            </div>
            <input
              className="input"
              placeholder="Note (e.g. PA Day)"
              aria-label="Day note"
              value={d.note}
              onChange={(e) => updDay(d.key, (x) => ({ ...x, note: e.target.value }))}
            />

            <div>
              <p className="label">Menu options</p>
              <div className="flex flex-col gap-1">
                {d.options.map((o) => (
                  <div key={o.key} className="grid grid-cols-[2.5rem_minmax(0,1fr)_4rem_1.25rem] items-center gap-1">
                    <input
                      className="input"
                      aria-label="Option label"
                      value={o.label}
                      onChange={(e) =>
                        updDay(d.key, (x) => ({ ...x, options: x.options.map((y) => (y.key === o.key ? { ...y, label: e.target.value } : y)) }))
                      }
                    />
                    <input
                      className="input"
                      aria-label="Option dish"
                      value={o.dish_name}
                      onChange={(e) =>
                        updDay(d.key, (x) => ({ ...x, options: x.options.map((y) => (y.key === o.key ? { ...y, dish_name: e.target.value } : y)) }))
                      }
                    />
                    <input
                      className="input"
                      aria-label="Price"
                      inputMode="decimal"
                      placeholder="$"
                      value={o.price}
                      onChange={(e) =>
                        updDay(d.key, (x) => ({ ...x, options: x.options.map((y) => (y.key === o.key ? { ...y, price: e.target.value } : y)) }))
                      }
                    />
                    <button
                      type="button"
                      aria-label="Remove option"
                      className="text-slate-400 hover:text-red-600"
                      onClick={() => updDay(d.key, (x) => ({ ...x, options: x.options.filter((y) => y.key !== o.key) }))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="self-start text-xs font-medium text-brand-600 underline"
                  onClick={() => updDay(d.key, (x) => ({ ...x, options: [...x.options, { key: k(), label: "", dish_name: "", price: "" }] }))}
                >
                  + option
                </button>
              </div>
            </div>

            {!d.no_service && (
              <div>
                <p className="label">Ordered</p>
                <div className="flex flex-col gap-1">
                  {d.selections.map((s) => (
                    <div
                      key={s.key}
                      className={`grid grid-cols-[minmax(0,6rem)_minmax(0,1fr)_3rem_1.25rem] items-center gap-1 rounded-lg border p-1 ${confidenceClass(s.confidence)}`}
                      title={s.confidence !== "high" ? `Reader confidence: ${s.confidence}` : undefined}
                    >
                      <select
                        className="input"
                        aria-label="Child"
                        value={s.child_id}
                        onChange={(e) =>
                          updDay(d.key, (x) => ({
                            ...x,
                            selections: x.selections.map((y) =>
                              y.key === s.key ? { ...y, child_id: e.target.value === "auto" ? "auto" : Number(e.target.value) } : y,
                            ),
                          }))
                        }
                      >
                        <option value="auto">
                          {(() => {
                            const id = effectiveChild({ ...s, child_id: "auto" });
                            return id ? kids.find((c) => c.id === id)?.name : s.child_name ? `“${s.child_name}”?` : "Child?";
                          })()}
                        </option>
                        {kids.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input"
                        aria-label="Ordered dish"
                        list={`opts-${d.key}`}
                        value={s.dish_name}
                        onChange={(e) =>
                          updDay(d.key, (x) => ({
                            ...x,
                            selections: x.selections.map((y) => (y.key === s.key ? { ...y, dish_name: e.target.value, confidence: "high" } : y)),
                          }))
                        }
                      />
                      <input
                        type="number"
                        min={1}
                        className="input"
                        aria-label="Quantity"
                        value={s.quantity}
                        onChange={(e) =>
                          updDay(d.key, (x) => ({
                            ...x,
                            selections: x.selections.map((y) => (y.key === s.key ? { ...y, quantity: Number(e.target.value) } : y)),
                          }))
                        }
                      />
                      <button
                        type="button"
                        aria-label="Remove selection"
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => updDay(d.key, (x) => ({ ...x, selections: x.selections.filter((y) => y.key !== s.key) }))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <datalist id={`opts-${d.key}`}>
                    {optionNames(d).map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    className="self-start text-xs font-medium text-brand-600 underline"
                    onClick={() =>
                      updDay(d.key, (x) => ({
                        ...x,
                        selections: [
                          ...x.selections,
                          { key: k(), child_name: null, child_id: "auto", dish_name: optionNames(x)[0] ?? "", quantity: 1, confidence: "high" },
                        ],
                      }))
                    }
                  >
                    + lunch
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </section>

      <DishMatchPanel names={dishNames} matches={matches} decisions={decisions} setDecisions={setDecisions} dishes={dishes} />

      {conflicts && (
        <div role="alert" className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-sm">
          <p className="font-semibold">These lunches were created by this form before, already have feedback, and aren&apos;t on the form any more:</p>
          <ul className="my-2 list-disc pl-5">
            {conflicts.map((c) => (
              <li key={c.orderId}>
                {c.date} · {c.child} · {c.dish}
              </li>
            ))}
          </ul>
          <p>Keep them (they become manual entries) and save the rest?</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => submit(true)}>
              Keep them & confirm
            </button>
            <button type="button" className="btn" onClick={() => setConflicts(null)}>
              Go back
            </button>
          </div>
        </div>
      )}

      <div className="sticky bottom-20 z-10 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        {uniqProblems.length > 0 && (
          <ul className="text-xs text-amber-800">
            {uniqProblems.map((p) => (
              <li key={p}>• {p}</li>
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="button" className="btn-primary" disabled={busy || uniqProblems.length > 0} onClick={() => submit(false)}>
          {busy ? "Saving…" : confirmed ? "Save changes" : `Confirm ${selectionCount} lunch${selectionCount === 1 ? "" : "es"}`}
        </button>
      </div>
    </div>
  );
}
