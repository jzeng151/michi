import { expect, test as setup } from "@playwright/test";

const authFile = "test-results/.auth/user.json";

setup("authenticate the seeded user", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill("michi@seed.local");
  await page.getByLabel("Password").fill("michi-demo-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("tab", { name: "Curated" })).toBeVisible();
  await page.context().storageState({ path: authFile });
});
