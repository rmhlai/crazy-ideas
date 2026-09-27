"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

type Kid = { id: number; name: string; grade: string | null; school: string | null; color: string; watchlist: string[]; active: boolean };

const COLORS = ["#3b82f6", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316"];

function KidForm({ kid, onDone }: { kid?: Kid; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(kid?.name ?? "");
  const [grade, setGrade] = useState(kid?.grade ?? "");
  const [school, setSchool] = useState(kid?.school ?? "");
  const [color, setColor] = useState(kid?.color ?? COLORS[0]);
  const [watch, setWatch] = useState<string[]>(kid?.watchlist ?? []);
  const [term, setTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addTerm = () => {
    const t = term.trim().toLowerCase();
    if (t && !watch.includes(t)) setWatch([...watch, t]);
    setTerm("");
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = { name, grade, school, color, watchlist: term.trim() ? [...watch, term.trim()] : watch };
    try {
      if (kid) await api(`/api/children/${kid.id}`, { method: "PATCH", json: body });
      else await api("/api/children", { method: "POST", json: body });
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor={`name-${kid?.id ?? "new"}`}>
            Name
          </label>
          <input id={`name-${kid?.id ?? "new"}`} className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={`grade-${kid?.id ?? "new"}`}>
            Grade (optional)
          </label>
          <input id={`grade-${kid?.id ?? "new"}`} className="input" value={grade} onChange={(e) => setGrade(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={`school-${kid?.id ?? "new"}`}>
            School (optional)
          </label>
          <input id={`school-${kid?.id ?? "new"}`} className="input" value={school} onChange={(e) => setSchool(e.target.value)} />
        </div>
      </div>
      <fieldset>
        <legend className="label">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full border-4 ${color === c ? "border-slate-800" : "border-white"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor={`watch-${kid?.id ?? "new"}`}>
          Ingredient watch-list
        </label>
        <p className="mb-2 text-xs text-slate-500">
          Allergies, sensitivities or dislikes (e.g. peanut, dairy, mushroom). Dishes containing them are flagged everywhere, and you get
          a warning if one is newly added to a dish.
        </p>
        <div className="mb-2 flex flex-wrap gap-1">
          {watch.map((w) => (
            <span key={w} className="chip gap-1 bg-red-100 text-red-800">
              {w}
              <button type="button" aria-label={`Remove ${w}`} onClick={() => setWatch(watch.filter((x) => x !== w))}>
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            id={`watch-${kid?.id ?? "new"}`}
            className="input"
            placeholder="Add an ingredient"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTerm();
              }
            }}
          />
          <button type="button" className="btn" onClick={addTerm}>
            Add
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          {kid ? "Save" : "Add child"}
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ChildrenManager({ kids }: { kids: Kid[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | "new" | null>(kids.length ? null : "new");
  const active = kids.filter((k) => k.active);
  const archived = kids.filter((k) => !k.active);
  return (
    <div className="flex flex-col gap-3">
      {active.map((k) => (
        <div key={k.id} className="card border-l-8" style={{ borderLeftColor: k.color }}>
          {editing === k.id ? (
            <KidForm kid={k} onDone={() => setEditing(null)} />
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">{k.name}</p>
                <p className="text-sm text-slate-500">{[k.grade && `Grade ${k.grade}`, k.school].filter(Boolean).join(" · ") || "—"}</p>
                {k.watchlist.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {k.watchlist.map((w) => (
                      <span key={w} className="chip bg-red-100 text-red-800">
                        ⚠️ {w}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn" onClick={() => setEditing(k.id)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={async () => {
                    if (!confirm(`Remove ${k.name}? Their lunch history and rankings are kept.`)) return;
                    await api(`/api/children/${k.id}`, { method: "DELETE" });
                    router.refresh();
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      {editing === "new" ? (
        <div className="card">
          <h2 className="h2">Add a child</h2>
          <KidForm onDone={() => setEditing(null)} />
        </div>
      ) : (
        <button type="button" className="btn-primary self-start" onClick={() => setEditing("new")}>
          + Add child
        </button>
      )}
      {archived.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">Removed ({archived.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {archived.map((k) => (
              <li key={k.id} className="flex items-center justify-between text-sm">
                {k.name}
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    await api(`/api/children/${k.id}`, { method: "PATCH", json: { active: true } });
                    router.refresh();
                  }}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
