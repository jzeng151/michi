import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";

const walkId = "10000000-0000-4000-8000-000000000002";
const walkPath = `/dashboard/walks/${walkId}`;
const walkTitle = "Nakasendo: Magome to Tsumago";

async function expectNoHighImpactViolations(page: Page) {
  await page.addScriptTag({ content: axe.source });
  const { violations } = await page.evaluate(() =>
    (window as unknown as { axe: typeof axe }).axe.run(),
  );
  expect(
    violations.filter(
      ({ impact }) => impact === "critical" || impact === "serious",
    ),
  ).toEqual([]);
}

test("shows only v1 collections and photo-first walk creation", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("tab")).toHaveText(["Curated", "My walks"]);

  await page.getByRole("link", { name: /New walk/ }).click();

  await expect(page).toHaveURL(/\/dashboard\/new$/);
  await expect(page.getByRole("heading", { name: "New walk" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add point at map center" }),
  ).toBeVisible();
  const photos = page.getByRole("region", { name: "Photos" });
  await expect(photos).toBeVisible();
  await page.getByRole("button", { name: "Add point at map center" }).click();
  await expect(photos.getByText("Add photo")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/\b(?:GPS|audio)\b/i);
});

test("opens and replays the seeded photo walk without social controls", async ({
  page,
}) => {
  await page.goto("/dashboard");

  await page.getByRole("link", { name: new RegExp(walkTitle) }).click();

  await expect(page).toHaveURL(new RegExp(`${walkId}$`));
  await expect(page.getByRole("heading", { name: walkTitle })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /(?:un)?like this walk/i }),
  ).toHaveCount(0);
  await expect(page.getByText("Likes:", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Follow(?:ing)?\b/i }),
  ).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Comments" })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/\b(?:GPS|audio)\b/i);
  await expect(
    page.getByRole("button", { name: "Play this walk" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Step through stops" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Step through stops" }).click();
  const dialog = page.getByRole("dialog", {
    name: `Walk playback: ${walkTitle}`,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Stop 1 of 2", { exact: false })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Next/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Exit/ })).toBeVisible();
});

test("keeps the public walk page photo-first and social-free", async ({ page }) => {
  await page.goto(`/walks/${walkId}`);

  await expect(page.getByRole("heading", { name: walkTitle })).toBeVisible();
  await expect(page.getByText("Likes:", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Comments" })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/\b(?:GPS|audio)\b/i);
});

test("has no critical or serious accessibility violations", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("tab", { name: "Curated" })).toBeVisible();
  await expectNoHighImpactViolations(page);

  await page.goto(walkPath);
  await expect(page.getByRole("heading", { name: walkTitle })).toBeVisible();
  await expectNoHighImpactViolations(page);
});
