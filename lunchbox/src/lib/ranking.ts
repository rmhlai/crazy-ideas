/** Smoothed favourite-dish ranking. Pure functions. */

export type Prior = { a: number; b: number };
export const DEFAULT_PRIOR: Prior = { a: 2, b: 2 };

export type DishTally = {
  dishId: number;
  ups: number;
  downs: number;
  /** ISO timestamp of the most recent thumbs-up (or null) */
  lastUpAt: string | null;
};

export type RankedDish = DishTally & { score: number; total: number };

/** score = (ups + a) / (ups + downs + a + b) */
export function smoothedScore(ups: number, downs: number, prior: Prior = DEFAULT_PRIOR): number {
  const denom = ups + downs + prior.a + prior.b;
  return denom === 0 ? 0.5 : (ups + prior.a) / denom;
}

/** Sort by score, then more total ratings, then most recent thumbs-up. */
export function rankDishes(tallies: DishTally[], prior: Prior = DEFAULT_PRIOR): RankedDish[] {
  return tallies
    .map((t) => ({ ...t, total: t.ups + t.downs, score: smoothedScore(t.ups, t.downs, prior) }))
    .sort((x, y) => {
      if (y.score !== x.score) return y.score - x.score;
      if (y.total !== x.total) return y.total - x.total;
      return (y.lastUpAt ?? "").localeCompare(x.lastUpAt ?? "");
    });
}

export const NOT_A_HIT_SCORE = 0.4;

/** Split into favourites / not a hit. Dishes with zero ratings belong in "not rated yet". */
export function categorize(tallies: DishTally[], prior: Prior = DEFAULT_PRIOR) {
  const ranked = rankDishes(
    tallies.filter((t) => t.ups + t.downs > 0),
    prior,
  );
  const notAHit = ranked.filter((r) => r.score < NOT_A_HIT_SCORE && r.total >= 2);
  const hitIds = new Set(notAHit.map((r) => r.dishId));
  const favourites = ranked.filter((r) => !hitIds.has(r.dishId));
  const unrated = tallies.filter((t) => t.ups + t.downs === 0).map((t) => t.dishId);
  return { favourites, notAHit, unrated };
}

/** Merge several children's tallies into one household tally per dish. */
export function mergeTallies(tallies: DishTally[]): DishTally[] {
  const m = new Map<number, DishTally>();
  for (const t of tallies) {
    const prev = m.get(t.dishId);
    if (!prev) m.set(t.dishId, { ...t });
    else {
      prev.ups += t.ups;
      prev.downs += t.downs;
      if ((t.lastUpAt ?? "") > (prev.lastUpAt ?? "")) prev.lastUpAt = t.lastUpAt;
    }
  }
  return [...m.values()];
}
