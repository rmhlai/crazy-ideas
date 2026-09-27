"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type DishLite = { id: number; canonicalName: string };
type Offering = { dishId: number; dishName: string; optionLabel: string | null };

let dishCache: Promise<DishLite[]> | null = null;

/** Pick a dish: that day's menu options first, then any known dish, or type a new one. */
export function DishPicker({
  date,
  value,
  onChange,
  offerings,
}: {
  date?: string;
  value: { dishId?: number; dishName?: string };
  onChange: (v: { dishId?: number; dishName?: string }) => void;
  offerings?: Offering[];
}) {
  const [dishes, setDishes] = useState<DishLite[]>([]);
  const [menu, setMenu] = useState<Offering[]>(offerings ?? []);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    dishCache ??= api<DishLite[]>("/api/dishes");
    dishCache.then(setDishes).catch(() => (dishCache = null));
  }, []);
  useEffect(() => {
    if (offerings || !date) return;
    fetch(`/api/plan?month=${date.slice(0, 7)}`)
      .then((r) => r.json())
      .then((p) => {
        const day = p.days?.find((d: { date: string }) => d.date === date);
        setMenu(day?.options ?? []);
      })
      .catch(() => {});
  }, [date, offerings]);

  if (typing) {
    return (
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="Dish name"
          autoFocus
          value={value.dishName ?? ""}
          onChange={(e) => onChange({ dishName: e.target.value })}
          aria-label="New dish name"
        />
        <button type="button" className="btn" onClick={() => setTyping(false)}>
          List
        </button>
      </div>
    );
  }
  const menuIds = new Set(menu.map((m) => m.dishId));
  return (
    <select
      className="input"
      aria-label="Dish"
      value={value.dishId ?? ""}
      onChange={(e) => {
        if (e.target.value === "__new") {
          setTyping(true);
          onChange({ dishName: "" });
        } else onChange({ dishId: Number(e.target.value) });
      }}
    >
      <option value="" disabled>
        Choose a dish…
      </option>
      {menu.length > 0 && (
        <optgroup label="On the menu that day">
          {menu.map((m) => (
            <option key={`m${m.dishId}`} value={m.dishId}>
              {m.optionLabel ? `${m.optionLabel}: ` : ""}
              {m.dishName}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="All dishes">
        {dishes
          .filter((d) => !menuIds.has(d.id))
          .map((d) => (
            <option key={d.id} value={d.id}>
              {d.canonicalName}
            </option>
          ))}
      </optgroup>
      <option value="__new">+ New dish…</option>
    </select>
  );
}
