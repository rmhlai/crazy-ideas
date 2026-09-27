import { describe, expect, it } from "vitest";
import { categorize, mergeTallies, rankDishes, smoothedScore } from "@/lib/ranking";

describe("smoothedScore", () => {
  it("uses (ups + a) / (ups + downs + a + b)", () => {
    expect(smoothedScore(0, 0)).toBe(0.5);
    expect(smoothedScore(1, 0)).toBeCloseTo(3 / 5);
    expect(smoothedScore(7, 1)).toBeCloseTo(9 / 12);
    expect(smoothedScore(1, 0, { a: 1, b: 1 })).toBeCloseTo(2 / 3);
  });
  it("one lucky thumbs-up does not beat a dish loved ten times", () => {
    const r = rankDishes([
      { dishId: 1, ups: 1, downs: 0, lastUpAt: "2026-09-20" },
      { dishId: 2, ups: 10, downs: 1, lastUpAt: "2026-09-01" },
    ]);
    expect(r.map((x) => x.dishId)).toEqual([2, 1]);
  });
});

describe("tie-breaks", () => {
  it("more total ratings wins a tie on score, then most recent thumbs-up", () => {
    // 2/4 == 0.5 and 4/8 == 0.5
    const r = rankDishes([
      { dishId: 1, ups: 0, downs: 0, lastUpAt: null },
      { dishId: 2, ups: 2, downs: 2, lastUpAt: "2026-09-01" },
      { dishId: 3, ups: 2, downs: 2, lastUpAt: "2026-09-10" },
    ]);
    expect(r.map((x) => x.dishId)).toEqual([3, 2, 1]);
  });
});

describe("categorize", () => {
  it("splits favourites / not a hit / unrated", () => {
    const c = categorize([
      { dishId: 1, ups: 5, downs: 0, lastUpAt: "x" },
      { dishId: 2, ups: 0, downs: 3, lastUpAt: null }, // 2/7 = .29, 3 ratings
      { dishId: 3, ups: 0, downs: 1, lastUpAt: null }, // 2/5 = .4 and only 1 rating
      { dishId: 4, ups: 0, downs: 0, lastUpAt: null },
    ]);
    expect(c.favourites.map((f) => f.dishId)).toEqual([1, 3]);
    expect(c.notAHit.map((f) => f.dishId)).toEqual([2]);
    expect(c.unrated).toEqual([4]);
  });
  it("household merge sums ups/downs across children", () => {
    const m = mergeTallies([
      { dishId: 1, ups: 2, downs: 0, lastUpAt: "a" },
      { dishId: 1, ups: 1, downs: 1, lastUpAt: "b" },
      { dishId: 2, ups: 0, downs: 1, lastUpAt: null },
    ]);
    expect(m.find((t) => t.dishId === 1)).toEqual({ dishId: 1, ups: 3, downs: 1, lastUpAt: "b" });
  });
});
