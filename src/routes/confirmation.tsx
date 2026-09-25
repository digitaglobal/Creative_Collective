import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { SiteLayout } from "@/components/site-chrome";
import { BookingStepper, BookingSummary } from "@/components/booking-pieces";
import { BookingStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { getService } from "@/data/demo";
import { addMinutesToTime, formatDateLong } from "@/lib/format";

export const Route = createFileRoute("/confirmation")({
  validateSearch: z.object({
    service: z.string().catch(""),
    date: z.string().catch(""),
    start: z.string().catch(""),
    duration: z.coerce.number().catch(60),
    attendees: z.coerce.number().catch(1),
    mode: z.enum(["online", "in-person"]).catch("online"),
  }),
  head: () => ({
    meta: [
      { title: "Booking received — Enigma + Studio D" },
      { name: "description", content: "Your booking summary." },
      { property: "og:title", content: "Booking received — Enigma + Studio D" },
      { property: "og:description", content: "Your booking summary." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Confirmation,
});

function Confirmation() {
  const s = Route.useSearch();
  const service = getService(s.service);
  return (
    <SiteLayout>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <BookingStepper current={3} />
        <h1 className="mt-4 text-3xl font-semibold">
          {s.mode === "online" ? "Demo booking shown" : "Demo request shown"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          This is a preview of the confirmation screen. Nothing was reserved, charged or emailed.
        </p>
        <div className="mt-4">
          <BookingStatusBadge state={s.mode === "online" ? "confirmed" : "pending_confirmation"} />
        </div>
        {service && s.date && s.start ? (
          <div className="mt-6">
            <BookingSummary service={service} dateLabel={formatDateLong(s.date)} start={s.start} end={addMinutesToTime(s.start, s.duration)} durationMinutes={s.duration} attendees={s.attendees}>
              <p className="text-sm text-muted-foreground">Reference: DEMO-0000 (placeholder)</p>
            </BookingSummary>
          </div>
        ) : null}
        <div className="mt-6 flex gap-3">
          <Button asChild><Link to="/account/bookings">My bookings</Link></Button>
          <Button asChild variant="outline"><Link to="/">Back to spaces</Link></Button>
        </div>
      </div>
    </SiteLayout>
  );
}
