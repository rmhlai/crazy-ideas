/**
 * Demo data: one fake child, a few dishes with ingredient lists, some past lunches
 * (a couple rated) and next month's menu for the planner.
 *   npm run db:seed            (skips if children already exist)
 *   npm run db:seed -- --force
 */
import { getDb, dbPath, schema } from "../src/lib/db";
import { createChild } from "../src/lib/services/children";
import { createDish, touchDishDates } from "../src/lib/services/dishes";
import { createOrder, setFeedback } from "../src/lib/services/orders";
import { addDays, currentMonth, isWeekend, monthDates, todayISO, upcomingMonth } from "../src/lib/dates";
import { normalizeIngredient } from "../src/lib/ingredients";

const db = getDb();
if (db.select().from(schema.child).all().length && !process.argv.includes("--force")) {
  console.log("Children already exist — skipping seed (use --force to add demo data anyway).");
  process.exit(0);
}

const DISHES: Record<string, { ingredients: [string, string[]?][]; allergens: string[]; price: number }> = {
  "Teriyaki Chicken Rice Bowl": {
    ingredients: [["rice"], ["chicken", ["chicken", "salt"]], ["teriyaki sauce", ["soy sauce", "sugar", "ginger"]], ["broccoli"]],
    allergens: ["soy", "wheat"],
    price: 650,
  },
  "Cheese Pizza": {
    ingredients: [["crust", ["enriched wheat flour", "water", "yeast"]], ["tomato sauce"], ["mozzarella cheese"]],
    allergens: ["wheat", "milk"],
    price: 575,
  },
  "Mac & Cheese": {
    ingredients: [["macaroni", ["durum wheat semolina"]], ["cheddar cheese sauce", ["milk", "cheddar cheese", "butter"]]],
    allergens: ["wheat", "milk"],
    price: 550,
  },
  "Veggie Wrap": {
    ingredients: [["flour tortilla", ["wheat flour", "canola oil"]], ["hummus", ["chickpeas", "tahini"]], ["cucumber"], ["mushrooms"]],
    allergens: ["wheat", "sesame"],
    price: 600,
  },
  "Beef Tacos": {
    ingredients: [["corn tortilla"], ["seasoned beef", ["beef", "chili powder", "cumin"]], ["lettuce"], ["cheddar cheese"]],
    allergens: ["milk"],
    price: 625,
  },
};

const child = createChild({ name: "Sam", grade: "3", school: "Maple Street Elementary", color: "#3b82f6", watchlist: ["mushroom"] });
const month = currentMonth();
const ids: Record<string, number> = {};
for (const [name, d] of Object.entries(DISHES)) {
  const id = createDish(db, name, "Sunny Lunch Co.");
  ids[name] = id;
  const snap = db
    .insert(schema.ingredientSnapshot)
    .values({ dishId: id, effectiveMonth: month, rawText: "", declaredAllergens: d.allergens })
    .returning()
    .get();
  let pos = 0;
  const ing = (n: string) => {
    const norm = normalizeIngredient(n);
    return (
      db.select().from(schema.ingredient).all().find((x) => x.normalizedName === norm)?.id ??
      db.insert(schema.ingredient).values({ name: n, normalizedName: norm }).returning().get().id
    );
  };
  for (const [top, subs] of d.ingredients) {
    const pid = ing(top);
    db.insert(schema.snapshotIngredient).values({ snapshotId: snap.id, ingredientId: pid, position: pos++ }).run();
    for (const s of subs ?? []) {
      db.insert(schema.snapshotIngredient).values({ snapshotId: snap.id, ingredientId: ing(s), parentIngredientId: pid, position: pos++ }).run();
    }
  }
}

// This month's lunches up to a few days ahead; rate most past ones.
const names = Object.keys(DISHES).filter((n) => n !== "Veggie Wrap");
const today = todayISO();
let i = 0;
for (const date of monthDates(month)) {
  if (isWeekend(date) || date > addDays(today, 3)) continue;
  const name = names[i++ % names.length];
  const o = createOrder({ childId: child.id, date, dishId: ids[name], priceCents: DISHES[name].price });
  if (date < today && i % 5 !== 0) setFeedback(o.id, name === "Beef Tacos" ? -1 : 1);
}

// Next month's menu (for the planner).
const next = upcomingMonth();
const opts = Object.keys(DISHES);
let j = 0;
for (const date of monthDates(next)) {
  if (isWeekend(date)) continue;
  for (const [label, name] of [
    ["A", opts[j % opts.length]],
    ["B", opts[(j + 2) % opts.length]],
  ] as const) {
    db.insert(schema.menuOffering).values({ date, dishId: ids[name], optionLabel: label, priceCents: DISHES[name].price }).run();
    touchDishDates(db, ids[name], date);
  }
  j++;
}

console.log(`Seeded demo data into ${dbPath()}`);
