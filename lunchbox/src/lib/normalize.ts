import { distance } from "fastest-levenshtein";

/** Words that carry no meaning when comparing dish names. */
const FILLER = new Set(["with", "w", "and", "n", "the", "a", "of", "served", "on"]);

/** Tokens of a normalized name (lowercase, no punctuation, no filler words). */
export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/&/g, " and ")
    .replace(/\bw\//g, " with ")
    .replace(/['’]/g, "") // "Mac 'n' cheese" -> "mac n cheese"
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t && !FILLER.has(t));
}

/** Lowercase, trim, collapse whitespace, strip punctuation, drop filler words. */
export function normalizeName(name: string): string {
  return nameTokens(name).join(" ");
}

/** Normalized tokens sorted alphabetically, for word-order-insensitive comparison. */
export function tokenSortedName(name: string): string {
  return nameTokens(name).sort().join(" ");
}

/** 0..1 Levenshtein similarity. */
export function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - distance(a, b) / max;
}

/** Best of plain-normalized and token-sorted similarity. */
export function nameSimilarity(a: string, b: string): number {
  return Math.max(
    similarity(normalizeName(a), normalizeName(b)),
    similarity(tokenSortedName(a), tokenSortedName(b)),
  );
}

export const FUZZY_THRESHOLD = 0.85;

export type MatchCandidate = {
  dishId: number;
  /** dish canonical name or an alias */
  name: string;
  canonicalName: string;
};

export type MatchResult =
  | { kind: "exact"; dishId: number; canonicalName: string; via: string }
  | { kind: "fuzzy"; dishId: number; canonicalName: string; via: string; score: number }
  | { kind: "new"; suggestions: { dishId: number; canonicalName: string; score: number }[] };

/**
 * Match an extracted dish name against known dishes and aliases.
 * exact normalized match -> auto-link; token-sorted similarity >= 0.85 -> suggestion; else new.
 */
export function matchDishName(name: string, candidates: MatchCandidate[]): MatchResult {
  const norm = normalizeName(name);
  const exact = candidates.find((c) => normalizeName(c.name) === norm);
  if (exact && norm) {
    return { kind: "exact", dishId: exact.dishId, canonicalName: exact.canonicalName, via: exact.name };
  }
  // best score per dish
  const best = new Map<number, { score: number; via: string; canonicalName: string }>();
  for (const c of candidates) {
    const score = nameSimilarity(name, c.name);
    const prev = best.get(c.dishId);
    if (!prev || score > prev.score) best.set(c.dishId, { score, via: c.name, canonicalName: c.canonicalName });
  }
  const ranked = [...best.entries()]
    .map(([dishId, v]) => ({ dishId, ...v }))
    .sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (top && top.score >= FUZZY_THRESHOLD) {
    return { kind: "fuzzy", dishId: top.dishId, canonicalName: top.canonicalName, via: top.via, score: round(top.score) };
  }
  return {
    kind: "new",
    suggestions: ranked
      .slice(0, 3)
      .filter((r) => r.score >= 0.5)
      .map((r) => ({ dishId: r.dishId, canonicalName: r.canonicalName, score: round(r.score) })),
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
