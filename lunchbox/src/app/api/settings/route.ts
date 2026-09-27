import { jsonBody, route } from "@/lib/api/handler";
import { DEFAULT_MODEL, getModel, getPrior, getSetting, hasApiKey, setSetting } from "@/lib/services/settings";
import { HttpError } from "@/lib/services/uploads";

function current() {
  return {
    hasApiKey: hasApiKey(),
    model: getModel(),
    modelOverride: getSetting("model") ?? null,
    envModel: process.env.ANTHROPIC_MODEL ?? null,
    defaultModel: DEFAULT_MODEL,
    prior: getPrior(),
    allowLan: process.env.ALLOW_LAN === "true",
  };
}

export const GET = route(() => current());

export const PUT = route(async (req) => {
  const body = await jsonBody<{ model?: string | null; priorA?: number; priorB?: number }>(req);
  if (body.model !== undefined) setSetting("model", body.model?.trim() || null);
  for (const [k, v] of [
    ["ranking_prior_a", body.priorA],
    ["ranking_prior_b", body.priorB],
  ] as const) {
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100) throw new HttpError(400, "Prior must be 0–100");
    setSetting(k, String(v));
  }
  return current();
});
