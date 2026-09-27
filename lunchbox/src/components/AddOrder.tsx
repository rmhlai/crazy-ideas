"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { DishPicker } from "./DishPicker";

export function AddOrder({
  date,
  kids,
  defaultChildId,
}: {
  date: string;
  kids: { id: number; name: string }[];
  defaultChildId?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [childId, setChildId] = useState(defaultChildId ?? kids[0]?.id);
  const [dish, setDish] = useState<{ dishId?: number; dishName?: string }>({});
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!kids.length) return null;
  if (!open) {
    return (
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        + Add order
      </button>
    );
  }
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/orders", { method: "POST", json: { childId, date, ...dish, quantity: qty } });
      setOpen(false);
      setDish({});
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-2 sm:grid-cols-[140px_1fr_70px]">
        <div>
          <label className="label" htmlFor="add-child">
            Child
          </label>
          <select id="add-child" className="input" value={childId} onChange={(e) => setChildId(Number(e.target.value))}>
            {kids.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Dish</label>
          <DishPicker date={date} value={dish} onChange={setDish} />
        </div>
        <div>
          <label className="label" htmlFor="add-qty">
            Qty
          </label>
          <input id="add-qty" type="number" min={1} className="input" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-primary" disabled={busy || (!dish.dishId && !dish.dishName?.trim())} onClick={save}>
          Add
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function NoSchoolToggle({ date, noSchool }: { date: string; noSchool: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/api/days/${date}`, { method: "PUT", json: { noSchool: !noSchool } });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {noSchool ? "Mark as a school day" : "Mark no school"}
    </button>
  );
}
