import { describe, expect, it } from "vitest";
import { ingredientInsights } from "@/lib/insights";

describe("ingredient insights", () => {
  it("reports ingredients in >= 3 rated dishes with a clear up-rate difference", () => {
    const r = ingredientInsights([
      { dishId: 1, ups: 0, downs: 2, ingredients: ["peppers", "rice"] },
      { dishId: 2, ups: 0, downs: 1, ingredients: ["peppers", "beef"] },
      { dishId: 3, ups: 1, downs: 2, ingredients: ["peppers", "chicken"] },
      { dishId: 4, ups: 3, downs: 0, ingredients: ["rice", "chicken"] },
      { dishId: 5, ups: 2, downs: 0, ingredients: ["pasta"] },
    ]);
    const peppers = r.find((i) => i.ingredient === "peppers")!;
    expect(peppers.dishesWith).toBe(3);
    expect(peppers.delta).toBeLessThan(-0.5);
    // rice appears in only 2 dishes
    expect(r.find((i) => i.ingredient === "rice")).toBeUndefined();
  });
});
