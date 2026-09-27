"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { api } from "@/lib/client";

/**
 * 👍 / 👎 — one tap saves; tapping the other thumb switches; tapping the same one clears.
 * After a tap an optional note field opens.
 */
export function FeedbackButtons({
  orderId,
  rating: initialRating,
  note: initialNote,
  size = "lg",
  onChange,
}: {
  orderId: number;
  rating: number | null;
  note?: string | null;
  size?: "lg" | "sm";
  onChange?: (rating: number | null) => void;
}) {
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(initialRating);
  const [note, setNote] = useState(initialNote ?? "");
  const [showNote, setShowNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function tap(v: 1 | -1) {
    const next = rating === v ? null : v;
    const prev = rating;
    setRating(next);
    setError(null);
    setSaving(true);
    try {
      await api(`/api/orders/${orderId}/feedback`, { method: "PUT", json: { rating: next } });
      setShowNote(next !== null);
      onChange?.(next);
      startTransition(() => router.refresh());
    } catch (e) {
      setRating(prev);
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function saveNote() {
    if (rating === null) return;
    setSaving(true);
    try {
      await api(`/api/orders/${orderId}/feedback`, { method: "PUT", json: { rating, note } });
      setShowNote(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const big = size === "lg";
  const base = `rounded-2xl border-2 transition active:scale-95 ${big ? "h-14 w-16 text-3xl" : "h-9 w-11 text-lg"}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Thumbs up"
          aria-pressed={rating === 1}
          disabled={saving}
          onClick={() => tap(1)}
          className={`${base} ${rating === 1 ? "border-emerald-500 bg-emerald-100" : "border-slate-200 bg-white opacity-80 hover:opacity-100"}`}
        >
          👍
        </button>
        <button
          type="button"
          aria-label="Thumbs down"
          aria-pressed={rating === -1}
          disabled={saving}
          onClick={() => tap(-1)}
          className={`${base} ${rating === -1 ? "border-red-400 bg-red-100" : "border-slate-200 bg-white opacity-80 hover:opacity-100"}`}
        >
          👎
        </button>
        {rating !== null && !showNote && (
          <button type="button" className="text-xs text-slate-500 underline" onClick={() => setShowNote(true)}>
            {note ? "Edit note" : "Add note"}
          </button>
        )}
      </div>
      {note && !showNote && <p className="text-xs italic text-slate-500">“{note}”</p>}
      {showNote && rating !== null && (
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Optional note (e.g. ‘too spicy’)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveNote()}
            aria-label="Feedback note"
          />
          <button type="button" className="btn" disabled={saving} onClick={saveNote}>
            Save
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
