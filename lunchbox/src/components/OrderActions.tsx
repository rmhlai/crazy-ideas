"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { DishPicker } from "./DishPicker";

type Props = {
  order: { id: number; dishId: number; dishName: string; quantity: number; status: string; date: string; rating: number | null };
};

/** Change / cancel / restore / delete a single order. */
export function OrderActions({ order }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dish, setDish] = useState<{ dishId?: number; dishName?: string }>({ dishId: order.dishId });
  const [qty, setQty] = useState(order.quantity);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="text-xs font-medium text-slate-500 underline" onClick={() => setOpen(true)}>
        Edit order
      </button>
    );
  }
  return (
    <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_80px]">
        <div>
          <label className="label">Dish</label>
          <DishPicker date={order.date} value={dish} onChange={setDish} />
        </div>
        <div>
          <label className="label" htmlFor={`qty-${order.id}`}>
            Qty
          </label>
          <input id={`qty-${order.id}`} type="number" min={1} className="input" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => run(() => api(`/api/orders/${order.id}`, { method: "PATCH", json: { ...dish, quantity: qty } }))}
        >
          Save
        </button>
        {order.status === "ordered" ? (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => run(() => api(`/api/orders/${order.id}`, { method: "PATCH", json: { status: "cancelled" } }))}
          >
            Cancel lunch
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => run(() => api(`/api/orders/${order.id}`, { method: "PATCH", json: { status: "ordered" } }))}
          >
            Restore
          </button>
        )}
        {order.rating == null && (
          <button
            type="button"
            className="btn-danger"
            disabled={busy}
            onClick={() => confirm("Delete this order?") && run(() => api(`/api/orders/${order.id}`, { method: "DELETE" }))}
          >
            Delete
          </button>
        )}
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
