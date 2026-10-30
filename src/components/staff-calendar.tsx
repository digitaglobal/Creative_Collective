import { useState } from "react";
import { Button } from "@/components/ui/button";
import { venueTime, type Booking } from "@/lib/booking";
import { statusLabel } from "@/lib/staff-workflow";

const shift = (day: string, amount: number) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};
const label = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Jamaica",
  });
const overlaps = (start: string, end: string, day: string) =>
  new Date(start).getTime() < new Date(`${shift(day, 1)}T00:00:00-05:00`).getTime() &&
  new Date(end).getTime() > new Date(`${day}T00:00:00-05:00`).getTime();

export function StaffCalendar({
  bookings,
  closures,
  resources,
  date,
  onDate,
  onSelect,
}: {
  bookings: Booking[];
  closures: {
    id: string;
    resource_id: string | null;
    starts_at: string;
    ends_at: string;
    reason: string;
  }[];
  resources: { id: string; name: string }[];
  date: string;
  onDate: (date: string) => void;
  onSelect: (booking: Booking) => void;
}) {
  const [mode, setMode] = useState("week");
  const [history, setHistory] = useState(false);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const first = mode === "day" ? date : shift(date, -(weekday === 0 ? 6 : weekday - 1));
  const days = Array.from({ length: mode === "day" ? 1 : 7 }, (_, index) => shift(first, index));
  return (
    <section
      aria-label="Staff booking calendar"
      className="min-w-0 space-y-4 rounded-2xl border bg-muted/20 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{mode === "week" ? "Week ahead" : "Day agenda"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {label(first)}
            {mode === "week" ? ` - ${label(days[6]!)}` : ""} · Jamaica time
          </p>
        </div>
        <div className="flex gap-2">
          {["day", "week"].map((value) => (
            <Button
              key={value}
              variant={mode === value ? "default" : "outline"}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {value === "day" ? "Day" : "Week"}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" onClick={() => onDate(shift(date, mode === "day" ? -1 : -7))}>
          Previous
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            onDate(
              new Intl.DateTimeFormat("en-CA", {
                timeZone: "America/Jamaica",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date()),
            )
          }
        >
          Today
        </Button>
        <Button variant="outline" onClick={() => onDate(shift(date, mode === "day" ? 1 : 7))}>
          Next
        </Button>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={history}
          onChange={(event) => setHistory(event.target.checked)}
        />
        Show cancelled, expired and no-show bookings
      </label>
      <p className="text-sm text-muted-foreground">
        Uses the filters above. Requests awaiting approval are labelled. Empty days do not guarantee
        availability.
      </p>
      <div
        className={
          mode === "week" ? "grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3" : "grid gap-3"
        }
      >
        {days.map((day) => {
          const items = bookings.filter(
            (b) =>
              overlaps(b.starts_at, b.ends_at, day) &&
              (history || !["cancelled", "expired", "no_show"].includes(b.booking_state)),
          );
          const blocked = closures.filter((c) => overlaps(c.starts_at, c.ends_at, day));
          return (
            <section
              key={day}
              aria-label={label(day)}
              className="min-w-0 space-y-3 rounded-xl border bg-background p-3"
            >
              <h4 className="flex items-center justify-between gap-2 font-semibold">
                {label(day)}
                <span className="text-xs font-normal text-muted-foreground">
                  {items.length} bookings
                </span>
              </h4>
              {blocked.map((c) => (
                <div
                  key={c.id}
                  className="break-words rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                >
                  <p className="font-medium">
                    Blocked time ·{" "}
                    {c.resource_id
                      ? (resources.find((r) => r.id === c.resource_id)?.name ?? "Resource")
                      : "All spaces"}
                  </p>
                  <p>
                    {new Date(c.starts_at) < new Date(`${day}T00:00:00-05:00`)
                      ? "Continues"
                      : venueTime(c.starts_at)}{" "}
                    -{" "}
                    {new Date(c.ends_at) >= new Date(`${shift(day, 1)}T00:00:00-05:00`)
                      ? "End of day"
                      : venueTime(c.ends_at)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{c.reason}</p>
                </div>
              ))}
              {items.map((b) => (
                <button
                  key={b.id}
                  data-testid="booking-card"
                  onClick={() => onSelect(b)}
                  className="block w-full space-y-1 break-words rounded-xl border p-3 text-left hover:border-primary"
                >
                  <span className="block text-sm font-semibold">
                    {venueTime(b.starts_at)} - {venueTime(b.ends_at)}
                    {b.starts_at.slice(0, 10) !== b.ends_at.slice(0, 10)
                      ? " · Multi-day booking"
                      : ""}
                  </span>
                  <span className="block font-medium">{b.service_name}</span>
                  <span className="block text-sm">{b.customer_name}</span>
                  <span
                    className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${b.booking_state === "pending_confirmation" ? "bg-amber-500/15" : "bg-muted"}`}
                  >
                    {statusLabel(b.booking_state)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {b.reference} · Tap for details
                  </span>
                </button>
              ))}
              {!items.length && !blocked.length && (
                <p className="py-3 text-sm text-muted-foreground">
                  No bookings or blocked time in this view.
                </p>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}
