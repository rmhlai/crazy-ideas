import fs from "node:fs";
import path from "node:path";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema, uploadsDir, type DB } from "../db";
import type { UploadFile } from "../db/schema";
import { ACCEPTED_MIME, detectMime, processFile } from "../extraction/files";
import { MissingApiKeyError, describeApiError, extractWithClaude } from "../extraction/claude";
import { sanitizeIngredients, sanitizeOrderForm } from "../extraction/sanitize";
import {
  emptyIngredients,
  emptyOrderForm,
  type IngredientsExtraction,
  type OrderFormExtraction,
  type UploadKind,
} from "../extraction/types";
import { isValidDate, isValidMonth, upcomingMonth } from "../dates";
import { diffSnapshots, isEmptyDiff, normalizeIngredient, type IngredientDiff } from "../ingredients";
import { normalizeName } from "../normalize";
import { watchHits } from "../watchlist";
import {
  findDishByName,
  latestSnapshot,
  matchNames,
  resolveDishNames,
  touchDishDates,
  type DishDecision,
} from "./dishes";
import { getModel } from "./settings";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

// ---------- storing ----------

export type IncomingFile = { name: string; type: string; buffer: Buffer };

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "file";
}

export async function createUpload(kind: UploadKind, files: IncomingFile[]) {
  if (kind !== "order_form" && kind !== "ingredients") throw new HttpError(400, "kind must be order_form or ingredients");
  if (!files.length) throw new HttpError(400, "Choose at least one file");
  const typed = files.map((f) => ({ ...f, mime: detectMime(f.name, f.type) }));
  const bad = typed.find((f) => !ACCEPTED_MIME.has(f.mime));
  if (bad) throw new HttpError(400, `${bad.name}: unsupported file type (use PDF, JPG, PNG or HEIC)`);

  const db = getDb();
  const row = db
    .insert(schema.upload)
    .values({
      kind,
      originalFilename: typed.map((f) => f.name).join(", "),
      storedPath: "",
      mimeType: typed[0].mime,
      status: "uploaded",
    })
    .returning()
    .get();
  const folder = path.join(uploadsDir(), String(row.id));
  fs.mkdirSync(folder, { recursive: true });

  const stored: UploadFile[] = [];
  let pages = 0;
  try {
    for (const [i, f] of typed.entries()) {
      const orig = `original-${i + 1}-${safeName(f.name)}`;
      fs.writeFileSync(path.join(folder, orig), f.buffer);
      const p = await processFile(f.buffer, f.mime);
      const processed = `page-${i + 1}.${p.ext}`;
      fs.writeFileSync(path.join(folder, processed), p.buffer);
      pages += p.pages ?? 1;
      stored.push({
        originalName: f.name,
        stored: orig,
        processed,
        mimeType: f.mime,
        processedMimeType: p.mimeType,
        pages: p.pages,
      });
    }
  } catch (err) {
    db.update(schema.upload)
      .set({ status: "failed", error: `Could not read the file: ${describeApiError(err)}`, storedPath: folder })
      .where(eq(schema.upload.id, row.id))
      .run();
    throw new HttpError(400, `Could not read the file: ${describeApiError(err)}`, { id: row.id });
  }
  db.update(schema.upload)
    .set({ storedPath: path.relative(uploadsDir(), folder), files: stored, pageCount: pages })
    .where(eq(schema.upload.id, row.id))
    .run();
  return getUpload(row.id)!;
}

export function getUpload(id: number) {
  return getDb().select().from(schema.upload).where(eq(schema.upload.id, id)).get();
}

export function uploadFolder(u: { storedPath: string }) {
  return path.join(uploadsDir(), u.storedPath);
}

export function listUploads() {
  return getDb().select().from(schema.upload).orderBy(desc(schema.upload.createdAt), desc(schema.upload.id)).all();
}

export function deleteUpload(id: number) {
  const db = getDb();
  const u = getUpload(id);
  if (!u) throw new HttpError(404, "Upload not found");
  if (u.status === "confirmed") throw new HttpError(400, "Confirmed uploads are kept for audit and can't be deleted");
  db.delete(schema.upload).where(eq(schema.upload.id, id)).run();
  if (u.storedPath) fs.rmSync(uploadFolder(u), { recursive: true, force: true });
}

// ---------- parsing ----------

export async function parseUpload(id: number) {
  const db = getDb();
  const u = getUpload(id);
  if (!u) throw new HttpError(404, "Upload not found");
  if (!u.files.length) throw new HttpError(400, "This upload has no stored files");
  db.update(schema.upload).set({ status: "parsing", error: null }).where(eq(schema.upload.id, id)).run();
  try {
    const folder = uploadFolder(u);
    const files = u.files.map((f) => ({
      data: fs.readFileSync(path.join(folder, f.processed)),
      mimeType: f.processedMimeType,
    }));
    const raw = await extractWithClaude(u.kind, files, getModel());
    const extraction = u.kind === "order_form" ? sanitizeOrderForm(raw) : sanitizeIngredients(raw);
    const month = "month" in extraction ? extraction.month : extraction.effective_month;
    db.update(schema.upload)
      .set({ status: "needs_review", extractionJson: JSON.stringify(extraction), month, error: null })
      .where(eq(schema.upload.id, id))
      .run();
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      // Keep the file and let the reviewer type it in by hand.
      const empty = u.kind === "order_form" ? emptyOrderForm() : emptyIngredients();
      db.update(schema.upload)
        .set({
          status: "needs_review",
          extractionJson: u.extractionJson ?? JSON.stringify(empty),
          error: err.message,
        })
        .where(eq(schema.upload.id, id))
        .run();
    } else {
      db.update(schema.upload)
        .set({ status: u.status === "confirmed" ? "confirmed" : "failed", error: describeApiError(err) })
        .where(eq(schema.upload.id, id))
        .run();
    }
  }
  return getUpload(id)!;
}

/** Start manual entry for a failed upload. */
export function startManualEntry(id: number) {
  const u = getUpload(id);
  if (!u) throw new HttpError(404, "Upload not found");
  const empty = u.kind === "order_form" ? emptyOrderForm() : emptyIngredients();
  getDb()
    .update(schema.upload)
    .set({ status: "needs_review", extractionJson: u.extractionJson ?? JSON.stringify(empty) })
    .where(eq(schema.upload.id, id))
    .run();
  return getUpload(id)!;
}

// ---------- review ----------

export type ReviewOrderForm = OrderFormExtraction & {
  days: (OrderFormExtraction["days"][number] & {
    selections: (OrderFormExtraction["days"][number]["selections"][number] & { child_id?: number | null })[];
  })[];
};

export function orderFormDishNames(x: OrderFormExtraction): string[] {
  const s = new Set<string>();
  for (const d of x.days) {
    for (const o of d.options) s.add(o.dish_name.trim());
    for (const sel of d.selections) s.add(sel.dish_name.trim());
  }
  return [...s].filter(Boolean);
}

export function getReview(id: number) {
  const u = getUpload(id);
  if (!u) throw new HttpError(404, "Upload not found");
  const json = u.confirmedJson ?? u.extractionJson;
  const extraction = json ? JSON.parse(json) : null;
  const names = !extraction
    ? []
    : u.kind === "order_form"
      ? orderFormDishNames(extraction as OrderFormExtraction)
      : (extraction as IngredientsExtraction).dishes.map((d) => d.dish_name);
  const children = getDb().select().from(schema.child).where(eq(schema.child.active, true)).all();
  return {
    upload: u,
    extraction,
    matches: matchNames(names),
    children,
    defaultMonth: upcomingMonth(),
  };
}

// ---------- confirm: order form ----------

export type OrderFormConfirm = {
  extraction: ReviewOrderForm;
  dishDecisions: Record<string, DishDecision>;
  /** Orders from an earlier confirm of this upload that now have feedback: keep them as manual orders. */
  keepConflicting?: boolean;
};

export function confirmOrderForm(id: number, body: OrderFormConfirm) {
  const db = getDb();
  const u = getUpload(id);
  if (!u) throw new HttpError(404, "Upload not found");
  if (u.kind !== "order_form") throw new HttpError(400, "Not an order form upload");
  const x = body.extraction;
  if (!isValidMonth(x.month)) throw new HttpError(400, "Choose the month this form is for");
  for (const d of x.days) {
    if (!isValidDate(d.date)) throw new HttpError(400, `Day ${d.day_of_month || "?"} has no valid date`);
    if (d.date!.slice(0, 7) !== x.month) throw new HttpError(400, `${d.date} is outside ${x.month}`);
    for (const s of d.selections) {
      if (!d.no_service && !s.child_id) throw new HttpError(400, `Choose which child the ${d.date} order is for`);
      if (!normalizeName(s.dish_name)) throw new HttpError(400, `A selection on ${d.date} has no dish name`);
    }
  }

  const result = db.transaction((tx) => {
    const dishIds = resolveDishNames(tx, orderFormDishNames(x), body.dishDecisions ?? {}, x.vendor);
    const dishOf = (name: string) => dishIds.get(name.trim())!;

    // desired orders from this form
    type Want = { childId: number; date: string; dishId: number; quantity: number; priceCents: number | null };
    const wants = new Map<string, Want>();
    for (const d of x.days) {
      if (d.no_service) continue;
      for (const s of d.selections) {
        const dishId = dishOf(s.dish_name);
        const opt = d.options.find((o) => o.dish_name.trim() === s.dish_name.trim() || dishOf(o.dish_name) === dishId);
        const key = `${s.child_id}|${d.date}|${dishId}`;
        const prev = wants.get(key);
        wants.set(key, {
          childId: s.child_id!,
          date: d.date!,
          dishId,
          quantity: (prev?.quantity ?? 0) + s.quantity,
          priceCents: opt?.price != null ? Math.round(opt.price * 100) : null,
        });
      }
    }

    // orders from an earlier confirm of this same upload that are no longer on the form
    const previous = tx.select().from(schema.orders).where(eq(schema.orders.uploadId, id)).all();
    const stale = previous.filter((o) => !wants.has(`${o.childId}|${o.date}|${o.dishId}`));
    const staleIds = stale.map((o) => o.id);
    const withFeedback = staleIds.length
      ? tx.select().from(schema.feedback).where(inArray(schema.feedback.orderId, staleIds)).all()
      : [];
    if (withFeedback.length && !body.keepConflicting) {
      const conflictOrders = stale.filter((o) => withFeedback.some((f) => f.orderId === o.id));
      const dishes = tx
        .select()
        .from(schema.dish)
        .where(inArray(schema.dish.id, conflictOrders.map((o) => o.dishId)))
        .all();
      const kids = tx.select().from(schema.child).all();
      throw new HttpError(409, "Some orders this form would remove already have feedback", {
        conflicts: conflictOrders.map((o) => ({
          orderId: o.id,
          date: o.date,
          child: kids.find((k) => k.id === o.childId)?.name,
          dish: dishes.find((d) => d.id === o.dishId)?.canonicalName,
        })),
      });
    }
    const keepIds = new Set(withFeedback.map((f) => f.orderId));
    for (const o of stale) {
      if (keepIds.has(o.id)) {
        tx.update(schema.orders).set({ uploadId: null }).where(eq(schema.orders.id, o.id)).run();
      } else {
        tx.delete(schema.orders).where(eq(schema.orders.id, o.id)).run();
      }
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const w of wants.values()) {
      const existing = tx
        .select()
        .from(schema.orders)
        .where(
          and(eq(schema.orders.childId, w.childId), eq(schema.orders.date, w.date), eq(schema.orders.dishId, w.dishId)),
        )
        .get();
      if (existing && existing.uploadId === id) {
        tx.update(schema.orders)
          .set({ quantity: w.quantity, priceCents: w.priceCents })
          .where(eq(schema.orders.id, existing.id))
          .run();
        updated++;
      } else if (existing) {
        skipped++; // manual entry or another upload owns it — never touch
      } else {
        tx.insert(schema.orders).values({ ...w, uploadId: id, status: "ordered" }).run();
        created++;
      }
      touchDishDates(tx, w.dishId, w.date);
    }

    // menu offerings + day notes are replaced wholesale for this upload
    tx.delete(schema.menuOffering).where(eq(schema.menuOffering.uploadId, id)).run();
    tx.delete(schema.dayNote).where(eq(schema.dayNote.uploadId, id)).run();
    for (const d of x.days) {
      for (const o of d.options) {
        const dishId = dishOf(o.dish_name);
        tx.insert(schema.menuOffering)
          .values({
            date: d.date!,
            dishId,
            optionLabel: o.label,
            priceCents: o.price != null ? Math.round(o.price * 100) : null,
            uploadId: id,
          })
          .run();
        touchDishDates(tx, dishId, d.date!);
      }
      if (d.no_service || d.note) {
        tx.insert(schema.dayNote).values({ date: d.date!, noService: d.no_service, note: d.note, uploadId: id }).run();
      }
    }

    tx.update(schema.upload)
      .set({
        status: "confirmed",
        confirmedAt: new Date().toISOString(),
        confirmedJson: JSON.stringify(x),
        month: x.month,
        error: null,
      })
      .where(eq(schema.upload.id, id))
      .run();
    return { created, updated, skipped, removed: stale.length - keepIds.size, keptAsManual: keepIds.size };
  });
  return result;
}

// ---------- confirm: ingredients ----------

export type IngredientsConfirm = {
  extraction: IngredientsExtraction;
  dishDecisions: Record<string, DishDecision>;
};

export type ChangePreview = {
  dishName: string;
  dishId: number | null;
  fromMonth: string | null;
  diff: IngredientDiff;
  watchAlerts: { childId: number; childName: string; terms: string[] }[];
};

function watchAlertsFor(tx: Tx | DB, diff: IngredientDiff) {
  const kids = tx.select().from(schema.child).where(eq(schema.child.active, true)).all();
  return kids
    .map((k) => ({ childId: k.id, childName: k.name, terms: watchHits(k.watchlist, diff.added, diff.allergensAdded) }))
    .filter((a) => a.terms.length);
}

/** What would change if this ingredients list were confirmed with these decisions (no writes). */
export function previewIngredientChanges(id: number, body: IngredientsConfirm): ChangePreview[] {
  const db = getDb();
  const month = body.extraction.effective_month ?? upcomingMonth();
  const out: ChangePreview[] = [];
  for (const d of body.extraction.dishes) {
    const dec = body.dishDecisions?.[d.dish_name.trim()];
    const dishId =
      dec?.action === "link" ? dec.dishId : dec?.action === "new" ? null : (findDishByName(db, d.dish_name) ?? null);
    if (!dishId) continue;
    const prev = latestSnapshot(db, dishId, { excludeUploadId: id, maxMonth: month });
    if (!prev) continue;
    const diff = diffSnapshots(
      { ingredients: prev.ingredients, allergens: prev.allergens },
      { ingredients: d.ingredients, allergens: d.declared_allergens },
    );
    if (isEmptyDiff(diff)) continue;
    out.push({ dishName: d.dish_name, dishId, fromMonth: prev.effectiveMonth, diff, watchAlerts: watchAlertsFor(db, diff) });
  }
  return out;
}

function ingredientId(tx: Tx, name: string): number | null {
  const norm = normalizeIngredient(name);
  if (!norm) return null;
  const row = tx.select().from(schema.ingredient).where(eq(schema.ingredient.normalizedName, norm)).get();
  if (row) return row.id;
  return tx.insert(schema.ingredient).values({ name: name.trim(), normalizedName: norm }).returning().get().id;
}

export function confirmIngredients(id: number, body: IngredientsConfirm) {
  const db = getDb();
  const u = getUpload(id);
  if (!u) throw new HttpError(404, "Upload not found");
  if (u.kind !== "ingredients") throw new HttpError(400, "Not an ingredients upload");
  const x = body.extraction;
  if (!isValidMonth(x.effective_month)) throw new HttpError(400, "Choose the month this ingredients list applies to");
  const month = x.effective_month!;

  return db.transaction((tx) => {
    // re-confirming replaces this upload's snapshots (and the changes computed from them)
    tx.delete(schema.ingredientChange).where(eq(schema.ingredientChange.uploadId, id)).run();
    tx.delete(schema.ingredientSnapshot).where(eq(schema.ingredientSnapshot.uploadId, id)).run();

    const dishIds = resolveDishNames(
      tx,
      x.dishes.map((d) => d.dish_name),
      body.dishDecisions ?? {},
      x.vendor,
    );
    // one snapshot per dish per upload; the last entry wins if a dish appears twice
    const perDish = new Map<number, IngredientsExtraction["dishes"][number]>();
    for (const d of x.dishes) perDish.set(dishIds.get(d.dish_name.trim())!, d);

    let changed = 0;
    for (const [dishId, d] of perDish) {
      const prev = latestSnapshot(tx, dishId, { excludeUploadId: id, maxMonth: month });
      const snap = tx
        .insert(schema.ingredientSnapshot)
        .values({
          dishId,
          uploadId: id,
          effectiveMonth: month,
          rawText: d.raw_text,
          declaredAllergens: d.declared_allergens.map((a) => a.toLowerCase().trim()).filter(Boolean),
        })
        .returning()
        .get();
      let pos = 0;
      for (const ing of d.ingredients) {
        const pid = ingredientId(tx, ing.name);
        if (pid == null) continue;
        tx.insert(schema.snapshotIngredient).values({ snapshotId: snap.id, ingredientId: pid, position: pos++ }).run();
        for (const sub of ing.sub_ingredients ?? []) {
          const sid = ingredientId(tx, sub);
          if (sid == null) continue;
          tx.insert(schema.snapshotIngredient)
            .values({ snapshotId: snap.id, ingredientId: sid, parentIngredientId: pid, position: pos++ })
            .run();
        }
      }
      if (prev) {
        const diff = diffSnapshots(
          { ingredients: prev.ingredients, allergens: prev.allergens },
          { ingredients: d.ingredients, allergens: d.declared_allergens },
        );
        if (!isEmptyDiff(diff)) {
          tx.insert(schema.ingredientChange)
            .values({
              dishId,
              uploadId: id,
              fromSnapshotId: prev.id,
              toSnapshotId: snap.id,
              fromMonth: prev.effectiveMonth,
              toMonth: month,
              ...diff,
            })
            .run();
          changed++;
        }
      }
    }
    tx.update(schema.upload)
      .set({
        status: "confirmed",
        confirmedAt: new Date().toISOString(),
        confirmedJson: JSON.stringify(x),
        month,
        error: null,
      })
      .where(eq(schema.upload.id, id))
      .run();
    return { snapshots: perDish.size, changed };
  });
}

// ---------- changes feed ----------

export function listChanges(opts: { since?: string; undismissedOnly?: boolean } = {}) {
  const db = getDb();
  const conds = [];
  if (opts.since) conds.push(sql`${schema.ingredientChange.toMonth} >= ${opts.since}`);
  if (opts.undismissedOnly) conds.push(sql`${schema.ingredientChange.dismissedAt} IS NULL`);
  const rows = db
    .select({ change: schema.ingredientChange, dishName: schema.dish.canonicalName })
    .from(schema.ingredientChange)
    .innerJoin(schema.dish, eq(schema.dish.id, schema.ingredientChange.dishId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.ingredientChange.toMonth), desc(schema.ingredientChange.id))
    .all();
  return rows.map((r) => ({
    ...r.change,
    dishName: r.dishName,
    watchAlerts: watchAlertsFor(db, r.change),
  }));
}

export function dismissChanges(ids: number[] | "all") {
  const db = getDb();
  const now = new Date().toISOString();
  if (ids === "all") {
    db.update(schema.ingredientChange).set({ dismissedAt: now }).where(sql`${schema.ingredientChange.dismissedAt} IS NULL`).run();
  } else if (ids.length) {
    db.update(schema.ingredientChange).set({ dismissedAt: now }).where(inArray(schema.ingredientChange.id, ids)).run();
  }
}
