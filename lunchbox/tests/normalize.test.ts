import { describe, expect, it } from "vitest";
import { matchDishName, nameSimilarity, normalizeName, tokenSortedName } from "@/lib/normalize";

describe("normalizeName", () => {
  it("lowercases, strips punctuation, collapses whitespace and drops filler words", () => {
    expect(normalizeName("  Chicken   Teriyaki Bowl! ")).toBe("chicken teriyaki bowl");
    expect(normalizeName("Mac & Cheese")).toBe("mac cheese");
    expect(normalizeName("Mac and Cheese")).toBe("mac cheese");
    expect(normalizeName("Burger w/ Fries")).toBe("burger fries");
    expect(normalizeName("Pasta with Meat-Sauce")).toBe("pasta meat sauce");
    expect(normalizeName("Crème Brûlée")).toBe("creme brulee");
  });
  it("token sort ignores word order", () => {
    expect(tokenSortedName("Teriyaki Chicken Bowl")).toBe(tokenSortedName("Chicken Teriyaki Bowl"));
  });
});

describe("matchDishName", () => {
  const cands = [
    { dishId: 1, name: "Teriyaki Chicken Rice Bowl", canonicalName: "Teriyaki Chicken Rice Bowl" },
    { dishId: 2, name: "Cheese Pizza", canonicalName: "Cheese Pizza" },
    { dishId: 1, name: "Chicken Teriyaki Bowl", canonicalName: "Teriyaki Chicken Rice Bowl" },
    { dishId: 3, name: "Mac & Cheese", canonicalName: "Mac & Cheese" },
  ];
  it("auto-links exact normalized matches, including aliases", () => {
    expect(matchDishName("cheese pizza.", cands)).toMatchObject({ kind: "exact", dishId: 2 });
    expect(matchDishName("CHICKEN TERIYAKI BOWL", cands)).toMatchObject({ kind: "exact", dishId: 1 });
    expect(matchDishName("Mac and Cheese", cands)).toMatchObject({ kind: "exact", dishId: 3 });
  });
  it("suggests fuzzy matches at >= 0.85 similarity", () => {
    const r = matchDishName("Teriyaki Chicken Bowl", cands); // reordered alias
    expect(r).toMatchObject({ kind: "fuzzy", dishId: 1 });
    const r2 = matchDishName("Chese Pizza", cands); // typo
    expect(r2).toMatchObject({ kind: "fuzzy", dishId: 2 });
  });
  it("proposes a new dish otherwise", () => {
    const r = matchDishName("Beef Tacos", cands);
    expect(r.kind).toBe("new");
  });
  it("similarity is symmetric and 1 for identical names", () => {
    expect(nameSimilarity("Beef Tacos", "Beef Tacos")).toBe(1);
    expect(nameSimilarity("a b", "b a")).toBe(1);
  });
});
