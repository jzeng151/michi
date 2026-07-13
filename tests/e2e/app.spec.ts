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

test("opens the authenticated dashboard and seeded walk", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("tab", { name: "Curated", selected: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: new RegExp(walkTitle) }).click();

  await expect(page).toHaveURL(new RegExp(`${walkId}$`));
  await expect(page.getByRole("heading", { name: walkTitle })).toBeVisible();
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

test("has no critical or serious accessibility violations", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("tab", { name: "Curated" })).toBeVisible();
  await expectNoHighImpactViolations(page);

  await page.goto(walkPath);
  await expect(page.getByRole("heading", { name: walkTitle })).toBeVisible();
  await expectNoHighImpactViolations(page);
});
