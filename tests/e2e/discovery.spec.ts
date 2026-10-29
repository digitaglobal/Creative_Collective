import { test, expect } from "@playwright/test";

test("find and compare spaces across venues, preserve URL state and recover from empty filters", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Find and compare spaces" }).click();
  await expect(page.getByRole("heading", { name: "Find your space", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Printing", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Meeting room", exact: true })).toBeVisible();
  await page.getByLabel("Purpose", { exact: true }).selectOption("meeting");
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "Compare Meeting room", exact: true }).check();
  await page.getByLabel("Purpose", { exact: true }).selectOption("studio");
  await page.getByRole("checkbox", { name: "Compare Studio rental", exact: true }).check();
  await page.reload();
  await expect(page.getByText("2/3 selected", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Compare selected spaces", exact: true }).click();
  const comparison = page.getByRole("region", { name: "Space comparison", exact: true });
  await expect(comparison.getByRole("columnheader", { name: /Meeting room/ })).toBeVisible();
  await expect(comparison.getByRole("columnheader", { name: /Studio rental/ })).toBeVisible();
  await expect(comparison.getByText("Hourly", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Group size", { exact: true }).selectOption("20");
  await expect(page.getByRole("heading", { name: "No matching spaces" })).toBeVisible();
  await expect(page.getByText("2/3 selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.getByRole("checkbox", { name: "Compare Assigned desk", exact: true }).check();
  await expect(
    page.getByRole("checkbox", { name: "Compare Hot desk — The Sandbox", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Remove Assigned desk from comparison", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Compare Hot desk — The Sandbox", exact: true }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Compare selected spaces", exact: true }).click();
  await page.screenshot({ path: ".cache/discovery-comparison-mobile.png" });
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    wide: [...document.querySelectorAll("body *")]
      .filter(
        (e) =>
          e.getBoundingClientRect().right > innerWidth &&
          !e.closest('[aria-label="Comparison table"]'),
      )
      .slice(0, 12)
      .map((e) => ({ tag: e.tagName, cls: e.className, right: e.getBoundingClientRect().right })),
  }));
  expect(layout.scroll, JSON.stringify(layout)).toBeLessThanOrEqual(layout.width);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: ".cache/discovery-comparison-desktop.png" });
  await comparison
    .getByRole("link", { name: "View details / enquire about Meeting room", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Meeting room", exact: true })).toBeVisible();
});
