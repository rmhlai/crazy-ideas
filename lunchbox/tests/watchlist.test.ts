import { describe, expect, it } from "vitest";
import { termMatches, watchHits } from "@/lib/watchlist";

describe("watch-list matching", () => {
  it("matches whole words, plural-insensitive", () => {
    expect(termMatches("mushroom", "button mushrooms")).toBe(true);
    expect(termMatches("pea", "peanut butter")).toBe(false);
    expect(termMatches("peanut", "Peanut Butter")).toBe(true);
    expect(termMatches("red pepper", "roasted red peppers")).toBe(true);
  });
  it("checks sub-ingredients and declared allergens", () => {
    const ingredients = ["crust", "enriched wheat flour", "mozzarella cheese"];
    expect(watchHits(["wheat"], ingredients)).toEqual(["wheat"]);
    expect(watchHits(["sesame"], ingredients, ["sesame"])).toEqual(["sesame"]);
    expect(watchHits(["mushroom"], ingredients)).toEqual([]);
  });
  it("expands family terms like dairy and tree nuts", () => {
    expect(watchHits(["dairy"], ["mozzarella cheese"])).toEqual(["dairy"]);
    expect(watchHits(["tree nuts"], ["almond flour"])).toEqual(["tree nuts"]);
    expect(watchHits(["gluten"], ["barley malt"])).toEqual(["gluten"]);
  });
});
