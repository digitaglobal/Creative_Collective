import { expect, it } from "vitest";
import { quoteStatus } from "../src/lib/quote-status";
it.each([
  ["offered", false, "2026-12-01T16:00:00Z", "Awaiting your decision"],
  ["offered", false, "2026-12-01T15:00:00Z", "Expired"],
  ["accepted", false, "2026-12-01T14:00:00Z", "Accepted"],
  ["superseded", false, "2026-12-01T14:00:00Z", "Replaced by a newer quote"],
  ["superseded", true, "2026-12-01T14:00:00Z", "Revision requested"],
] as const)("quote status %s revision=%s", (state, revision, expires_at, expected) => {
  expect(quoteStatus({ state, expires_at }, revision, Date.parse("2026-12-01T15:00:00Z"))).toBe(
    expected,
  );
});
