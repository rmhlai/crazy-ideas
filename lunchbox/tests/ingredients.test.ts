import { describe, expect, it } from "vitest";
import { diffSnapshots, flattenIngredients, formatIngredients, isEmptyDiff, parseIngredientText } from "@/lib/ingredients";

describe("ingredient diff", () => {
  const sept = {
    ingredients: [
      { name: "Rice" },
      { name: "enriched flour", sub_ingredients: ["wheat flour", "niacin", "iron"] },
      { name: "Soy Sauce", sub_ingredients: ["water", "soybeans"] },
    ],
    allergens: ["wheat", "soy"],
  };
  it("flattens nested sub-ingredients", () => {
    expect(flattenIngredients(sept.ingredients)).toEqual([
      "rice",
      "enriched flour",
      "wheat flour",
      "niacin",
      "iron",
      "soy sauce",
      "water",
      "soybeans",
    ]);
  });
  it("detects added and removed ingredients including nested ones", () => {
    const oct = {
      ingredients: [
        { name: "rice" },
        { name: "Enriched Flour", sub_ingredients: ["wheat flour", "niacin", "folic acid"] },
        { name: "soy sauce", sub_ingredients: ["water", "soybeans"] },
        { name: "Sesame Oil" },
      ],
      allergens: ["wheat", "soy", "Sesame"],
    };
    const d = diffSnapshots(sept, oct);
    expect(d.added.sort()).toEqual(["folic acid", "sesame oil"]);
    expect(d.removed).toEqual(["iron"]);
    expect(d.allergensAdded).toEqual(["sesame"]);
    expect(d.allergensRemoved).toEqual([]);
  });
  it("case and punctuation changes are not changes", () => {
    const d = diffSnapshots(sept, {
      ingredients: [
        { name: "RICE." },
        { name: "enriched  flour", sub_ingredients: ["Wheat Flour", "niacin", "iron"] },
        { name: "soy sauce", sub_ingredients: ["water", "soybeans"] },
      ],
      allergens: ["Soy", "wheat"],
    });
    expect(isEmptyDiff(d)).toBe(true);
  });
});

describe("ingredient text round-trip", () => {
  it("formats nested ingredients in parentheses", () => {
    expect(formatIngredients([{ name: "a" }, { name: "b", sub_ingredients: ["c", "d"] }])).toBe("a, b (c, d)");
  });
  it("parses text back into nested nodes", () => {
    expect(parseIngredientText("rice, enriched flour (wheat flour, niacin), water.")).toEqual([
      { name: "rice" },
      { name: "enriched flour", sub_ingredients: ["wheat flour", "niacin"] },
      { name: "water" },
    ]);
  });
  it("flattens deeper nesting into the parent", () => {
    expect(parseIngredientText("sauce (soy sauce (water, soybeans), sugar)")).toEqual([
      { name: "sauce", sub_ingredients: ["soy sauce", "water", "soybeans", "sugar"] },
    ]);
  });
});
