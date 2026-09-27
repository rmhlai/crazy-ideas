/** "Dishes containing X are usually thumbs down" — pure computation. */

export type RatedDish = { dishId: number; ups: number; downs: number; ingredients: string[] };

export type IngredientInsight = {
  ingredient: string;
  dishesWith: number;
  upRateWith: number;
  upRateWithout: number;
  /** upRateWith - upRateWithout; negative = disliked */
  delta: number;
};

export const MIN_DISHES = 3;
export const MIN_DELTA = 0.25;

export function ingredientInsights(dishes: RatedDish[], minDishes = MIN_DISHES, minDelta = MIN_DELTA): IngredientInsight[] {
  const rated = dishes.filter((d) => d.ups + d.downs > 0);
  const all = new Set(rated.flatMap((d) => d.ingredients));
  const out: IngredientInsight[] = [];
  for (const ing of all) {
    const withI = rated.filter((d) => d.ingredients.includes(ing));
    const without = rated.filter((d) => !d.ingredients.includes(ing));
    if (withI.length < minDishes || without.length === 0) continue;
    const rate = (ds: RatedDish[]) => {
      const up = ds.reduce((s, d) => s + d.ups, 0);
      const tot = ds.reduce((s, d) => s + d.ups + d.downs, 0);
      return tot ? up / tot : 0;
    };
    const w = rate(withI);
    const wo = rate(without);
    const delta = w - wo;
    if (Math.abs(delta) >= minDelta) {
      out.push({ ingredient: ing, dishesWith: withI.length, upRateWith: w, upRateWithout: wo, delta });
    }
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
