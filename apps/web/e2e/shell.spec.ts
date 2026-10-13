import { expect, test } from "@playwright/test";

test("home, clock choice, and board theme", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("record of every move");
  await page.getByRole("link", { name: "Choose a clock" }).click();
  await page.getByRole("button", { name: /15 \+ 10/ }).click();
  await expect(page.getByText("Rapid pool")).toBeVisible();
  await expect(page.getByText("900,000 ms, plus 10,000 ms").first()).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: /Walnut/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-board-theme", "walnut");
  await expect(page.getByRole("img", { name: /walnut board/i })).toBeVisible();
});

test("mobile menu reaches the lobby", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Play" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Choose a clock" })).toBeVisible();
});
