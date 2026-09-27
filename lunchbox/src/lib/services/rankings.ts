import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import { categorize, mergeTallies, smoothedScore, type DishTally } from "../ranking";
import { ingredientInsights, type RatedDish } from "../insights";
import { dishInfo, latestSnapshot } from "./dishes";
import { flattenIngredients } from "../ingredients";
import { getPrior } from "./settings";

/** Per-child tallies for every dish that child has had ordered (status = ordered). */
export function talliesByChild(): Map<number, DishTally[]> {
  const db = getDb();
  const rows = db
    .select({
      childId: schema.orders.childId,
      dishId: schema.orders.dishId,
      ups: sql<number>`sum(case when ${schema.feedback.rating} = 1 then 1 else 0 end)`,
      downs: sql<number>`sum(case when ${schema.feedback.rating} = -1 then 1 else 0 end)`,
      lastUpAt: sql<string | null>`max(case when ${schema.feedback.rating} = 1 then ${schema.feedback.updatedAt} end)`,
    })
    .from(schema.orders)
    .leftJoin(schema.feedback, eq(schema.feedback.orderId, schema.orders.id))
    .where(eq(schema.orders.status, "ordered"))
    .groupBy(schema.orders.childId, schema.orders.dishId)
    .all();
  const m = new Map<number, DishTally[]>();
  for (const r of rows) {
    const list = m.get(r.childId) ?? [];
    list.push({ dishId: r.dishId, ups: Number(r.ups), downs: Number(r.downs), lastUpAt: r.lastUpAt });
    m.set(r.childId, list);
  }
  return m;
}

export function getRankings(childId: number | "all") {
  const db = getDb();
  const prior = getPrior();
  const all = talliesByChild();
  const tallies = childId === "all" ? mergeTallies([...all.values()].flat()) : (all.get(childId) ?? []);
  const cat = categorize(tallies, prior);
  const names = new Map(db.select().from(schema.dish).all().map((d) => [d.id, d.canonicalName]));
  const info = dishInfo(tallies.map((t) => t.dishId), db);
  const decorate = <T extends { dishId: number }>(r: T) => ({
    ...r,
    dishName: names.get(r.dishId) ?? "?",
    watch: childId === "all" ? Object.values(info.get(r.dishId)?.watch ?? {}).flat() : (info.get(r.dishId)?.watch[childId] ?? []),
  });
  return {
    prior,
    favourites: cat.favourites.map(decorate),
    notAHit: cat.notAHit.map(decorate),
    unrated: cat.unrated.map((dishId) => decorate({ dishId })),
  };
}

/** childId -> dishId -> {ups, downs, score} */
export function scoreLookup() {
  const prior = getPrior();
  const out = new Map<number, Map<number, { ups: number; downs: number; score: number }>>();
  for (const [childId, list] of talliesByChild()) {
    out.set(
      childId,
      new Map(list.map((t) => [t.dishId, { ups: t.ups, downs: t.downs, score: smoothedScore(t.ups, t.downs, prior) }])),
    );
  }
  return out;
}

export function getInsights(childId: number) {
  const db = getDb();
  const tallies = talliesByChild().get(childId) ?? [];
  const rated: RatedDish[] = tallies
    .filter((t) => t.ups + t.downs > 0)
    .map((t) => {
      const snap = latestSnapshot(db, t.dishId);
      return { dishId: t.dishId, ups: t.ups, downs: t.downs, ingredients: snap ? flattenIngredients(snap.ingredients) : [] };
    })
    .filter((d) => d.ingredients.length > 0);
  return { ratedWithIngredients: rated.length, insights: ingredientInsights(rated) };
}

export function childHasOrders(childId: number) {
  return !!getDb().select().from(schema.orders).where(and(eq(schema.orders.childId, childId))).get();
}
