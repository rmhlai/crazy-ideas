"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export function SettingsForm(props: {
  hasApiKey: boolean;
  model: string;
  modelOverride: string;
  envModel: string;
  prior: { a: number; b: number };
}) {
  const router = useRouter();
  const [model, setModel] = useState(props.modelOverride);
  const [a, setA] = useState(String(props.prior.a));
  const [b, setB] = useState(String(props.prior.b));
  const [msg, setMsg] = useState<string | null>(null);
  const [check, setCheck] = useState<{ ok: boolean; message: string } | null>(null);
  const [checking, setChecking] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api("/api/settings", { method: "PUT", json: { model: model || null, priorA: Number(a), priorB: Number(b) } });
      setMsg("Saved.");
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <>
      <section className="card flex flex-col gap-3">
        <h2 className="h2 mb-0">Reading documents (Claude API)</h2>
        <p className="text-sm">
          API key:{" "}
          {props.hasApiKey ? (
            <span className="font-semibold text-emerald-700">set in .env.local</span>
          ) : (
            <span className="font-semibold text-red-700">not set — add ANTHROPIC_API_KEY to .env.local and restart</span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              try {
                setCheck(await api("/api/settings/check", { method: "POST" }));
              } catch (e) {
                setCheck({ ok: false, message: e instanceof Error ? e.message : "Failed" });
              } finally {
                setChecking(false);
              }
            }}
          >
            {checking ? "Checking…" : "Check API key"}
          </button>
          {check && <span className={`text-sm ${check.ok ? "text-emerald-700" : "text-red-700"}`}>{check.message}</span>}
        </div>
      </section>
      <form onSubmit={save} className="card flex flex-col gap-3">
        <div>
          <label className="label" htmlFor="model">
            Model
          </label>
          <input id="model" className="input" placeholder={props.envModel} value={model} onChange={(e) => setModel(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">
            In use: <code>{props.model}</code>. Leave blank to use ANTHROPIC_MODEL ({props.envModel}).
          </p>
        </div>
        <div>
          <p className="label">Ranking prior</p>
          <p className="mb-2 text-xs text-slate-500">score = (👍 + a) / (👍 + 👎 + a + b). Bigger numbers need more ratings before a dish moves up or down.</p>
          <div className="flex gap-3">
            <label className="flex items-center gap-1 text-sm">
              a
              <input type="number" min={0} step="0.5" className="input w-20" value={a} onChange={(e) => setA(e.target.value)} />
            </label>
            <label className="flex items-center gap-1 text-sm">
              b
              <input type="number" min={0} step="0.5" className="input w-20" value={b} onChange={(e) => setB(e.target.value)} />
            </label>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary">Save settings</button>
          {msg && <span className="text-sm text-slate-600">{msg}</span>}
        </div>
      </form>
    </>
  );
}
