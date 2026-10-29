import { describe, expect, it } from "vitest";
import { inDailyView } from "../src/lib/staff-workflow";
import type { Booking } from "../src/lib/booking";
const booking = (changes: Partial<Booking> = {}) =>
  ({
    booking_state: "confirmed",
    starts_at: "2026-10-30T04:00:00Z",
    ends_at: "2026-10-30T06:00:00Z",
    ...changes,
  }) as Booking;
describe("staff daily views", () => {
  it("uses Jamaica calendar dates across UTC midnight", () => {
    expect(inDailyView(booking(), "arrivals", "2026-10-29")).toBe(true);
    expect(inDailyView(booking(), "departures", "2026-10-30")).toBe(true);
    expect(inDailyView(booking(), "arrivals", "2026-10-30")).toBe(false);
  });
  it("includes multi-day departures even when arrival was earlier", () => {
    expect(
      inDailyView(booking({ starts_at: "2026-10-20T14:00:00Z" }), "departures", "2026-10-30"),
    ).toBe(true);
  });
  it("excludes cancelled, expired and completed sessions from daily work", () => {
    for (const booking_state of [
      "cancelled",
      "expired",
      "completed",
      "no_show",
      "pending_confirmation",
    ])
      expect(inDailyView(booking({ booking_state }), "arrivals", "2026-10-29")).toBe(false);
  });
  it("keeps pending approvals and checked-in sessions visible regardless of date", () => {
    expect(
      inDailyView(booking({ booking_state: "pending_confirmation" }), "approval", "2026-11-01"),
    ).toBe(true);
    expect(inDailyView(booking({ booking_state: "checked_in" }), "onsite", "2026-11-01")).toBe(
      true,
    );
  });
});
