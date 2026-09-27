"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export function RenameDish({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  if (!open)
    return (
      <button type="button" className="text-xs text-slate-500 underline" onClick={() => setOpen(true)}>
        Rename
      </button>
    );
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <input className="input max-w-sm" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Dish name" />
      <button
        type="button"
        className="btn-primary"
        onClick={async () => {
          try {
            await api(`/api/dishes/${id}`, { method: "PATCH", json: { name: value } });
            setOpen(false);
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
          }
        }}
      >
        Save
      </button>
      <button type="button" className="btn" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
