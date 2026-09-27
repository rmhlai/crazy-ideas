import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { HttpError } from "./uploads";

export const CHILD_COLORS = ["#3b82f6", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316"];

export type ChildInput = {
  name?: string;
  grade?: string | null;
  school?: string | null;
  color?: string;
  watchlist?: string[];
  active?: boolean;
};

function clean(input: ChildInput) {
  const out: Partial<typeof schema.child.$inferInsert> = {};
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) throw new HttpError(400, "Name is required");
    out.name = n;
  }
  if (input.grade !== undefined) out.grade = input.grade?.trim() || null;
  if (input.school !== undefined) out.school = input.school?.trim() || null;
  if (input.color !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) throw new HttpError(400, "Colour must be #rrggbb");
    out.color = input.color;
  }
  if (input.watchlist !== undefined) {
    out.watchlist = [...new Set(input.watchlist.map((w) => w.trim().toLowerCase()).filter(Boolean))];
  }
  if (input.active !== undefined) out.active = !!input.active;
  return out;
}

export function listChildren(includeInactive = false) {
  const db = getDb();
  const q = db.select().from(schema.child);
  return (includeInactive ? q : q.where(eq(schema.child.active, true))).orderBy(asc(schema.child.id)).all();
}

export function getChild(id: number) {
  return getDb().select().from(schema.child).where(eq(schema.child.id, id)).get();
}

export function createChild(input: ChildInput) {
  const db = getDb();
  const count = db.select().from(schema.child).all().length;
  const values = clean({ color: CHILD_COLORS[count % CHILD_COLORS.length], watchlist: [], ...input });
  if (!values.name) throw new HttpError(400, "Name is required");
  return db.insert(schema.child).values(values as typeof schema.child.$inferInsert).returning().get();
}

export function updateChild(id: number, input: ChildInput) {
  const db = getDb();
  if (!getChild(id)) throw new HttpError(404, "Child not found");
  const values = clean(input);
  if (Object.keys(values).length) db.update(schema.child).set(values).where(eq(schema.child.id, id)).run();
  return getChild(id)!;
}

/** Soft delete so history and rankings survive. */
export function archiveChild(id: number) {
  return updateChild(id, { active: false });
}
