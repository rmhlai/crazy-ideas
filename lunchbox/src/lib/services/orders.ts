import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import { isAwaitingFeedbackDate, isValidDate, todayISO } from "../dates";
import { createDish, dishInfo, findDishByName, touchDishDates } from "./dishes";
import { HttpError } from "./uploads";

export type OrderStatus = "ordered" | "cancelled" | "no_school";

export function listOrders(opts: { from?: string; to?: string; childId?: number; includeInactive?: boolean } = {}) {
  const db = getDb();
  const conds = [];
  if (opts.from) conds.push(gte(schema.orders.date, opts.from));
  if (opts.to) conds.push(lte(schema.orders.date, opts.to));
  if (opts.childId) conds.push(eq(schema.orders.childId, opts.childId));
  if (!opts.includeInactive) conds.push(eq(schema.child.active, true));
  const rows = db
    .select({
      id: schema.orders.id,
      date: schema.orders.date,
      childId: schema.orders.childId,
      childName: schema.child.name,
      color: schema.child.color,
      dishId: schema.orders.dishId,
      dishName: schema.dish.canonicalName,
      quantity: schema.orders.quantity,
      priceCents: schema.orders.priceCents,
      status: schema.orders.status,
      uploadId: schema.orders.uploadId,
      rating: schema.feedback.rating,
      note: schema.feedback.note,
    })
    .from(schema.orders)
    .innerJoin(schema.child, eq(schema.child.id, schema.orders.childId))
    .innerJoin(schema.dish, eq(schema.dish.id, schema.orders.dishId))
    .leftJoin(schema.feedback, eq(schema.feedback.orderId, schema.orders.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(schema.orders.date), asc(schema.orders.childId))
    .all();
  const now = new Date();
  return rows.map((r) => ({
    ...r,
    awaitingFeedback: r.status === "ordered" && r.rating == null && isAwaitingFeedbackDate(r.date, now),
    canRate: r.status === "ordered" && isAwaitingFeedbackDate(r.date, now),
  }));
}

export type OrderRow = ReturnType<typeof listOrders>[number];

/** Orders plus dish descriptions / watch flags, for day views. */
export function ordersWithInfo(opts: Parameters<typeof listOrders>[0]) {
  const rows = listOrders(opts);
  const info = dishInfo(rows.map((r) => r.dishId));
  return rows.map((r) => ({ ...r, info: info.get(r.dishId)! }));
}

export function listDayNotes(from: string, to: string) {
  return getDb()
    .select()
    .from(schema.dayNote)
    .where(and(gte(schema.dayNote.date, from), lte(schema.dayNote.date, to)))
    .orderBy(asc(schema.dayNote.date))
    .all();
}

export function listOfferings(from: string, to: string) {
  return getDb()
    .select({
      id: schema.menuOffering.id,
      date: schema.menuOffering.date,
      dishId: schema.menuOffering.dishId,
      dishName: schema.dish.canonicalName,
      optionLabel: schema.menuOffering.optionLabel,
      priceCents: schema.menuOffering.priceCents,
      uploadId: schema.menuOffering.uploadId,
    })
    .from(schema.menuOffering)
    .innerJoin(schema.dish, eq(schema.dish.id, schema.menuOffering.dishId))
    .where(and(gte(schema.menuOffering.date, from), lte(schema.menuOffering.date, to)))
    .orderBy(asc(schema.menuOffering.date), asc(schema.menuOffering.optionLabel))
    .all();
}

export type NewOrder = {
  childId: number;
  date: string;
  dishId?: number;
  dishName?: string;
  quantity?: number;
  priceCents?: number | null;
  status?: OrderStatus;
};

function resolveDish(input: { dishId?: number; dishName?: string }): number {
  const db = getDb();
  if (input.dishId) {
    const d = db.select().from(schema.dish).where(eq(schema.dish.id, input.dishId)).get();
    if (!d) throw new HttpError(400, "Unknown dish");
    return d.id;
  }
  if (input.dishName?.trim()) return findDishByName(db, input.dishName) ?? createDish(db, input.dishName);
  throw new HttpError(400, "Choose a dish");
}

/** Price from that day's menu if the parent didn't give one. */
function menuPrice(date: string, dishId: number): number | null {
  const o = getDb()
    .select()
    .from(schema.menuOffering)
    .where(and(eq(schema.menuOffering.date, date), eq(schema.menuOffering.dishId, dishId)))
    .get();
  return o?.priceCents ?? null;
}

export function createOrder(input: NewOrder) {
  const db = getDb();
  if (!isValidDate(input.date)) throw new HttpError(400, "Invalid date");
  const kid = db.select().from(schema.child).where(eq(schema.child.id, input.childId)).get();
  if (!kid) throw new HttpError(400, "Unknown child");
  const dishId = resolveDish(input);
  const existing = db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.childId, input.childId), eq(schema.orders.date, input.date), eq(schema.orders.dishId, dishId)))
    .get();
  if (existing) {
    if (existing.status !== "ordered") {
      db.update(schema.orders).set({ status: "ordered" }).where(eq(schema.orders.id, existing.id)).run();
    }
    return existing;
  }
  const row = db
    .insert(schema.orders)
    .values({
      childId: input.childId,
      date: input.date,
      dishId,
      quantity: Math.max(1, input.quantity ?? 1),
      priceCents: input.priceCents ?? menuPrice(input.date, dishId),
      status: input.status ?? "ordered",
      uploadId: null,
    })
    .returning()
    .get();
  touchDishDates(db, dishId, input.date);
  return row;
}

export type OrderPatch = {
  dishId?: number;
  dishName?: string;
  quantity?: number;
  priceCents?: number | null;
  status?: OrderStatus;
  date?: string;
};

export function updateOrder(id: number, patch: OrderPatch) {
  const db = getDb();
  const o = db.select().from(schema.orders).where(eq(schema.orders.id, id)).get();
  if (!o) throw new HttpError(404, "Order not found");
  const set: Partial<typeof schema.orders.$inferInsert> = {};
  if (patch.dishId || patch.dishName) set.dishId = resolveDish(patch);
  if (patch.quantity !== undefined) set.quantity = Math.max(1, Math.floor(patch.quantity));
  if (patch.priceCents !== undefined) set.priceCents = patch.priceCents;
  if (patch.status) {
    if (!["ordered", "cancelled", "no_school"].includes(patch.status)) throw new HttpError(400, "Bad status");
    set.status = patch.status;
  }
  if (patch.date) {
    if (!isValidDate(patch.date)) throw new HttpError(400, "Invalid date");
    set.date = patch.date;
  }
  if (set.dishId && set.dishId !== o.dishId) {
    const dup = db
      .select()
      .from(schema.orders)
      .where(
        and(eq(schema.orders.childId, o.childId), eq(schema.orders.date, set.date ?? o.date), eq(schema.orders.dishId, set.dishId)),
      )
      .get();
    if (dup) throw new HttpError(409, "That child already has this dish on that day");
  }
  // A manual change detaches the order from its upload so re-confirming the form won't undo it.
  if (Object.keys(set).length) {
    db.update(schema.orders).set({ ...set, uploadId: null }).where(eq(schema.orders.id, id)).run();
  }
  return db.select().from(schema.orders).where(eq(schema.orders.id, id)).get()!;
}

export function deleteOrder(id: number) {
  const db = getDb();
  const o = db.select().from(schema.orders).where(eq(schema.orders.id, id)).get();
  if (!o) throw new HttpError(404, "Order not found");
  const fb = db.select().from(schema.feedback).where(eq(schema.feedback.orderId, id)).get();
  if (fb) throw new HttpError(409, "This lunch has feedback. Cancel it instead, or clear the feedback first.");
  db.delete(schema.orders).where(eq(schema.orders.id, id)).run();
}

/** Household "no school" marker for a day (sets/clears a manual day note). */
export function setNoSchool(date: string, noSchool: boolean, note?: string | null) {
  const db = getDb();
  if (!isValidDate(date)) throw new HttpError(400, "Invalid date");
  db.delete(schema.dayNote).where(and(eq(schema.dayNote.date, date), isNull(schema.dayNote.uploadId))).run();
  if (noSchool || note) {
    db.insert(schema.dayNote).values({ date, noService: noSchool, note: note ?? null, uploadId: null }).run();
  }
  // lunches on a no-school day won't happen
  if (noSchool) {
    db.update(schema.orders)
      .set({ status: "no_school" })
      .where(and(eq(schema.orders.date, date), eq(schema.orders.status, "ordered")))
      .run();
  } else {
    db.update(schema.orders)
      .set({ status: "ordered" })
      .where(and(eq(schema.orders.date, date), eq(schema.orders.status, "no_school")))
      .run();
  }
}

// ---------- feedback ----------

export function setFeedback(orderId: number, rating: 1 | -1 | null, note?: string | null) {
  const db = getDb();
  const o = db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
  if (!o) throw new HttpError(404, "Order not found");
  if (o.status !== "ordered") throw new HttpError(400, "Cancelled or no-school lunches can't be rated");
  if (rating !== null && rating !== 1 && rating !== -1) throw new HttpError(400, "rating must be 1, -1 or null");
  const now = new Date().toISOString();
  if (rating === null) {
    db.delete(schema.feedback).where(eq(schema.feedback.orderId, orderId)).run();
    return null;
  }
  const existing = db.select().from(schema.feedback).where(eq(schema.feedback.orderId, orderId)).get();
  if (existing) {
    db.update(schema.feedback)
      .set({ rating, updatedAt: now, ...(note !== undefined ? { note: note?.trim() || null } : {}) })
      .where(eq(schema.feedback.id, existing.id))
      .run();
  } else {
    db.insert(schema.feedback).values({ orderId, rating, note: note?.trim() || null, createdAt: now, updatedAt: now }).run();
  }
  return db.select().from(schema.feedback).where(eq(schema.feedback.orderId, orderId)).get()!;
}

export function pendingFeedback(now = new Date()) {
  const today = todayISO(now);
  return listOrders({ to: today })
    .filter((o) => o.status === "ordered" && o.rating == null && isAwaitingFeedbackDate(o.date, now))
    .sort((a, b) => b.date.localeCompare(a.date) || a.childId - b.childId);
}

export function pendingFeedbackCount(now = new Date()) {
  return pendingFeedback(now).length;
}

// ---------- spending ----------

export function spendingByMonth() {
  const db = getDb();
  const rows = db
    .select({
      month: sql<string>`substr(${schema.orders.date}, 1, 7)`,
      childId: schema.orders.childId,
      cents: sql<number>`sum(coalesce(${schema.orders.priceCents}, 0) * ${schema.orders.quantity})`,
      lunches: sql<number>`sum(${schema.orders.quantity})`,
      unpriced: sql<number>`sum(case when ${schema.orders.priceCents} is null then 1 else 0 end)`,
    })
    .from(schema.orders)
    .where(eq(schema.orders.status, "ordered"))
    .groupBy(sql`1`, schema.orders.childId)
    .orderBy(desc(sql`1`))
    .all();
  return rows;
}

export function ordersForExport() {
  return listOrders({ includeInactive: true });
}
