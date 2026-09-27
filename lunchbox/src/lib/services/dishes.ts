import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb, schema, type DB } from "../db";
import { matchDishName, normalizeName, type MatchCandidate, type MatchResult } from "../normalize";
import { flattenIngredients, formatIngredients, type IngredientNode } from "../ingredients";
import { watchHits } from "../watchlist";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0] | DB;

export function matchCandidates(db: Tx = getDb()): MatchCandidate[] {
  const dishes = db.select().from(schema.dish).all();
  const byId = new Map(dishes.map((d) => [d.id, d]));
  const aliases = db.select().from(schema.dishAlias).all();
  return [
    ...dishes.map((d) => ({ dishId: d.id, name: d.canonicalName, canonicalName: d.canonicalName })),
    ...aliases
      .filter((a) => byId.has(a.dishId))
      .map((a) => ({ dishId: a.dishId, name: a.aliasName, canonicalName: byId.get(a.dishId)!.canonicalName })),
  ];
}

export function matchNames(names: string[], db: Tx = getDb()): Record<string, MatchResult> {
  const cands = matchCandidates(db);
  const out: Record<string, MatchResult> = {};
  for (const n of names) out[n] = matchDishName(n, cands);
  return out;
}

export type DishDecision = { action: "link"; dishId: number } | { action: "new"; canonicalName?: string };

function addAliasIfNew(tx: Tx, dishId: number, name: string) {
  const norm = normalizeName(name);
  if (!norm) return;
  const d = tx.select().from(schema.dish).where(eq(schema.dish.normalizedName, norm)).get();
  if (d) return; // it's some dish's canonical name already
  const a = tx.select().from(schema.dishAlias).where(eq(schema.dishAlias.normalizedAlias, norm)).get();
  if (a) return;
  tx.insert(schema.dishAlias).values({ dishId, aliasName: name.trim(), normalizedAlias: norm }).run();
}

/** Find a dish by exact normalized name or alias. */
export function findDishByName(tx: Tx, name: string): number | undefined {
  const norm = normalizeName(name);
  if (!norm) return undefined;
  const d = tx.select({ id: schema.dish.id }).from(schema.dish).where(eq(schema.dish.normalizedName, norm)).get();
  if (d) return d.id;
  const a = tx
    .select({ id: schema.dishAlias.dishId })
    .from(schema.dishAlias)
    .where(eq(schema.dishAlias.normalizedAlias, norm))
    .get();
  return a?.id;
}

export function createDish(tx: Tx, name: string, vendor: string | null = null): number {
  const existing = findDishByName(tx, name);
  if (existing) return existing;
  const norm = normalizeName(name);
  if (!norm) throw new Error(`"${name}" is not a usable dish name`);
  const row = tx
    .insert(schema.dish)
    .values({ canonicalName: name.trim(), normalizedName: norm, vendor })
    .returning({ id: schema.dish.id })
    .get();
  return row.id;
}

/**
 * Turn the reviewer's decisions into dish ids. Linking a new spelling to an existing
 * dish saves it as an alias so it auto-matches next time.
 */
export function resolveDishNames(
  tx: Tx,
  names: string[],
  decisions: Record<string, DishDecision | undefined>,
  vendor: string | null,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const raw of new Set(names.map((n) => n.trim()).filter(Boolean))) {
    const dec = decisions[raw];
    if (dec?.action === "link") {
      const exists = tx.select({ id: schema.dish.id }).from(schema.dish).where(eq(schema.dish.id, dec.dishId)).get();
      if (!exists) throw new Error(`Dish ${dec.dishId} does not exist`);
      addAliasIfNew(tx, dec.dishId, raw);
      out.set(raw, dec.dishId);
    } else if (dec?.action === "new") {
      const canonical = dec.canonicalName?.trim() || raw;
      const id = createDish(tx, canonical, vendor);
      if (normalizeName(raw) !== normalizeName(canonical)) addAliasIfNew(tx, id, raw);
      out.set(raw, id);
    } else {
      out.set(raw, findDishByName(tx, raw) ?? createDish(tx, raw, vendor));
    }
  }
  return out;
}

export function touchDishDates(tx: Tx, dishId: number, date: string) {
  tx.update(schema.dish)
    .set({
      firstSeenDate: sql`CASE WHEN ${schema.dish.firstSeenDate} IS NULL OR ${schema.dish.firstSeenDate} > ${date} THEN ${date} ELSE ${schema.dish.firstSeenDate} END`,
      lastSeenDate: sql`CASE WHEN ${schema.dish.lastSeenDate} IS NULL OR ${schema.dish.lastSeenDate} < ${date} THEN ${date} ELSE ${schema.dish.lastSeenDate} END`,
    })
    .where(eq(schema.dish.id, dishId))
    .run();
}

// ---------- snapshots ----------

export type LoadedSnapshot = {
  id: number;
  dishId: number;
  uploadId: number | null;
  effectiveMonth: string;
  rawText: string;
  allergens: string[];
  ingredients: IngredientNode[];
  createdAt: string;
};

export function loadSnapshot(tx: Tx, id: number): LoadedSnapshot | undefined {
  const s = tx.select().from(schema.ingredientSnapshot).where(eq(schema.ingredientSnapshot.id, id)).get();
  if (!s) return undefined;
  const rows = tx
    .select({
      ingredientId: schema.snapshotIngredient.ingredientId,
      parentId: schema.snapshotIngredient.parentIngredientId,
      name: schema.ingredient.name,
    })
    .from(schema.snapshotIngredient)
    .innerJoin(schema.ingredient, eq(schema.ingredient.id, schema.snapshotIngredient.ingredientId))
    .where(eq(schema.snapshotIngredient.snapshotId, id))
    .orderBy(asc(schema.snapshotIngredient.position))
    .all();
  const ingredients: (IngredientNode & { _id: number })[] = [];
  for (const r of rows) {
    if (r.parentId == null) ingredients.push({ _id: r.ingredientId, name: r.name, sub_ingredients: [] });
    else {
      const parent = [...ingredients].reverse().find((i) => i._id === r.parentId);
      if (parent) parent.sub_ingredients!.push(r.name);
      else ingredients.push({ _id: r.ingredientId, name: r.name, sub_ingredients: [] });
    }
  }
  return {
    id: s.id,
    dishId: s.dishId,
    uploadId: s.uploadId,
    effectiveMonth: s.effectiveMonth,
    rawText: s.rawText,
    allergens: s.declaredAllergens,
    createdAt: s.createdAt,
    ingredients: ingredients.map(({ _id, ...rest }) => rest),
  };
}

export function latestSnapshot(tx: Tx, dishId: number, opts: { excludeUploadId?: number; maxMonth?: string } = {}) {
  const conds = [eq(schema.ingredientSnapshot.dishId, dishId)];
  if (opts.excludeUploadId != null) {
    conds.push(
      sql`(${schema.ingredientSnapshot.uploadId} IS NULL OR ${schema.ingredientSnapshot.uploadId} != ${opts.excludeUploadId})`,
    );
  }
  if (opts.maxMonth) conds.push(sql`${schema.ingredientSnapshot.effectiveMonth} <= ${opts.maxMonth}`);
  const s = tx
    .select({ id: schema.ingredientSnapshot.id })
    .from(schema.ingredientSnapshot)
    .where(and(...conds))
    .orderBy(desc(schema.ingredientSnapshot.effectiveMonth), desc(schema.ingredientSnapshot.id))
    .get();
  return s ? loadSnapshot(tx, s.id) : undefined;
}

export type DishInfo = {
  id: number;
  name: string;
  description: string | null;
  allergens: string[];
  ingredients: string[];
  /** childId -> matched watch terms */
  watch: Record<number, string[]>;
};

/** Description (latest ingredients) + watch-list flags for a set of dishes. */
export function dishInfo(dishIds: number[], db: Tx = getDb()): Map<number, DishInfo> {
  const out = new Map<number, DishInfo>();
  if (!dishIds.length) return out;
  const ids = [...new Set(dishIds)];
  const dishes = db.select().from(schema.dish).where(inArray(schema.dish.id, ids)).all();
  const children = db.select().from(schema.child).where(eq(schema.child.active, true)).all();
  for (const d of dishes) {
    const snap = latestSnapshot(db, d.id);
    const flat = snap ? flattenIngredients(snap.ingredients) : [];
    const allergens = snap?.allergens ?? [];
    const watch: Record<number, string[]> = {};
    for (const c of children) {
      const hits = watchHits(c.watchlist, [...flat, d.canonicalName.toLowerCase()], allergens);
      if (hits.length) watch[c.id] = hits;
    }
    out.set(d.id, {
      id: d.id,
      name: d.canonicalName,
      description: snap ? formatIngredients(snap.ingredients) : null,
      allergens,
      ingredients: flat,
      watch,
    });
  }
  return out;
}

export function listDishes(q?: string) {
  const db = getDb();
  const dishes = db.select().from(schema.dish).orderBy(asc(schema.dish.canonicalName)).all();
  const aliases = db.select().from(schema.dishAlias).all();
  const counts = db
    .select({ dishId: schema.orders.dishId, n: sql<number>`count(*)` })
    .from(schema.orders)
    .where(ne(schema.orders.status, "cancelled"))
    .groupBy(schema.orders.dishId)
    .all();
  const countMap = new Map(counts.map((c) => [c.dishId, c.n]));
  const snaps = db
    .select({ dishId: schema.ingredientSnapshot.dishId, n: sql<number>`count(*)` })
    .from(schema.ingredientSnapshot)
    .groupBy(schema.ingredientSnapshot.dishId)
    .all();
  const snapMap = new Map(snaps.map((s) => [s.dishId, s.n]));
  const needle = q ? normalizeName(q) : "";
  const info = dishInfo(dishes.map((d) => d.id), db);
  return dishes
    .map((d) => ({
      ...d,
      aliases: aliases.filter((a) => a.dishId === d.id).map((a) => a.aliasName),
      orderCount: countMap.get(d.id) ?? 0,
      snapshotCount: snapMap.get(d.id) ?? 0,
      info: info.get(d.id)!,
    }))
    .filter(
      (d) =>
        !needle ||
        d.normalizedName.includes(needle) ||
        d.aliases.some((a) => normalizeName(a).includes(needle)) ||
        d.info.ingredients.some((i) => i.includes(q!.toLowerCase().trim())),
    );
}

export function getDishDetail(id: number) {
  const db = getDb();
  const d = db.select().from(schema.dish).where(eq(schema.dish.id, id)).get();
  if (!d) return undefined;
  const aliases = db.select().from(schema.dishAlias).where(eq(schema.dishAlias.dishId, id)).all();
  const snapIds = db
    .select({ id: schema.ingredientSnapshot.id })
    .from(schema.ingredientSnapshot)
    .where(eq(schema.ingredientSnapshot.dishId, id))
    .orderBy(desc(schema.ingredientSnapshot.effectiveMonth), desc(schema.ingredientSnapshot.id))
    .all();
  const snapshots = snapIds.map((s) => loadSnapshot(db, s.id)!);
  const changes = db
    .select()
    .from(schema.ingredientChange)
    .where(eq(schema.ingredientChange.dishId, id))
    .all();
  const history = snapshots.map((s) => ({
    ...s,
    description: formatIngredients(s.ingredients),
    change: changes.find((c) => c.toSnapshotId === s.id) ?? null,
  }));
  const orderRows = db
    .select({
      id: schema.orders.id,
      date: schema.orders.date,
      status: schema.orders.status,
      childId: schema.orders.childId,
      childName: schema.child.name,
      color: schema.child.color,
      rating: schema.feedback.rating,
      note: schema.feedback.note,
    })
    .from(schema.orders)
    .innerJoin(schema.child, eq(schema.child.id, schema.orders.childId))
    .leftJoin(schema.feedback, eq(schema.feedback.orderId, schema.orders.id))
    .where(eq(schema.orders.dishId, id))
    .orderBy(desc(schema.orders.date))
    .all();
  const byChild = new Map<number, { childId: number; name: string; color: string; ups: number; downs: number }>();
  for (const o of orderRows) {
    const r = byChild.get(o.childId) ?? { childId: o.childId, name: o.childName, color: o.color, ups: 0, downs: 0 };
    if (o.rating === 1) r.ups++;
    if (o.rating === -1) r.downs++;
    byChild.set(o.childId, r);
  }
  const info = dishInfo([id], db).get(id)!;
  const children = db.select().from(schema.child).all();
  return {
    dish: d,
    aliases,
    info,
    history,
    orders: orderRows,
    ratings: [...byChild.values()],
    watch: Object.entries(info.watch).map(([cid, terms]) => ({
      child: children.find((c) => c.id === Number(cid))!,
      terms,
    })),
  };
}

export function renameDish(id: number, name: string) {
  const db = getDb();
  const norm = normalizeName(name);
  if (!norm) throw new Error("Name is empty");
  db.transaction((tx) => {
    const d = tx.select().from(schema.dish).where(eq(schema.dish.id, id)).get();
    if (!d) throw new Error("Dish not found");
    const clash = tx.select().from(schema.dish).where(eq(schema.dish.normalizedName, norm)).get();
    if (clash && clash.id !== id) throw new Error(`"${clash.canonicalName}" already exists`);
    // keep the old name as an alias so it keeps matching
    if (d.normalizedName !== norm) {
      tx.delete(schema.dishAlias).where(eq(schema.dishAlias.normalizedAlias, norm)).run();
      tx.update(schema.dish).set({ canonicalName: name.trim(), normalizedName: norm }).where(eq(schema.dish.id, id)).run();
      addAliasIfNew(tx, id, d.canonicalName);
    } else {
      tx.update(schema.dish).set({ canonicalName: name.trim() }).where(eq(schema.dish.id, id)).run();
    }
  });
}
