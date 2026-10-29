import { test, expect, type Page } from "@playwright/test";

test("guest sees price, signs in without losing selections, and can edit on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/enigma/services/meeting-room");
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 49);
  while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1);
  const day = date.toISOString().slice(0, 10);
  await page.getByLabel("Booking date").fill(day);
  await page.getByLabel("Duration", { exact: true }).selectOption("120");
  await page.getByLabel("Booking attendees", { exact: true }).fill("3");
  await page.getByRole("button", { name: "11:00", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Total (JMD)")).toBeVisible();
  await expect(page.getByText(/This is a request, not a confirmed booking/)).toBeVisible();
  const target = new URL(page.url()).pathname + new URL(page.url()).search;
  await page.locator("main").getByRole("link", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("customer@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("testpassword");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/checkout\\?"));
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(target);
  await page.getByRole("link", { name: "Edit space and time selections" }).click();
  await expect(page.getByLabel("Booking date")).toHaveValue(day);
  await expect(page.getByLabel("Duration", { exact: true })).toHaveValue("120");
  await expect(page.getByLabel("Booking attendees", { exact: true })).toHaveValue("3");
  await expect(page.getByRole("button", { name: "11:00", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".cache/booking-conversion-mobile.png", fullPage: true });
});

test("closed date offers checked alternatives and preserves duration", async ({ page }) => {
  await page.goto("/enigma/services/meeting-room");
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 56);
  while (date.getUTCDay() !== 0) date.setUTCDate(date.getUTCDate() + 1);
  await page.getByLabel("Duration", { exact: true }).selectOption("120");
  await page.getByLabel("Booking date").fill(date.toISOString().slice(0, 10));
  const alternatives = page.getByRole("region", { name: "Alternative times" });
  await expect(alternatives.getByRole("button").first()).toBeVisible();
  await alternatives.getByRole("button").first().click();
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Duration", { exact: true })).toHaveValue("120");
});

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
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(
    page.getByText("Your request is with the team. Wait for approval before making travel plans.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({ path: ".cache/my-bookings-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: ".cache/my-bookings-desktop.png", fullPage: true });
  const staff = await browser.newPage();
  await signIn(staff, "staff@example.invalid");
  await staff.goto("/admin");
  await staff.getByText("Booking insights", { exact: true }).click();
  await expect(
    staff
      .getByRole("region", { name: "Booking conversion" })
      .getByRole("cell", { name: "desktop", exact: true }),
  ).toBeVisible();
  await staff.getByTestId("booking-card").filter({ hasText: reference }).click();
  await staff.getByRole("button", { name: "Approve booking", exact: true }).click();
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await staff.getByTestId("booking-card").filter({ hasText: reference }).click();
  await staff.getByText("Manual payment or refund", { exact: true }).first().click();
  await staff.getByLabel("Amount (JMD)", { exact: true }).fill("5750");
  await staff.getByLabel("Method", { exact: true }).fill("cash");
  await staff.getByLabel("Receipt/reference", { exact: true }).fill("receipt-e2e");
  await staff.getByRole("button", { name: "Record transaction" }).click();
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await staff.getByTestId("booking-card").filter({ hasText: reference }).click();
  await staff.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await staff.getByTestId("booking-card").filter({ hasText: reference }).click();
  await staff.getByRole("button", { name: "Complete booking", exact: true }).click();
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "past", exact: true }).click();
  await expect(page.getByText("Payment: paid", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Booking updates" })).toContainText("Completed");
  await staff.getByTestId("booking-card").filter({ hasText: reference }).click();
  await staff.getByText("Notes, payments and audit history", { exact: true }).click();
  await expect(staff.getByText(/Completed \/ Test Staff/)).toBeVisible();
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

test("website venue photographs load on home, galleries and matching services", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const covers = page.locator('img[src^="/images/venues/"]');
  await expect(covers).toHaveCount(2);
  await expect
    .poll(() =>
      covers.evaluateAll((images) =>
        images.every(
          (image) =>
            (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);
  await page.screenshot({ path: ".cache/venue-home-desktop.png" });
  await page.goto("/enigma/services/hot-desk");
  const hotDesk = page.getByRole("img", {
    name: "Shared desks and yellow chairs in Enigma’s Sandbox",
    exact: true,
  });
  await expect(hotDesk).toBeVisible();
  await expect
    .poll(() => hotDesk.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await page.goto("/studio-d");
  await expect(
    page.getByRole("region", { name: "Studio D photo gallery" }).locator("img"),
  ).toHaveCount(7);
  await page.goto("/studio-d/services/studio-lounge");
  await expect(
    page.getByText("Lounge rendering from Studio D’s website.", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/enigma");
  await expect(page.getByRole("region", { name: "Enigma photo gallery" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Hot desk — The Sandbox", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('img[src="/images/venues/enigma-hot-desk.jpg"]')
        .first()
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: ".cache/venue-gallery-mobile.png" });
});

test("staff filters reservations, keeps notes private, records partial payments and refunds, and rejects requests", async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page, "customer@example.invalid");
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 35);
  while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1);
  const day = date.toISOString().slice(0, 10);
  async function request(hour: string) {
    await page.goto("/enigma/services/meeting-room");
    await page.getByLabel("Booking date").fill(day);
    await page.getByRole("button", { name: hour, exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("checkbox", { name: "I accept the policies shown above." }).check();
    await page.getByRole("button", { name: "Request reservation", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Reservation received" })).toBeVisible();
    return (await page.getByText(/^Reference: CC-/).textContent())!.replace("Reference: ", "");
  }
  const reference = await request("12:00");
  const rejected = await request("14:00");
  const staff = await browser.newPage();
  staff.on("pageerror", (error) => errors.push(error.message));
  await signIn(staff, "staff@example.invalid");
  await staff.goto("/admin");
  const cards = staff.getByTestId("booking-card");
  await staff.getByLabel("Search", { exact: true }).fill(reference);
  await staff.getByLabel("Date", { exact: true }).fill(day);
  await staff.getByLabel("Brand", { exact: true }).selectOption("enigma");
  await staff.getByLabel("Status", { exact: true }).selectOption("pending_confirmation");
  await staff.getByLabel("Payment", { exact: true }).selectOption("unpaid");
  await staff.getByLabel("Resource", { exact: true }).selectOption("res-enigma-meeting");
  await expect(cards).toHaveCount(1);
  await staff.getByLabel("Brand", { exact: true }).selectOption("studio-d");
  await expect(cards).toHaveCount(0);
  await staff.getByLabel("Brand", { exact: true }).selectOption("enigma");
  await staff.getByRole("button", { name: "Calendar", exact: true }).click();
  await expect(cards).toHaveCount(1);
  await staff.getByRole("button", { name: "List", exact: true }).click();
  await staff.getByLabel("Status", { exact: true }).selectOption("");
  await staff.getByLabel("Payment", { exact: true }).selectOption("");
  await staff.getByLabel("Resource", { exact: true }).selectOption("");
  async function open() {
    await cards.filter({ hasText: reference }).click();
  }
  await open();
  await staff.getByLabel("Internal note").fill("Private payment follow-up test");
  await staff.getByRole("button", { name: "Add note", exact: true }).dblclick();
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await staff.getByText("Notes, payments and audit history", { exact: true }).click();
  await expect(staff.getByText(/Private payment follow-up test/)).toHaveCount(1);
  await staff.getByRole("button", { name: "Approve booking", exact: true }).click();
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await open();
  await expect(staff.getByRole("button", { name: "Mark no-show", exact: true })).toBeDisabled();
  async function transaction(amount: string, kind: string, receipt: string) {
    if (!(await staff.getByLabel("Kind", { exact: true }).isVisible()))
      await staff.getByText("Manual payment or refund", { exact: true }).first().click();
    await staff.getByLabel("Kind", { exact: true }).selectOption(kind);
    await staff.getByLabel("Amount (JMD)", { exact: true }).fill(amount);
    await staff.getByLabel("Method", { exact: true }).fill("cash");
    await staff.getByLabel("Receipt/reference", { exact: true }).fill(receipt);
    await staff.getByRole("button", { name: "Record transaction", exact: true }).click();
  }
  await transaction("2000", "payment", "staff-partial");
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await open();
  await expect(
    staff.getByText(/Total .*5,750\.00.*Paid .*2,000\.00.*Balance .*3,750\.00/),
  ).toBeVisible();
  await transaction("3750.01", "payment", "staff-overpayment");
  await expect(staff.getByText("Payment exceeds balance", { exact: true })).toBeVisible();
  await transaction("3750", "payment", "staff-balance");
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await open();
  await staff.getByRole("button", { name: "Cancel booking", exact: true }).click();
  await staff.getByRole("button", { name: "Keep booking", exact: true }).click();
  await expect(staff.getByRole("group", { name: "Confirm booking action" })).toHaveCount(0);
  await staff.getByRole("button", { name: "Cancel booking", exact: true }).click();
  await staff.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await open();
  await expect(
    staff.getByText(/Total .*5,750\.00.*Paid .*5,750\.00.*Balance .*0\.00/),
  ).toBeVisible();
  await transaction("5750.01", "refund", "staff-over-refund");
  await expect(staff.getByText("Refund exceeds recorded payments", { exact: true })).toBeVisible();
  await transaction("5750", "refund", "staff-full-refund");
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await open();
  await staff.getByText("Notes, payments and audit history", { exact: true }).click();
  await expect(staff.getByText(/staff-partial/)).toHaveCount(1);
  await expect(staff.getByText(/staff-full-refund/)).toHaveCount(1);
  await expect(staff.getByText(/staff-overpayment|staff-over-refund/)).toHaveCount(0);
  await staff.getByRole("button", { name: "Close", exact: true }).click();
  await staff.getByLabel("Payment", { exact: true }).selectOption("refunded");
  await expect(cards).toHaveCount(1);
  await staff.getByLabel("Payment", { exact: true }).selectOption("");
  await staff.getByLabel("Search", { exact: true }).fill(rejected);
  await cards.filter({ hasText: rejected }).click();
  await staff.getByRole("button", { name: "Reject request", exact: true }).click();
  await staff.getByRole("button", { name: "Confirm rejection", exact: true }).click();
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await page.goto("/account/bookings");
  await page.getByRole("button", { name: "past", exact: true }).click();
  await expect(page.getByText("Payment: refunded", { exact: true })).toBeVisible();
  await expect(page.getByText(/Private payment follow-up test/)).toHaveCount(0);
  await staff.getByLabel("Date", { exact: true }).fill("");
  await staff.getByLabel("Search", { exact: true }).fill("CC-TEST-NOSHOW");
  await cards.filter({ hasText: "CC-TEST-NOSHOW" }).click();
  await staff.getByRole("button", { name: "Mark no-show", exact: true }).click();
  await staff.getByRole("button", { name: "Confirm no-show", exact: true }).click();
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await staff.getByLabel("Status", { exact: true }).selectOption("no_show");
  await expect(cards).toHaveCount(1);
  await cards.click();
  await staff.getByText("Notes, payments and audit history", { exact: true }).click();
  await expect(staff.getByText(/No-show \/ Test Staff/)).toBeVisible();
  expect(errors).toEqual([]);
  await staff.close();
});

test("administrator edits booking settings with ordinary fields", async ({ page }) => {
  await signIn(page, "staff@example.invalid");
  await page.goto("/admin");
  await page.getByText("Administrator settings", { exact: true }).click();
  await page.getByRole("button", { name: "Booking settings", exact: true }).click();
  await page
    .getByRole("region", { name: "Administrator configuration", exact: true })
    .screenshot({ path: ".cache/admin-configuration-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .getByRole("region", { name: "Administrator configuration", exact: true })
    .screenshot({ path: ".cache/admin-configuration-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
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
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("Test Customer");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("customer@example.invalid");
  await expect(page.getByLabel("Phone", { exact: true })).toHaveValue("8761111111");
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
  await expect(
    page.getByRole("region", { name: "Enquiry receipt" }).getByText(/^Reference: ENQ-/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Track in My enquiries" }).click();
  const enquiries = page.getByRole("region", { name: "My enquiries", exact: true });
  await expect(enquiries.getByText("Studio rental · Received", { exact: true })).toBeVisible();
  await staff.getByLabel("Search enquiries", { exact: true }).fill("customer@example.invalid");
  await form.getByLabel("Enquiry state", { exact: true }).selectOption("reviewing");
  await page.getByRole("button", { name: "Refresh enquiries", exact: true }).click();
  await expect(enquiries.getByText("Studio rental · Under review", { exact: true })).toBeVisible();
  await staff.getByLabel("Filter enquiries", { exact: true }).selectOption("reviewing");
  await form.getByRole("button", { name: "Prepare quote", exact: true }).click();
  await expect(form.getByLabel("start", { exact: true })).toBeFocused();
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
  await expect(quote.getByText("Awaiting your decision", { exact: true })).toBeVisible();
  await expect(quote.getByText("Tax (15%)", { exact: true })).toBeVisible();
  await expect(quote.getByText("JMD 13,800.00", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await quote.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".cache/quote-review-mobile.png" });
  await page.getByText("Request a revision", { exact: true }).click();
  await page
    .getByLabel("Requested changes", { exact: true })
    .fill("Please confirm microphone availability and revise the instructions.");
  await page.getByRole("button", { name: "Send revision request", exact: true }).click();
  await expect(page.getByText("Revision requested", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accept quote and request reservation", exact: true }),
  ).toHaveCount(0);
  await staff.reload();
  await expect(
    form.getByText("Please confirm microphone availability and revise the instructions.", {
      exact: true,
    }),
  ).toBeVisible();
  await form.getByLabel("start", { exact: true }).fill(day + "T15:00");
  await form.getByLabel("end", { exact: true }).fill(day + "T17:00");
  await form
    .getByLabel("expiry", { exact: true })
    .fill(new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 16));
  await form.getByLabel("Charge description").fill("Revised studio rental");
  await form.getByLabel("Amount (JMD)", { exact: true }).fill("12000");
  await form
    .getByLabel("Payment and arrival instructions")
    .fill("Revised arrival instructions e2e");
  await form.getByRole("button", { name: "Offer quote", exact: true }).click();
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await page.reload();
  const revisedQuote = page.locator("form").filter({ hasText: "Revised arrival instructions e2e" });
  await revisedQuote
    .getByRole("checkbox", { name: "I accept the current policies.", exact: true })
    .check();
  await revisedQuote
    .getByRole("button", { name: "Accept quote and request reservation", exact: true })
    .click();
  await expect(
    page.getByText("Quote accepted. Reservation awaits staff approval.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /Studio rental/, level: 2 })).toBeVisible();
  const bookingCard = page.locator("article").filter({ hasText: "Studio rental" });
  await bookingCard.getByLabel("Change type").selectOption("reschedule");
  const movedDay = new Date(date.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  await bookingCard.getByLabel("New start (Jamaica)").fill(movedDay + "T09:00");
  await bookingCard.getByLabel("New end (Jamaica)").fill(movedDay + "T17:00");
  await bookingCard.getByLabel("Reason", { exact: true }).fill("Move studio rental e2e");
  await bookingCard.getByRole("button", { name: "Request change", exact: true }).click();
  await expect(
    bookingCard.getByText("Change request: reschedule · pending", { exact: true }),
  ).toBeVisible();
  await staff.reload();
  const changeForm = staff.locator("form").filter({ hasText: "Move studio rental e2e" });
  await changeForm.getByLabel("Revised rental subtotal", { exact: false }).fill("15000");
  await changeForm.getByRole("button", { name: "Offer revised price", exact: true }).click();
  await expect(
    changeForm.getByRole("button", { name: "Approve reschedule", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await bookingCard.getByRole("button", { name: "Accept revised price", exact: true }).click();
  await expect(
    bookingCard.getByText("Revised price accepted. Awaiting staff approval.", { exact: true }),
  ).toBeVisible();
  await staff.reload();
  await changeForm.getByRole("button", { name: "Approve reschedule", exact: true }).click();
  await expect(staff.getByText("Saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    bookingCard.getByText("Change request: reschedule · approved", { exact: true }),
  ).toBeVisible();
  await staff.close();
});

test("staff daily overview and booking panel are usable on mobile", async ({ page }) => {
  await signIn(page, "staff@example.invalid");
  await page.goto("/admin");
  await expect(page.getByRole("navigation", { name: "Daily overview" })).toBeVisible();
  await page.getByRole("button", { name: /Arriving today/ }).click();
  await expect(page.getByRole("button", { name: /Arriving today/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Show all bookings / clear filters" }).click();
  await page.screenshot({ path: ".cache/staff-dashboard-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Operations", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".cache/staff-dashboard-mobile.png", fullPage: true });
  await page.getByTestId("booking-card").filter({ hasText: "CC-TEST-NOSHOW" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.getByRole("dialog").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({ path: ".cache/staff-booking-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
