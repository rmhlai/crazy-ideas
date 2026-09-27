import { DEFAULT_MODEL, getModel, getPrior, getSetting, hasApiKey } from "@/lib/services/settings";
import { listChildren } from "@/lib/services/children";
import { dataDir } from "@/lib/db";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const kids = listChildren();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1 mb-0">Settings</h1>
      <SettingsForm
        hasApiKey={hasApiKey()}
        model={getModel()}
        modelOverride={getSetting("model") ?? ""}
        envModel={process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL}
        prior={getPrior()}
      />
      <section className="card flex flex-col gap-3">
        <h2 className="h2 mb-0">Export & backup</h2>
        <p className="text-sm text-slate-500">
          Everything lives in <code className="rounded bg-slate-100 px-1">{dataDir()}</code> — copying that folder is a full backup.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export/backup" className="btn">
            ⬇️ Download backup (.zip)
          </a>
          <a href="/api/export/csv" className="btn">
            ⬇️ Orders & feedback (.csv)
          </a>
        </div>
        <div>
          <p className="label">Calendar (.ics)</p>
          <div className="flex flex-wrap gap-2">
            <a href="/api/export/ics" className="btn">
              Everyone
            </a>
            {kids.map((k) => (
              <a key={k.id} href={`/api/export/ics?child=${k.id}`} className="btn">
                {k.name}
              </a>
            ))}
          </div>
        </div>
      </section>
      <section className="card text-sm text-slate-600">
        <h2 className="h2">Phone access</h2>
        {process.env.ALLOW_LAN === "true" ? (
          <p>LAN access is on — open this computer&apos;s IP address and port on your phone, then “Add to Home Screen”.</p>
        ) : (
          <p>
            LunchBox only listens on this computer. To use it from a phone on your home Wi-Fi, set <code>ALLOW_LAN=true</code> in{" "}
            <code>.env.local</code> and restart.
          </p>
        )}
      </section>
    </div>
  );
}
