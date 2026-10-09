import { test, expect, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("testpassword");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();
}

test("customer requests a real reservation; staff approve, record payment, check in and complete", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signIn(page, "customer@example.invalid");
  await page.goto("/enigma/services/meeting-room");
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 7);
  while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1);
  await page.getByLabel("Booking date").fill(date.toISOString().slice(0, 10));
  await page.getByRole("button", { name: "10:00", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("checkbox", { name: "I accept the policies shown above." }).check();
  await page.getByRole("button", { name: "Request reservation", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Reservation received" })).toBeVisible();
  const reference = (await page.getByText(/^Reference: CC-/).textContent())!.replace(
    "Reference: ",
    "",
  );
  await page.goto("/account/bookings");
  await expect(page.getByRole("heading", { name: new RegExp(reference) })).toBeVisible();
  const staff = await browser.newPage();
  await signIn(staff, "staff@example.invalid");
  await staff.goto("/admin");
  await staff.locator("button.surface-panel").filter({ hasText: reference }).click();
  await staff.getByRole("button", { name: "confirmed", exact: true }).click();
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await staff.locator("button.surface-panel").filter({ hasText: reference }).click();
  await staff.getByLabel("Amount (JMD)", { exact: true }).fill("5750");
  await staff.getByLabel("Method", { exact: true }).fill("cash");
  await staff.getByLabel("Receipt/reference", { exact: true }).fill("receipt-e2e");
  await staff.getByRole("button", { name: "Record transaction" }).click();
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await staff.locator("button.surface-panel").filter({ hasText: reference }).click();
  await staff.getByRole("button", { name: "checked in", exact: true }).click();
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await staff.locator("button.surface-panel").filter({ hasText: reference }).click();
  await staff.getByRole("button", { name: "completed", exact: true }).click();
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("completed · paid", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  await staff.close();
});

test("mobile catalog has no horizontal overflow and customer cannot open staff operations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Where ideas come to life." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await signIn(page, "customer@example.invalid");
  await page.goto("/admin");
  await expect(page.getByText("Staff access is required.", { exact: true })).toBeVisible();
});

test("administrator edits booking settings with ordinary fields", async ({ page }) => {
  await signIn(page, "staff@example.invalid");
  await page.goto("/admin");
  await page.getByRole("button", { name: "Booking settings", exact: true }).click();
  await page.getByLabel("Advance notice (hours)", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Save configuration", exact: true }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Booking settings", exact: true }).click();
  await expect(page.getByLabel("Advance notice (hours)", { exact: true })).toHaveValue("5");
  await page.getByLabel("Advance notice (hours)", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Save configuration", exact: true }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
});

test("customer enquiry becomes a reviewed quote and a saved reservation", async ({
  page,
  browser,
}) => {
  await signIn(page, "customer@example.invalid");
  await page.goto("/studio-d/services/studio-rental");
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 14);
  while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1);
  const day = date.toISOString().slice(0, 10);
  await page.getByLabel("Full name", { exact: true }).fill("Test Customer");
  await page.getByLabel("Email", { exact: true }).fill("customer@example.invalid");
  await page.getByLabel("Phone", { exact: true }).fill("8761111111");
  await page.getByLabel("First date").fill(day);
  await page.getByLabel("Last date").fill(day);
  await page.getByLabel("Attendees", { exact: true }).fill("2");
  await page.getByLabel("Rental period", { exact: true }).selectOption("daily");
  await page.getByLabel("Equipment needs and other details").fill("Studio enquiry e2e");
  await page.getByRole("button", { name: "Send enquiry", exact: true }).click();
  await expect(
    page.getByText("Enquiry received. Staff will review it; no space has been reserved."),
  ).toBeVisible();
  const staff = await browser.newPage();
  await signIn(staff, "staff@example.invalid");
  await staff.goto("/admin");
  const form = staff.locator("form").filter({ hasText: "Studio enquiry e2e" });
  await form.getByLabel("start", { exact: true }).fill(day + "T15:00");
  await form.getByLabel("end", { exact: true }).fill(day + "T17:00");
  await form
    .getByLabel("expiry", { exact: true })
    .fill(new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 16));
  await form.getByLabel("Charge description").fill("Studio rental");
  await form.getByLabel("Amount (JMD)", { exact: true }).fill("12000");
  await form.getByLabel("Payment and arrival instructions").fill("Pay on arrival e2e");
  await form.getByRole("button", { name: "Offer quote", exact: true }).click();
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await page.goto("/account/bookings");
  const quote = page.locator("form").filter({ hasText: "Pay on arrival e2e" });
  await quote
    .getByRole("checkbox", { name: "I accept the current policies.", exact: true })
    .check();
  await quote
    .getByRole("button", { name: "Accept quote and request reservation", exact: true })
    .click();
  await expect(
    page.getByText("Quote accepted. Reservation awaits staff approval.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /Studio rental/ })).toBeVisible();
  await staff.close();
});
