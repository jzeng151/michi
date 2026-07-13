import { expect, test, type Page, type Route } from "@playwright/test";
import axe from "axe-core";
import {
  importPhotoFixtures,
  unplacedPhotoFixtures,
} from "./photo-fixtures";

const walkId = "10000000-0000-4000-8000-000000000002";
const walkPath = `/dashboard/walks/${walkId}`;
const walkTitle = "Nakasendo: Magome to Tsumago";

type StoredDraftSummary = {
  title: string;
  descriptions: string[];
  notes: string[];
  placedPhotos: number;
  uploads: string[];
};

async function storedDraftSummary(
  page: Page,
): Promise<StoredDraftSummary | null> {
  return page.evaluate(
    () =>
      new Promise<StoredDraftSummary | null>((resolve, reject) => {
        const open = indexedDB.open("michi");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          let request: IDBRequest;
          try {
            request = database
              .transaction("walk-drafts", "readonly")
              .objectStore("walk-drafts")
              .getAll();
          } catch (error) {
            database.close();
            reject(error);
            return;
          }
          request.onerror = () => {
            database.close();
            reject(request.error);
          };
          request.onsuccess = () => {
            const [draft] = request.result as Array<{
              title: string;
              photos: Array<{
                altText: string;
                lat: number | null;
                lng: number | null;
                upload: { status: string };
              }>;
              notes: Array<{ text: string }>;
            }>;
            database.close();
            resolve(
              draft
                ? {
                    title: draft.title,
                    descriptions: draft.photos.map(({ altText }) => altText),
                    notes: draft.notes.map(({ text }) => text),
                    placedPhotos: draft.photos.filter(
                      ({ lat, lng }) => lat !== null && lng !== null,
                    ).length,
                    uploads: draft.photos.map(({ upload }) => upload.status),
                  }
                : null,
            );
          };
        };
      }),
  );
}

async function importUnplacedPhotos(page: Page, count: number) {
  const files = unplacedPhotoFixtures(count);
  await page.locator('input[type="file"]').setInputFiles(files);
  await expect(
    page.getByText(`${count} of ${count} photos processed`),
  ).toBeVisible();
  return files;
}

function photoCard(page: Page, name: string) {
  return page.getByRole("listitem").filter({ hasText: name });
}

async function fillPhotoDescriptions(
  page: Page,
  files: ReturnType<typeof unplacedPhotoFixtures>,
  prefix: string,
) {
  for (const [index, file] of files.entries()) {
    const card = photoCard(page, file.name);
    await expect(card).toHaveCount(1);
    await card
      .getByLabel("Photo description (required)")
      .fill(`${prefix} ${index + 1}`);
  }
}

async function preparePhotoDraft(page: Page, count: number, title: string) {
  await page.goto("/dashboard/new");
  const files = await importUnplacedPhotos(page, count);
  await fillPhotoDescriptions(page, files, "Retry photo");
  await page.getByLabel("Title").fill(title);
  return files;
}

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
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/dashboard");
  await expect(page.getByRole("tab")).toHaveText(["Curated", "My walks"]);

  await page.getByRole("link", { name: /New walk/ }).click();

  await expect(page).toHaveURL(/\/dashboard\/new$/);
  await expect(page.getByRole("heading", { name: "New walk" })).toBeVisible();
  const placeAtCenter = page.getByRole("button", {
    name: "Place selected at map center",
  });
  await expect(placeAtCenter).toBeVisible();
  await expect(placeAtCenter).toBeDisabled();
  const photos = page.getByRole("region", { name: "Photos" });
  await expect(photos).toBeVisible();
  await expect(
    photos.getByRole("group", { name: "Photo import" }),
  ).toContainText("Drop photos here");
  await expect(photos.getByRole("button", { name: "Choose photos" })).toBeVisible();
  await expect(photos.locator('input[type="file"]')).toHaveAttribute(
    "multiple",
    "",
  );

  await page.getByLabel("Title").fill("Review feedback walk");
  await page.getByRole("button", { name: "Save walk" }).click();
  await expect(
    page.getByText("Add at least one photo or note before saving."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/new$/);

  await photos.locator('input[type="file"]').setInputFiles([importPhotoFixtures[1]]);
  await expect(page.getByText("1 of 1 photos processed")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unplaced (1)" })).toBeVisible();
  await page.getByRole("button", { name: "Select for placement" }).click();
  await expect(placeAtCenter).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 812, height: 375 });
  await expect(placeAtCenter).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/\b(?:GPS|audio)\b/i);
});

test("imports a photo batch without losing failed files", async ({ page }) => {
  await page.goto("/dashboard/new");

  await page.locator('input[type="file"]').setInputFiles(importPhotoFixtures);

  const queue = page.getByRole("list", { name: "Import queue" });
  const items = queue.getByRole("listitem");
  await expect(items).toHaveCount(3);
  await expect(page.getByText("3 of 3 photos processed")).toBeVisible();
  await expect(items.nth(0)).toContainText("located.jpg");
  await expect(items.nth(0)).toContainText("Located");
  await expect(items.nth(1)).toContainText("needs-placement.jpg");
  await expect(items.nth(1)).toContainText("Needs placement");
  await expect(items.nth(2)).toContainText("corrupt.jpg");
  await expect(items.nth(2)).toContainText("Failed");
  await expect(items.nth(2)).toContainText("Couldn’t read metadata");
  await expectNoHighImpactViolations(page);
});

test("restores and saves manually placed photos with a note-only stop", async ({
  page,
}) => {
  const title = "Recovered no-EXIF walk";
  const note = "Tea beside the old mile marker.";

  await page.goto("/dashboard/new");
  const files = await importUnplacedPhotos(page, 2);
  const map = page.getByRole("application", { name: "Map of walks" });
  await expect(map.locator(".maplibregl-canvas")).toBeVisible();

  await photoCard(page, files[0].name)
    .getByRole("button", { name: "Select for placement" })
    .click();
  const placeAtCenter = page.getByRole("button", {
    name: "Place selected at map center",
  });
  await placeAtCenter.focus();
  await expect(placeAtCenter).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/1 placed · 1 unplaced/)).toBeVisible();

  await page.getByRole("button", { name: "Add note-only stop" }).click();
  await page.getByRole("textbox", { name: /^Note \d+$/ }).fill(note);
  await fillPhotoDescriptions(page, files, "No-EXIF photo");
  await page.getByLabel("Title").fill(title);

  await expect.poll(() => storedDraftSummary(page)).toEqual({
    title,
    descriptions: ["No-EXIF photo 1", "No-EXIF photo 2"],
    notes: [note],
    placedPhotos: 1,
    uploads: ["pending", "pending"],
  });

  await page.reload();
  await expect(page.getByText("Draft restored from this browser.")).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue(title);
  await expect(page.getByRole("textbox", { name: /^Note \d+$/ })).toHaveValue(
    note,
  );
  await expect(page.getByText(/1 placed · 2 unplaced/)).toBeVisible();

  await page.getByRole("button", { name: "Save walk" }).click();
  await expect(page).toHaveURL(/\/dashboard\/walks\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  const stops = page
    .getByRole("region", { name: "Stops along this walk" })
    .getByRole("listitem");
  await expect(stops).toHaveCount(3);
  await expect(stops.nth(0).getByRole("img", { name: "No-EXIF photo 1" })).toBeVisible();
  await expect(stops.nth(1).getByRole("img", { name: "No-EXIF photo 2" })).toBeVisible();
  await expect(stops.nth(2)).toContainText(note);

  await page.reload();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Stops along this walk" }).getByRole("listitem"),
  ).toHaveCount(3);
  await expect(page.getByText(note)).toBeVisible();
});

test("keeps a 100-photo draft editable while reporting progress", async ({
  page,
}) => {
  await page.goto("/dashboard/new");
  const files = unplacedPhotoFixtures(100);
  await page.locator('input[type="file"]').setInputFiles(files);

  await page.getByLabel("Title").fill("Hundred photo draft");
  await expect(page.getByLabel("Title")).toHaveValue("Hundred photo draft");
  await expect(page.getByText("100 of 100 photos processed")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unplaced (100)" })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Unplaced tray" }).getByRole("listitem"),
  ).toHaveCount(100);
});

test("retries only a failed upload and keeps its draft across reload", async ({
  page,
}) => {
  let uploadRequests = 0;
  await page.route("**/storage/v1/object/walk-media/**", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    uploadRequests += 1;
    if (uploadRequests === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Forced upload failure" }),
      });
      return;
    }
    await route.continue();
  });

  await preparePhotoDraft(page, 2, "Upload retry walk");
  await page.getByRole("button", { name: "Save walk" }).click();
  await expect(
    page.getByText(
      "1 photo failed to upload. Retry save to upload only the failed items.",
    ),
  ).toBeVisible();
  await expect(page.getByText("1 of 2 photos uploaded")).toBeVisible();
  await expect
    .poll(async () => (await storedDraftSummary(page))?.uploads.toSorted())
    .toEqual(["error", "uploaded"]);

  await page.reload();
  await expect(page.getByText("Draft restored from this browser.")).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Upload retry walk");
  await page.getByRole("button", { name: "Save walk" }).click();
  await expect(page).toHaveURL(/\/dashboard\/walks\/[0-9a-f-]+$/);
  expect(uploadRequests).toBe(3);
});

test("cleans new uploads after a failed save contract and retries safely", async ({
  page,
}) => {
  let rpcRequests = 0;
  let uploadRequests = 0;
  let cleanupRequests = 0;
  page.on("request", (request) => {
    if (!request.url().includes("/storage/v1/object/walk-media")) return;
    if (request.method() === "POST") uploadRequests += 1;
    if (request.method() === "DELETE") cleanupRequests += 1;
  });
  await page.route("**/rest/v1/rpc/save_walk_draft", async (route) => {
    rpcRequests += 1;
    if (rpcRequests === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          code: "XX000",
          details: null,
          hint: null,
          message: "Forced database failure",
        }),
      });
      return;
    }
    await route.continue();
  });

  await preparePhotoDraft(page, 1, "Database retry walk");
  await page.getByRole("button", { name: "Save walk" }).click();
  await expect(
    page.getByText(
      /Couldn't save the walk: Forced database failure.*Uploaded files were cleaned up/,
    ),
  ).toBeVisible();
  await expect.poll(() => cleanupRequests).toBe(1);
  await expect.poll(async () => (await storedDraftSummary(page))?.uploads).toEqual([
    "pending",
  ]);

  await page.reload();
  await expect(page.getByText("Draft restored from this browser.")).toBeVisible();
  await page.getByRole("button", { name: "Save walk" }).click();
  await expect(page).toHaveURL(/\/dashboard\/walks\/[0-9a-f-]+$/);
  expect(rpcRequests).toBe(2);
  expect(uploadRequests).toBe(2);
  expect(cleanupRequests).toBe(1);
});

test("preserves a browser draft when the session expires before save", async ({
  page,
}) => {
  const note = "Saved locally while signed out.";
  await page.goto("/dashboard/new");
  await page.getByRole("button", { name: "Add note-only stop" }).click();
  await page.getByRole("textbox", { name: /^Note \d+$/ }).fill(note);
  await page.getByLabel("Title").fill("Expired session draft");
  await expect.poll(() => storedDraftSummary(page)).toMatchObject({
    title: "Expired session draft",
    notes: [note],
  });

  await page.route("**/auth/v1/user", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ code: "bad_jwt", message: "JWT expired" }),
    }),
  );
  await page.getByRole("button", { name: "Save walk" }).click();
  await expect(
    page.getByText(
      "Your session expired. Sign in again; this draft is saved on this browser.",
    ),
  ).toBeVisible();

  await page.unroute("**/auth/v1/user");
  await page.reload();
  await expect(page.getByText("Draft restored from this browser.")).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Expired session draft");
  await expect(page.getByRole("textbox", { name: /^Note \d+$/ })).toHaveValue(
    note,
  );
  await page.getByRole("button", { name: "Save walk" }).click();
  await expect(page).toHaveURL(/\/dashboard\/walks\/[0-9a-f-]+$/);
});

test("saves a new walk when browser draft recovery is blocked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(IDBFactory.prototype, "open", {
      configurable: true,
      value() {
        const calls = Number(sessionStorage.getItem("idb-open-calls") ?? 0) + 1;
        sessionStorage.setItem("idb-open-calls", String(calls));
        throw new DOMException("IndexedDB is blocked", "SecurityError");
      },
    });
  });

  await page.goto("/dashboard/new");
  await expect(
    page.getByRole("heading", { name: "Draft recovery failed" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start without browser recovery" })
    .click();
  await expect(
    page.getByText(
      "Started a new walk without browser recovery. The existing browser draft was left untouched.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add note-only stop" }).click();
  await page.getByRole("textbox", { name: /^Note \d+$/ }).fill("No local storage.");
  await page.getByLabel("Title").fill("Storage fallback walk");
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(() => sessionStorage.getItem("idb-open-calls")),
  ).toBe("1");

  await page.getByRole("button", { name: "Save walk" }).click();
  await expect(page).toHaveURL(/\/dashboard\/walks\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { name: "Storage fallback walk" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("idb-open-calls")),
  ).toBe("1");
});

test("continues saving when browser draft writes stop working", async ({
  page,
}) => {
  await page.goto("/dashboard/new");
  await page.getByRole("button", { name: "Add note-only stop" }).click();
  await page.getByRole("textbox", { name: /^Note \d+$/ }).fill("Still in this tab.");
  await page.getByLabel("Title").fill("Earlier browser copy");
  await expect.poll(() => storedDraftSummary(page)).toMatchObject({
    title: "Earlier browser copy",
    notes: ["Still in this tab."],
  });

  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    Object.defineProperty(IDBObjectStore.prototype, "put", {
      configurable: true,
      value(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
        if (this.name === "walk-drafts") {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
        return key === undefined
          ? put.call(this, value)
          : put.call(this, value, key);
      },
    });
  });

  let releaseRpc: () => void = () => {};
  const rpcGate = new Promise<void>((resolve) => {
    releaseRpc = resolve;
  });
  await page.route("**/rest/v1/rpc/save_walk_draft", async (route) => {
    await rpcGate;
    await route.continue();
  });

  await page.getByLabel("Title").fill("Saved despite quota");
  await page.getByRole("button", { name: "Save walk" }).click();
  await expect(
    page.getByText(
      "Browser recovery stopped working. Keep this tab open until the walk is saved; any earlier browser draft was left untouched.",
    ),
  ).toBeVisible();
  await expect(page.getByText(/Quota exceeded/)).toBeVisible();

  releaseRpc();
  await expect(page).toHaveURL(/\/dashboard\/walks\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { name: "Saved despite quota" }),
  ).toBeVisible();
  await expect.poll(() => storedDraftSummary(page)).toMatchObject({
    title: "Earlier browser copy",
    notes: ["Still in this tab."],
  });
});

test("restores a local draft while saved-status confirmation is unavailable", async ({
  page,
}) => {
  await page.goto("/dashboard/new");
  const [photo] = await importUnplacedPhotos(page, 1);
  await fillPhotoDescriptions(page, [photo], "Unconfirmed photo");
  await page.getByRole("button", { name: "Add note-only stop" }).click();
  await page.getByRole("textbox", { name: /^Note \d+$/ }).fill("Keep editing offline.");
  await page.getByLabel("Title").fill("Unconfirmed restored draft");
  await expect.poll(() => storedDraftSummary(page)).toMatchObject({
    title: "Unconfirmed restored draft",
  });

  let rpcRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/rest/v1/rpc/save_walk_draft")) rpcRequests += 1;
  });
  const failConfirmation = async (route: Route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        code: "XX000",
        message: "Forced confirmation failure",
      }),
    });
  };
  await page.route("**/rest/v1/walks**", failConfirmation);

  await page.reload();
  await expect(
    page.getByText(/Draft restored, but its saved status couldn't be confirmed/),
  ).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Unconfirmed restored draft");
  await expect(
    photoCard(page, photo.name).getByRole("button", {
      name: `Remove ${photo.name}`,
    }),
  ).toHaveCount(0);
  await expect(photoCard(page, photo.name)).toContainText(
    "Photo removal is disabled while this draft may belong to a saved walk.",
  );
  await page.getByLabel("Title").fill("Edited while unconfirmed");
  await page.getByRole("button", { name: "Save walk" }).click();
  await expect(
    page.getByText(/Couldn't confirm whether this draft was already saved/),
  ).toBeVisible();
  expect(rpcRequests).toBe(0);

  await page.unroute("**/rest/v1/walks**", failConfirmation);
  await page.getByRole("button", { name: "Save walk" }).click();
  await expect(page).toHaveURL(/\/dashboard\/walks\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { name: "Edited while unconfirmed" }),
  ).toBeVisible();
  expect(rpcRequests).toBe(1);
});

test("opens a saved walk when browser draft cleanup stays blocked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const remove = IDBObjectStore.prototype.delete;
    Object.defineProperty(IDBObjectStore.prototype, "delete", {
      configurable: true,
      value(this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) {
        if (this.name === "walk-drafts") {
          throw new DOMException("Draft deletion blocked", "InvalidStateError");
        }
        return remove.call(this, key);
      },
    });
  });

  await page.goto("/dashboard/new");
  await page.getByRole("button", { name: "Add note-only stop" }).click();
  await page.getByRole("textbox", { name: /^Note \d+$/ }).fill("Saved safely.");
  await page.getByLabel("Title").fill("Cleanup blocked walk");
  await page.getByRole("button", { name: "Save walk" }).click();

  await expect(page.getByRole("heading", { name: "Walk saved" })).toBeVisible();
  await expect(page.getByText(/Draft deletion blocked/)).toBeVisible();
  const openSavedWalk = page.getByRole("link", { name: "Open saved walk" });
  const savedPath = await openSavedWalk.getAttribute("href");
  expect(savedPath).toMatch(/^\/dashboard\/walks\/[0-9a-f-]+$/);
  await openSavedWalk.click();
  await expect(page).toHaveURL(new RegExp(`${savedPath}$`));
  await expect(
    page.getByRole("heading", { name: "Cleanup blocked walk" }),
  ).toBeVisible();
  await expect.poll(() => storedDraftSummary(page)).not.toBeNull();

  await page.goto("/dashboard/new");
  await expect(page).toHaveURL(/\/dashboard\/new$/);
  await expect(
    page.getByText(/This browser draft belongs to a saved walk/),
  ).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Cleanup blocked walk");

  await page.getByLabel("Title").fill("Cleanup blocked walk updated");
  await page.getByRole("button", { name: "Save walk" }).click();
  await expect(page.getByRole("heading", { name: "Walk saved" })).toBeVisible();
  await page.getByRole("link", { name: "Open saved walk" }).click();
  await expect(
    page.getByRole("heading", { name: "Cleanup blocked walk updated" }),
  ).toBeVisible();

  await page.goto("/dashboard/new");
  await page
    .getByRole("button", { name: "Start a new walk without browser recovery" })
    .click();
  await expect(page.getByLabel("Title")).toHaveValue("");
  await expect(
    page.getByText(/existing browser draft was left untouched/),
  ).toBeVisible();
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
