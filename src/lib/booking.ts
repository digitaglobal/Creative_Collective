export interface Booking {
  id: string;
  reference: string;
  customer_id: string;
  customer_email: string;
  customer_name: string;
  service_id: string;
  service_name: string;
  brand: string;
  starts_at: string;
  ends_at: string;
  attendees: number;
  total_minor: number;
  paid_minor: number;
  booking_state: string;
  payment_state: string;
  expires_at: string | null;
  price_snapshot: { lines: { label: string; amountMinor: number }[]; currency: string };
  arrival_instructions: string;
  created_at: string;
}
export interface Payment {
  id: string;
  amount_minor: number;
  kind: string;
  method: string;
  reference: string;
  created_at: string;
}
export interface Slot {
  start: string;
  end: string;
  available: boolean;
  reason?: string;
}
export interface Policy {
  id: string;
  title: string;
  body: string;
  version: number;
}
export function venueDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Jamaica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function venueTime(instant: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Jamaica",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(instant));
}
export function bookingCalendarDescription(b: Booking) {
  return `Booking reference: ${b.reference}\nStatus: ${b.booking_state.replaceAll("_", " ")}\nAll booking times are in Jamaica time.\n${b.arrival_instructions || "Arrival instructions and venue address are awaiting confirmation. Check My bookings before travelling."}\nIf your booking changes, update or replace your calendar event.`;
}
export function calendarLink(b: Booking, provider: "google" | "outlook") {
  const title = `${b.service_name} � ${b.reference}`;
  if (provider === "google") {
    const stamp = (s: string) =>
      new Date(s)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    return `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${stamp(b.starts_at)}/${stamp(b.ends_at)}`, details: bookingCalendarDescription(b), ctz: "America/Jamaica" })}`;
  }
  return `https://outlook.live.com/calendar/0/deeplink/compose?${new URLSearchParams({ path: "/calendar/action/compose", rru: "addevent", subject: title, startdt: new Date(b.starts_at).toISOString(), enddt: new Date(b.ends_at).toISOString(), body: bookingCalendarDescription(b) })}`;
}
export function calendarText(b: Booking) {
  const stamp = (s: string) =>
    new Date(s)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const escape = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[,;]/g, "\\$&");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Creative Collective//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${b.id}@creative-collective`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(b.starts_at)}`,
    `DTEND:${stamp(b.ends_at)}`,
    `SUMMARY:${escape(`${b.service_name} � ${b.reference}`)}`,
    `DESCRIPTION:${escape(bookingCalendarDescription(b))}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
export function downloadCalendar(b: Booking) {
  const url = URL.createObjectURL(
    new Blob([calendarText(b)], { type: "text/calendar;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${b.reference}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
