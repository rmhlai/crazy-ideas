import { expect, test } from "@playwright/test";

test("add child → upload form → confirm → rate a lunch → ranking updates", async ({ page }) => {
  // 1. add a child
  await page.goto("/children");
  await page.getByLabel("Name").fill("Maya");
  await page.getByLabel("Ingredient watch-list").fill("mushroom");
  await page.getByRole("button", { name: "Add child" }).click();
  await expect(page.getByText("Maya", { exact: true })).toBeVisible();
  await expect(page.getByText("⚠️ mushroom")).toBeVisible();

  // 2. upload an order form (the parse step is mocked with fixtures/mock/order_form.json)
  await page.goto("/uploads/new");
  await page.getByLabel(/Files/).setInputFiles("fixtures/samples/order-form-2026-09.png");
  await page.getByRole("button", { name: "Upload & read" }).click();
  await expect(page).toHaveURL(/\/uploads\/\d+$/);

  // 3. review screen: extracted days, low-confidence warning, new dishes
  await expect(page.getByRole("button", { name: /Confirm 3 lunches/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("The tick on Sept 11 is faint.")).toBeVisible();
  await expect(page.getByText("new dish").first()).toBeVisible();
  await page.getByRole("button", { name: /Confirm 3 lunches/ }).click();
  await expect(page.getByText(/Saved: 3 lunches added/)).toBeVisible();

  // 4. rate a lunch
  await page.goto("/feedback");
  await expect(page.getByText("3 to rate")).toBeVisible();
  const card = page.locator("li", { hasText: "Cheese Pizza" });
  await card.getByRole("button", { name: "Thumbs up" }).click();
  await expect(card.getByText("Saved ✓")).toBeVisible();
  await expect(page.getByText("2 to rate")).toBeVisible();

  // 5. ranking reflects it
  await page.goto("/rankings");
  const favs = page.locator("section", { hasText: "🏆 Favourites" });
  await expect(favs.getByText("Cheese Pizza")).toBeVisible();
  await expect(favs.getByText("1 👍 · 0 👎")).toBeVisible();
  await expect(page.locator("section", { hasText: "Not rated yet" }).getByText("Mac & Cheese")).toBeVisible();

  // 6. the calendar shows the PA day and the lunches
  await page.goto("/calendar?month=2026-09&day=2026-09-10");
  await expect(page.getByText("📌 PA Day")).toBeVisible();
});
