import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { freshDb, loadFixture, mockClaude } from "./helpers";
import { schema, type DB } from "@/lib/db";
import { setAnthropicClientFactory } from "@/lib/extraction/claude";
import {
  confirmIngredients,
  confirmOrderForm,
  createUpload,
  getReview,
  listChanges,
  parseUpload,
  previewIngredientChanges,
  type ReviewOrderForm,
} from "@/lib/services/uploads";
import { createChild } from "@/lib/services/children";
import { pendingFeedback, setFeedback } from "@/lib/services/orders";
import { getRankings } from "@/lib/services/rankings";
import type { IngredientsExtraction, OrderFormExtraction } from "@/lib/extraction/types";

let db: DB;
beforeEach(() => {
  db = freshDb().db;
});
afterEach(() => setAnthropicClientFactory(null));

const png = () => fs.readFileSync("fixtures/samples/order-form-2026-09.png");

async function parsedOrderForm() {
  const calls = mockClaude(loadFixture("order-form-2026-09.expected.json"), "record_order_form");
  const u = await createUpload("order_form", [{ name: "form.png", type: "image/png", buffer: png() }]);
  const parsed = await parseUpload(u.id);
  return { u, parsed, calls };
}

function assignChild(x: OrderFormExtraction, childId: number): ReviewOrderForm {
  return {
    ...x,
    days: x.days.map((d) => ({ ...d, selections: d.selections.map((s) => ({ ...s, child_id: childId })) })),
  };
}

describe("order form pipeline", () => {
  it("stores the file, sends it to Claude as an image with the extraction tool, and saves for review", async () => {
    const { u, parsed, calls } = await parsedOrderForm();
    expect(parsed.status).toBe("needs_review");
    expect(parsed.month).toBe("2026-09");
    expect(u.files[0].processedMimeType).toBe("image/jpeg");
    const params = calls[0] as { tools: { name: string }[]; messages: { content: { type: string }[] }[] };
    expect(params.tools[0].name).toBe("record_order_form");
    expect(params.messages[0].content[0].type).toBe("image");
    // no child names from the app are sent
    expect(JSON.stringify(params)).not.toContain("Robin");
  });

  it("confirm writes dishes, offerings, orders, day notes in one go", async () => {
    const maya = createChild({ name: "Maya" });
    const { u } = await parsedOrderForm();
    const review = getReview(u.id);
    expect(review.matches["Cheese Pizza"].kind).toBe("new");
    const x = assignChild(review.extraction as OrderFormExtraction, maya.id);
    const res = confirmOrderForm(u.id, { extraction: x, dishDecisions: {} });
    expect(res).toMatchObject({ created: 3, removed: 0 });

    const orders = db.select().from(schema.orders).all();
    expect(orders).toHaveLength(3);
    expect(orders.every((o) => o.uploadId === u.id && o.childId === maya.id)).toBe(true);
    expect(orders.find((o) => o.date === "2026-09-08")!.priceCents).toBe(650);
    expect(db.select().from(schema.dish).all()).toHaveLength(5);
    expect(db.select().from(schema.menuOffering).all()).toHaveLength(6);
    const notes = db.select().from(schema.dayNote).all();
    expect(notes).toEqual([expect.objectContaining({ date: "2026-09-10", noService: true, note: "PA Day" })]);
    expect(db.select().from(schema.upload).where(eq(schema.upload.id, u.id)).get()!.status).toBe("confirmed");
  });

  it("linking a new spelling to an existing dish saves an alias", async () => {
    const maya = createChild({ name: "Maya" });
    const { u } = await parsedOrderForm();
    const x = assignChild(getReview(u.id).extraction as OrderFormExtraction, maya.id);
    confirmOrderForm(u.id, { extraction: x, dishDecisions: {} });
    const teriyaki = db.select().from(schema.dish).all().find((d) => d.canonicalName === "Chicken Teriyaki Bowl")!;

    const x2 = structuredClone(x);
    x2.days[0].options[0].dish_name = "Teriyaki Chicken Bowl";
    x2.days[0].selections[0].dish_name = "Teriyaki Chicken Bowl";
    const u2 = await createUpload("order_form", [{ name: "b.png", type: "image/png", buffer: png() }]);
    await parseUpload(u2.id);
    expect(getReview(u2.id).matches["Chicken Teriyaki Bowl"].kind).toBe("exact");
    confirmOrderForm(u2.id, {
      extraction: x2,
      dishDecisions: { "Teriyaki Chicken Bowl": { action: "link", dishId: teriyaki.id } },
    });
    const aliases = db.select().from(schema.dishAlias).all();
    expect(aliases).toEqual([expect.objectContaining({ dishId: teriyaki.id, aliasName: "Teriyaki Chicken Bowl" })]);
  });

  it("re-confirming replaces only this upload's orders, and blocks when feedback would be lost", async () => {
    const maya = createChild({ name: "Maya" });
    const { u } = await parsedOrderForm();
    const x = assignChild(getReview(u.id).extraction as OrderFormExtraction, maya.id);
    confirmOrderForm(u.id, { extraction: x, dishDecisions: {} });

    const pizza = db.select().from(schema.orders).all().find((o) => o.date === "2026-09-11")!;
    setFeedback(pizza.id, 1);

    const without = structuredClone(x);
    without.days[3].selections = [];
    expect(() => confirmOrderForm(u.id, { extraction: without, dishDecisions: {} })).toThrow(/feedback/);
    expect(db.select().from(schema.orders).all()).toHaveLength(3); // rolled back

    const res = confirmOrderForm(u.id, { extraction: without, dishDecisions: {}, keepConflicting: true });
    expect(res.keptAsManual).toBe(1);
    const kept = db.select().from(schema.orders).where(eq(schema.orders.id, pizza.id)).get()!;
    expect(kept.uploadId).toBeNull();
    expect(db.select().from(schema.feedback).all()).toHaveLength(1);

    // dropping a selection without feedback just removes it
    const fewer = structuredClone(without);
    fewer.days[1].selections = [];
    expect(confirmOrderForm(u.id, { extraction: fewer, dishDecisions: {} }).removed).toBe(1);
  });

  it("requires a child for every selection and a month", async () => {
    const { u } = await parsedOrderForm();
    const x = getReview(u.id).extraction as ReviewOrderForm;
    expect(() => confirmOrderForm(u.id, { extraction: x, dishDecisions: {} })).toThrow(/which child/);
    expect(() => confirmOrderForm(u.id, { extraction: { ...x, month: null }, dishDecisions: {} })).toThrow(/month/);
  });

  it("without an API key the upload is kept and opens for manual entry", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const u = await createUpload("order_form", [{ name: "form.png", type: "image/png", buffer: png() }]);
    const parsed = await parseUpload(u.id);
    expect(parsed.status).toBe("needs_review");
    expect(parsed.error).toMatch(/API key/);
    expect(JSON.parse(parsed.extractionJson!).days).toEqual([]);
  });

  it("feedback + ranking flow", async () => {
    const maya = createChild({ name: "Maya" });
    const { u } = await parsedOrderForm();
    confirmOrderForm(u.id, { extraction: assignChild(getReview(u.id).extraction as OrderFormExtraction, maya.id), dishDecisions: {} });
    const pending = pendingFeedback(new Date(2026, 8, 30, 18));
    expect(pending.map((p) => p.date)).toEqual(["2026-09-11", "2026-09-09", "2026-09-08"]);
    setFeedback(pending[0].id, 1);
    setFeedback(pending[1].id, -1);
    const r = getRankings(maya.id);
    expect(r.favourites[0].dishName).toBe("Cheese Pizza");
    expect(r.unrated.map((x) => x.dishName)).toEqual(["Chicken Teriyaki Bowl"]);
    expect(pendingFeedback(new Date(2026, 8, 30, 18))).toHaveLength(1);
  });
});

describe("ingredients pipeline", () => {
  async function confirmIngredientsFixture(name: string, decisions = {}) {
    const x = loadFixture<IngredientsExtraction>(name);
    mockClaude(x, "record_ingredients");
    const u = await createUpload("ingredients", [
      { name: "i.png", type: "image/png", buffer: fs.readFileSync("fixtures/samples/ingredients-2026-09.png") },
    ]);
    await parseUpload(u.id);
    const review = getReview(u.id);
    return { u, review, confirm: () => confirmIngredients(u.id, { extraction: review.extraction, dishDecisions: decisions }) };
  }

  it("creates snapshots with nested ingredients, then detects changes month over month", async () => {
    createChild({ name: "Maya", watchlist: ["mushroom"] });
    const sept = await confirmIngredientsFixture("ingredients-2026-09.expected.json");
    expect(sept.confirm()).toEqual({ snapshots: 2, changed: 0 });
    expect(db.select().from(schema.ingredientSnapshot).all()).toHaveLength(2);
    const nested = db.select().from(schema.snapshotIngredient).all().filter((r) => r.parentIngredientId != null);
    expect(nested.length).toBeGreaterThan(0);

    const teriyaki = db.select().from(schema.dish).all().find((d) => d.canonicalName === "Chicken Teriyaki Bowl")!;
    const oct = await confirmIngredientsFixture("ingredients-2026-10.expected.json", {
      "Teriyaki Chicken Rice Bowl": { action: "link", dishId: teriyaki.id },
    });
    expect(oct.review.matches["Teriyaki Chicken Rice Bowl"].kind).not.toBe("exact");
    const preview = previewIngredientChanges(oct.u.id, {
      extraction: oct.review.extraction,
      dishDecisions: { "Teriyaki Chicken Rice Bowl": { action: "link", dishId: teriyaki.id } },
    });
    expect(preview).toHaveLength(1);
    expect(preview[0].diff.added.sort()).toEqual(["mushrooms", "sesame oil"]);
    expect(preview[0].watchAlerts[0]).toMatchObject({ childName: "Maya", terms: ["mushroom"] });

    expect(oct.confirm()).toEqual({ snapshots: 2, changed: 1 });
    const changes = listChanges({ since: "2026-10" });
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      dishName: "Chicken Teriyaki Bowl",
      fromMonth: "2026-09",
      toMonth: "2026-10",
      allergensAdded: ["sesame"],
    });
    expect(changes[0].removed).toEqual([]);
    expect(changes[0].watchAlerts[0].terms).toEqual(["mushroom"]);

    // re-confirming the same upload doesn't duplicate snapshots or changes
    oct.confirm();
    expect(db.select().from(schema.ingredientSnapshot).all()).toHaveLength(4);
    expect(listChanges()).toHaveLength(1);
  });
});
