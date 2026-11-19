import { test, expect } from "@playwright/test";

test("home filters and date search connect to space availability", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Where ideas/ })).toBeVisible();
  await expect(page.locator(".psd-space")).toHaveCount(6);
  await expect(page.getByRole("link", { name: /View all .* spaces/ })).toBeVisible();
  const filters = page.locator(".psd-filters");
  await filters.getByRole("button", { name: "Meeting", exact: true }).click();
  await expect(page.locator(".psd-space")).toHaveCount(1);
  await expect(
    page.locator(".psd-space").getByRole("heading", { name: "Meeting Room" }),
  ).toBeVisible();
  await filters.getByRole("button", { name: "Studio D", exact: true }).click();
  await expect(page.getByText("No spaces match these filters.")).toBeVisible();
  await filters.getByRole("button", { name: "All Spaces", exact: true }).click();
  const future = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Where").selectOption("enigma");
  await page.getByLabel("Choose a date").fill(future);
  await page.getByRole("button", { name: "Find and compare spaces" }).click();
  await expect(page).toHaveURL(new RegExp(`date=${future}`));
  await expect(page.getByLabel("Available date (Jamaica time)")).toHaveValue(future);
  await expect(page.getByText(/Availability is for each space/)).toBeVisible();
  await expect(page.getByText(/spaces match|space matches/)).toBeVisible({ timeout: 20000 });
});

test("home uses real text and aligns the footer with the header", async ({ page }) => {
  await page.goto("/");
  for (const width of [1400, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.evaluate(() => {
      const header = document
        .querySelector(".psd-header .site-header-inner")!
        .getBoundingClientRect();
      const footer = document.querySelector(".psd-footer .psd-wrap")!.getBoundingClientRect();
      return {
        headerLeft: header.left,
        headerRight: header.right,
        footerLeft: footer.left,
        footerRight: footer.right,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(Math.abs(layout.headerLeft - layout.footerLeft)).toBeLessThan(1);
    expect(Math.abs(layout.headerRight - layout.footerRight)).toBeLessThan(1);
    expect(layout.scrollWidth).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 1400, height: 900 });
  const heading = page.getByRole("heading", { name: /Where ideas/ });
  await expect(heading).toHaveCSS("opacity", "1");
  await expect(heading).not.toHaveCSS("color", "rgba(0, 0, 0, 0)");
  await expect(
    page.locator(".psd-footer").getByText("Workspace and production, together.", { exact: false }),
  ).toBeVisible();
  const sourceImages = await page
    .locator(".psd-header img, .psd-home img, .psd-footer img")
    .evaluateAll((images) => images.map((image) => image.getAttribute("src") ?? ""));
  expect(sourceImages.some((src) => /reference|\/type\/|hero\.png|meeting-card/.test(src))).toBe(
    false,
  );
});

test("home navigation remains usable for staff and visitors", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await page.getByRole("link", { name: "See Studio D spaces" }).click();
  await expect(page).toHaveURL(/\/studio-d$/);
  await page.goto("/");
  await page.getByRole("link", { name: "Ask for a quote" }).click();
  await expect(page).toHaveURL(/\/studio-d\/services\/studio-rental#enquiry$/);
  await expect(page.locator("#enquiry")).toBeVisible();
  await page.goto("/");
  await page
    .locator(".psd-footer")
    .getByRole("link", { name: "Help & enquiries", exact: true })
    .click();
  await expect(page).toHaveURL(/\/help$/);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("staff@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("testpassword");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.goto("/");
  const header = page.locator(".psd-header");
  await expect(header.getByRole("button", { name: "Sign out" })).toBeVisible();
  await header.getByRole("link", { name: "Staff", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
});

test("high contrast mode exposes the home page text and controls", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Where ideas/ })).toHaveCSS("opacity", "1");
  await expect(page.getByRole("button", { name: "Find and compare spaces" })).not.toHaveCSS(
    "color",
    "rgba(0, 0, 0, 0)",
  );
});
