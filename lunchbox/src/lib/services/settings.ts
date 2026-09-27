import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { DEFAULT_PRIOR, type Prior } from "../ranking";

export const DEFAULT_MODEL = "claude-sonnet-5";

export function getSetting(key: string): string | undefined {
  const row = getDb().select().from(schema.setting).where(eq(schema.setting.key, key)).get();
  return row?.value;
}

export function setSetting(key: string, value: string | null) {
  const db = getDb();
  if (value == null || value === "") {
    db.delete(schema.setting).where(eq(schema.setting.key, key)).run();
    return;
  }
  db.insert(schema.setting)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.setting.key, set: { value } })
    .run();
}

export function getPrior(): Prior {
  const a = Number(getSetting("ranking_prior_a"));
  const b = Number(getSetting("ranking_prior_b"));
  return {
    a: Number.isFinite(a) && a >= 0 && getSetting("ranking_prior_a") != null ? a : DEFAULT_PRIOR.a,
    b: Number.isFinite(b) && b >= 0 && getSetting("ranking_prior_b") != null ? b : DEFAULT_PRIOR.b,
  };
}

/** Settings override > ANTHROPIC_MODEL env > default. */
export function getModel(): string {
  return getSetting("model") || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

export function hasApiKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}
