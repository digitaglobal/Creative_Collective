import { test, expect } from "@playwright/test";

test("guest enquiry carries selections, retains details on failure and shows a reference", async ({
  page,
}) => {
  const day = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `/enigma/services/meeting-room?date=${day}&attendees=3&duration=120&start=10%3A00`,
  );
  await expect(page.getByLabel("First date", { exact: true })).toHaveValue(day);
  await expect(page.getByLabel("Last date", { exact: true })).toHaveValue(day);
  await expect(page.getByLabel("Attendees", { exact: true })).toHaveValue("3");
  await page.getByLabel("Full name", { exact: true }).fill("Guest Enquiry Test");
  await page.getByLabel("Email", { exact: true }).fill("guest-enquiry@example.invalid");
  await page.getByLabel("Phone", { exact: true }).fill("8761111111");
  await page.getByLabel("Rental period", { exact: true }).selectOption("weekly");
  await page.getByLabel("Equipment needs and other details").fill("Guest test requirements");
  await page.route(
    "**/rest/v1/rpc/submit_enquiry",
    (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ message: "Temporary test outage" }),
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Send enquiry", exact: true }).click();
  await expect(page.getByText("Temporary test outage", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("Guest Enquiry Test");
  await expect(page.getByLabel("Rental period", { exact: true })).toHaveValue("weekly");
  await page.getByRole("button", { name: "Send enquiry", exact: true }).click();
  const receipt = page.getByRole("region", { name: "Enquiry receipt" });
  await expect(receipt.getByText(/^Reference: ENQ-/)).toBeVisible();
  await expect(receipt.getByText(/Guest enquiries do not appear automatically/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".cache/enquiry-receipt-mobile.png" });
});
