"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export function UploadForm({ initialKind }: { initialKind: "order_form" | "ingredients" }) {
  const router = useRouter();
  const [kind, setKind] = useState(initialKind);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("kind", kind);
    for (const f of files) fd.append("files", f);
    try {
      const u = await api<{ id: number }>("/api/uploads", { method: "POST", body: fd });
      router.push(`/uploads/${u.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4">
      <fieldset>
        <legend className="label">What is it?</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["order_form", "📝 Order form", "The monthly form with what you ordered"],
              ["ingredients", "🧾 Ingredients list", "The vendor's ingredients / allergen sheet"],
            ] as const
          ).map(([k, title, sub]) => (
            <label
              key={k}
              className={`cursor-pointer rounded-xl border-2 p-3 ${kind === k ? "border-brand-500 bg-brand-50" : "border-slate-200"}`}
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              <span className="block font-semibold">{title}</span>
              <span className="text-xs text-slate-500">{sub}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="files">
          Files (PDF, JPG, PNG or HEIC — several photos of one form are fine)
        </label>
        <input
          id="files"
          type="file"
          multiple
          accept="application/pdf,image/*,.heic,.heif"
          onChange={(e) => setFiles([...(e.target.files ?? [])])}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium"
        />
        {files.length > 0 && (
          <ul className="mt-2 text-xs text-slate-500">
            {files.map((f) => (
              <li key={f.name}>
                {f.name} · {(f.size / 1024).toFixed(0)} KB
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="submit" className="btn-primary self-start" disabled={!files.length || busy}>
        {busy ? "Uploading…" : "Upload & read"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-slate-400">
        Only the document itself is sent to Claude to read it. Children&apos;s names you&apos;ve entered in LunchBox stay on this computer.
      </p>
    </form>
  );
}
