import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

export const child = sqliteTable("child", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  grade: text("grade"),
  school: text("school"),
  color: text("color").notNull().default("#3b82f6"),
  /** JSON array of watched ingredient terms, e.g. ["peanut","mushroom"] */
  watchlist: text("watchlist", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

export const upload = sqliteTable("upload", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind", { enum: ["order_form", "ingredients"] }).notNull(),
  originalFilename: text("original_filename").notNull(),
  /** Folder under data/uploads holding the originals (and processed copies). */
  storedPath: text("stored_path").notNull(),
  /** JSON list of the files in this upload (multi-page scans can be several images). */
  files: text("files", { mode: "json" }).$type<UploadFile[]>().notNull().default(sql`'[]'`),
  mimeType: text("mime_type").notNull(),
  pageCount: integer("page_count"),
  month: text("month"),
  status: text("status", {
    enum: ["uploaded", "parsing", "needs_review", "confirmed", "failed"],
  })
    .notNull()
    .default("uploaded"),
  extractionJson: text("extraction_json"),
  /** The last confirmed (user-edited) version of the extraction. */
  confirmedJson: text("confirmed_json"),
  error: text("error"),
  createdAt: createdAt(),
  confirmedAt: text("confirmed_at"),
});

export type UploadFile = {
  originalName: string;
  /** stored original, relative to the upload folder */
  stored: string;
  /** what gets sent to Claude / shown in review (converted HEIC, resized image, or the PDF) */
  processed: string;
  mimeType: string;
  processedMimeType: string;
  pages?: number;
};

export const dish = sqliteTable(
  "dish",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    canonicalName: text("canonical_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    vendor: text("vendor"),
    firstSeenDate: text("first_seen_date"),
    lastSeenDate: text("last_seen_date"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("dish_normalized_uq").on(t.normalizedName)],
);

export const dishAlias = sqliteTable(
  "dish_alias",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    dishId: integer("dish_id")
      .notNull()
      .references(() => dish.id, { onDelete: "cascade" }),
    aliasName: text("alias_name").notNull(),
    normalizedAlias: text("normalized_alias").notNull(),
  },
  (t) => [uniqueIndex("dish_alias_normalized_uq").on(t.normalizedAlias)],
);

export const ingredient = sqliteTable(
  "ingredient",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
  },
  (t) => [uniqueIndex("ingredient_normalized_uq").on(t.normalizedName)],
);

export const ingredientSnapshot = sqliteTable(
  "ingredient_snapshot",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    dishId: integer("dish_id")
      .notNull()
      .references(() => dish.id, { onDelete: "cascade" }),
    uploadId: integer("upload_id").references(() => upload.id, { onDelete: "set null" }),
    effectiveMonth: text("effective_month").notNull(),
    rawText: text("raw_text").notNull().default(""),
    declaredAllergens: text("declared_allergens", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    createdAt: createdAt(),
  },
  (t) => [index("snapshot_dish_idx").on(t.dishId)],
);

export const snapshotIngredient = sqliteTable(
  "snapshot_ingredient",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    snapshotId: integer("snapshot_id")
      .notNull()
      .references(() => ingredientSnapshot.id, { onDelete: "cascade" }),
    ingredientId: integer("ingredient_id")
      .notNull()
      .references(() => ingredient.id),
    parentIngredientId: integer("parent_ingredient_id").references(() => ingredient.id),
    position: integer("position").notNull(),
  },
  (t) => [index("snapshot_ingredient_snapshot_idx").on(t.snapshotId)],
);

export const ingredientChange = sqliteTable("ingredient_change", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dishId: integer("dish_id")
    .notNull()
    .references(() => dish.id, { onDelete: "cascade" }),
  uploadId: integer("upload_id").references(() => upload.id, { onDelete: "cascade" }),
  fromSnapshotId: integer("from_snapshot_id").references(() => ingredientSnapshot.id, {
    onDelete: "set null",
  }),
  toSnapshotId: integer("to_snapshot_id").references(() => ingredientSnapshot.id, {
    onDelete: "cascade",
  }),
  fromMonth: text("from_month"),
  toMonth: text("to_month").notNull(),
  added: text("added", { mode: "json" }).$type<string[]>().notNull(),
  removed: text("removed", { mode: "json" }).$type<string[]>().notNull(),
  allergensAdded: text("allergens_added", { mode: "json" }).$type<string[]>().notNull(),
  allergensRemoved: text("allergens_removed", { mode: "json" }).$type<string[]>().notNull(),
  dismissedAt: text("dismissed_at"),
  createdAt: createdAt(),
});

export const menuOffering = sqliteTable(
  "menu_offering",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    dishId: integer("dish_id")
      .notNull()
      .references(() => dish.id),
    optionLabel: text("option_label"),
    priceCents: integer("price_cents"),
    uploadId: integer("upload_id").references(() => upload.id, { onDelete: "cascade" }),
  },
  (t) => [index("offering_date_idx").on(t.date)],
);

/** Household-level day notes: "PA Day", no school, etc. From forms or entered by hand. */
export const dayNote = sqliteTable(
  "day_note",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    noService: integer("no_service", { mode: "boolean" }).notNull().default(false),
    note: text("note"),
    uploadId: integer("upload_id").references(() => upload.id, { onDelete: "cascade" }),
  },
  (t) => [index("day_note_date_idx").on(t.date)],
);

// "order" is an SQL keyword, so the table is called "orders".
export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    childId: integer("child_id")
      .notNull()
      .references(() => child.id),
    date: text("date").notNull(),
    dishId: integer("dish_id")
      .notNull()
      .references(() => dish.id),
    quantity: integer("quantity").notNull().default(1),
    priceCents: integer("price_cents"),
    status: text("status", { enum: ["ordered", "cancelled", "no_school"] })
      .notNull()
      .default("ordered"),
    uploadId: integer("upload_id").references(() => upload.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("orders_child_date_dish_uq").on(t.childId, t.date, t.dishId),
    index("orders_date_idx").on(t.date),
  ],
);

export const feedback = sqliteTable(
  "feedback",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [uniqueIndex("feedback_order_uq").on(t.orderId)],
);

export const setting = sqliteTable("setting", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Child = typeof child.$inferSelect;
export type Dish = typeof dish.$inferSelect;
export type Upload = typeof upload.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type IngredientChange = typeof ingredientChange.$inferSelect;
