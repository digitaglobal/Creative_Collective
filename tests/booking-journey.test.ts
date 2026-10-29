import { describe, expect, it } from "vitest";
import { bookingReturnTo } from "../src/lib/booking-journey";

describe("booking sign-in destinations", () => {
  it("preserves checkout selections", () => {
    const target =
      "/checkout?service=svc-enigma-meeting&date=2026-12-01&start=10%3A00&duration=120&attendees=3&extras=screen";
    expect(bookingReturnTo(target)).toBe(target);
  });
  it.each([
    "https://evil.example/checkout",
    "//evil.example/checkout",
    "/\\evil.example/checkout",
    "/admin",
    "javascript:alert(1)",
    undefined,
  ])("rejects unsafe or unrelated destination %s", (target) => {
    expect(bookingReturnTo(target)).toBe("/account/bookings");
  });
});
