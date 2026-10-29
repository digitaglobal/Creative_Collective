import { test, expect } from "@playwright/test";

test("recovery landing on homepage opens password form after session initialization", async ({
  page,
  request,
}) => {
  const response = await request.post("http://localhost:54330/auth/v1/token", {
    data: { email: "customer@example.invalid", password: "testpassword" },
  });
  const session = await response.json();
  const fragment = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: "3600",
    token_type: "bearer",
    type: "recovery",
  });
  await page.goto("/#" + fragment.toString());
  await expect(page).toHaveURL(/\/login\?recovery=1$/);
  await expect(
    page.getByRole("heading", { name: "Set a new password", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Confirm new password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save new password", exact: true })).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Set a new password", exact: true }),
  ).toBeVisible();
});

test("missing recovery session explains how to get a fresh link", async ({ page }) => {
  await page.goto("/login?recovery=1");
  await expect(page.getByText(/This reset session is missing or expired/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save new password", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Forgot password", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Reset password", exact: true })).toBeVisible();
});
