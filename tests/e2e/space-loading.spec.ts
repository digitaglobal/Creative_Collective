import { test, expect } from "@playwright/test";

test("space page shows loading placeholders until catalog, photos and times resolve", async ({
  page,
}) => {
  await page.goto("/spaces");
  const meeting = page.getByRole("link", {
    name: "View details / enquire about Meeting room",
    exact: true,
  });
  await expect(meeting).toBeVisible();

  let releaseCatalog!: () => void;
  const catalogGate = new Promise<void>((resolve) => {
    releaseCatalog = resolve;
  });
  await page.route("**/rest/v1/rpc/public_catalog", async (route) => {
    await catalogGate;
    await route.continue();
  });

  let releasePhoto!: () => void;
  const photoGate = new Promise<void>((resolve) => {
    releasePhoto = resolve;
  });
  await page.route("**/images/venues/enigma-meeting.jpg", async (route) => {
    await photoGate;
    await route.continue();
  });

  let releaseTimes!: () => void;
  const timesGate = new Promise<void>((resolve) => {
    releaseTimes = resolve;
  });
  await page.route("**/rest/v1/rpc/available_slots", async (route) => {
    await timesGate;
    await route.continue();
  });

  await meeting.click();
  await expect(page.getByRole("status", { name: "Loading space details" })).toBeVisible();
  await expect(page.locator(".space-page-pending .space-gallery-item")).toHaveCount(5);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".space-page-pending .space-gallery-item").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  releaseCatalog();
  await expect(page.getByRole("heading", { name: "Meeting room", exact: true })).toBeVisible();
  const imageFrame = page.locator(".space-image-frame").filter({
    has: page.getByRole("img", {
      name: "Enigma meeting room with a table, blue chairs and wall display",
    }),
  });
  await expect(imageFrame).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("status").filter({ hasText: "Checking availability" })).toBeVisible();
  await expect(page.getByLabel("Start time", { exact: true })).toBeDisabled();
  releasePhoto();
  releaseTimes();
  await expect(imageFrame).toHaveAttribute("aria-busy", "false");
  await expect(page.getByLabel("Start time", { exact: true })).toBeEnabled();
  await expect(page.getByRole("status").filter({ hasText: "Checking availability" })).toHaveCount(
    0,
  );
});

test("a failed gallery image replaces its skeleton with the image fallback", async ({ page }) => {
  await page.route("**/images/venues/enigma-meeting.jpg", (route) => route.abort());
  await page.goto("/enigma/services/meeting-room");
  await expect(page.getByRole("img", { name: /Placeholder for:/ }).first()).toBeVisible();
});

test("a failed space request leaves the loading state and offers recovery", async ({ page }) => {
  await page.goto("/spaces");
  const meeting = page.getByRole("link", {
    name: "View details / enquire about Meeting room",
    exact: true,
  });
  await expect(meeting).toBeVisible();
  await page.route("**/rest/v1/rpc/public_catalog", (route) => route.abort());
  await meeting.click();
  await expect(page.getByRole("heading", { name: "This page didn't load" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Loading space details" })).toHaveCount(0);
});
