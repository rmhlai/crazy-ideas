"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export function KidButtons({ orderId, rating }: { orderId: number; rating: number | null }) {
  const router = useRouter();
  const [r, setR] = useState(rating);
  async function tap(v: 1 | -1) {
    const next = r === v ? null : v;
    setR(next);
    await api(`/api/orders/${orderId}/feedback`, { method: "PUT", json: { rating: next } }).catch(() => setR(r));
    router.refresh();
  }
  const cls = "flex h-36 w-36 items-center justify-center rounded-full text-7xl shadow-lg transition active:scale-90";
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-8">
        <button type="button" aria-label="I liked it" onClick={() => tap(1)} className={`${cls} ${r === 1 ? "bg-emerald-300 ring-8 ring-emerald-200" : "bg-white"}`}>
          😀
        </button>
        <button type="button" aria-label="I didn't like it" onClick={() => tap(-1)} className={`${cls} ${r === -1 ? "bg-red-300 ring-8 ring-red-200" : "bg-white"}`}>
          🙁
        </button>
      </div>
      {r !== null && <p className="text-2xl font-bold">Thanks! {r === 1 ? "Yum!" : "Got it."}</p>}
    </div>
  );
}
