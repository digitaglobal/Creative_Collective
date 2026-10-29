import type { Booking } from "./booking";
import { venueDate } from "./booking";
export const statusLabel = (value: string) =>
  ({
    pending_confirmation: "Awaiting approval",
    confirmed: "Confirmed",
    checked_in: "Checked in",
    completed: "Completed",
    cancelled: "Cancelled",
    expired: "Expired",
    no_show: "No-show",
    payment_exception: "Payment needs review",
  })[value] ?? value.replaceAll("_", " ");
export type DailyView = "all" | "approval" | "arrivals" | "departures" | "onsite";
export function inDailyView(b: Booking, view: DailyView, today: string) {
  const active = ["confirmed", "checked_in"].includes(b.booking_state);
  if (view === "approval") return b.booking_state === "pending_confirmation";
  if (view === "arrivals") return active && venueDate(new Date(b.starts_at)) === today;
  if (view === "departures") return active && venueDate(new Date(b.ends_at)) === today;
  if (view === "onsite") return b.booking_state === "checked_in";
  return true;
}
export const staffDateTime = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    timeZone: "America/Jamaica",
    dateStyle: "medium",
    timeStyle: "short",
  });
