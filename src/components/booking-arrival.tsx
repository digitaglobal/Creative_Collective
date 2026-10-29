import { CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calendarLink, downloadCalendar, type Booking } from "@/lib/booking";

export function BookingArrival({ booking: b }: { booking: Booking }) {
  const active = ["confirmed", "checked_in"].includes(b.booking_state);
  const upcoming = new Date(b.ends_at).getTime() > Date.now();
  return (
    <section
      aria-label="Plan your visit"
      className="space-y-5 rounded-2xl border bg-muted/30 p-4 sm:p-5"
    >
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <MapPin size={18} aria-hidden="true" />
          Plan your visit
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {b.brand === "studio-d" ? "Studio D" : "Enigma"} · Keep your booking reference handy:{" "}
          <span className="break-all font-medium text-foreground">{b.reference}</span>
        </p>
      </div>
      <div className="space-y-2 text-sm">
        <h4 className="font-medium">Arrival guide</h4>
        {active ? (
          <p className="whitespace-pre-wrap break-words">
            {b.arrival_instructions ||
              "Your venue address and arrival instructions are awaiting confirmation. Check this booking again before travelling."}
          </p>
        ) : (
          <p>
            Check your booking status before travelling. Arrival instructions apply once your
            reservation is confirmed.
          </p>
        )}
        <p className="text-muted-foreground">
          Opening hours: Monday–Thursday, 8am–5pm. Friday, 8am–4pm. Closed on weekends. All times
          are in Jamaica time.
        </p>
      </div>
      {active && upcoming && (
        <div className="space-y-3 border-t pt-4">
          <h4 className="flex items-center gap-2 font-medium">
            <CalendarDays size={18} aria-hidden="true" />
            Add to your calendar
          </h4>
          <div className="grid gap-2 sm:grid-cols-3">
            <a
              className="flex min-h-11 items-center justify-center rounded-lg border bg-background px-3 py-3 text-center text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              href={calendarLink(b, "google")}
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Calendar<span className="sr-only"> (opens in a new tab)</span>
            </a>
            <a
              className="flex min-h-11 items-center justify-center rounded-lg border bg-background px-3 py-3 text-center text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              href={calendarLink(b, "outlook")}
              target="_blank"
              rel="noopener noreferrer"
            >
              Outlook<span className="sr-only"> (opens in a new tab)</span>
            </a>
            <Button
              className="min-h-11 whitespace-normal"
              variant="outline"
              onClick={() => downloadCalendar(b)}
            >
              Apple / Download .ics
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Calendar copies do not update automatically. If you reschedule or cancel, update your
            calendar too. My bookings always shows the latest status.
          </p>
        </div>
      )}
    </section>
  );
}
