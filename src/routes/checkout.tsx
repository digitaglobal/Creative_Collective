import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { SiteLayout } from "@/components/site-chrome";
import { BookingStepper, BookingSummary, PriceBreakdown } from "@/components/booking-pieces";
import { Button } from "@/components/ui/button";
import { bookingRules, getService } from "@/data/demo";
import { addMinutesToTime, formatDateLong, formatDuration, formatMoney } from "@/lib/format";

const searchSchema = z.object({
  service: z.string().catch(""),
  date: z.string().catch(""),
  start: z.string().catch(""),
  duration: z.coerce.number().catch(60),
  attendees: z.coerce.number().catch(1),
});

export const Route = createFileRoute("/checkout")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Review your booking — Enigma + Studio D" },
      { name: "description", content: "Check the details and reserve your space." },
      { property: "og:title", content: "Review your booking — Enigma + Studio D" },
      { property: "og:description", content: "Check the details and reserve your space." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const s = Route.useSearch();
  const navigate = useNavigate();
  const service = getService(s.service);
  const [ack, setAck] = useState(false);
  const [mode, setMode] = useState<"online" | "in-person">("online");

  if (!service || !s.date || !s.start) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold">Nothing to review</h1>
          <p className="mt-2 text-muted-foreground">Pick a space and time first.</p>
          <Button asChild className="mt-6"><Link to="/">Browse spaces</Link></Button>
        </div>
      </SiteLayout>
    );
  }
  if (service.status !== "published" || !service.bookableHourly || service.hourlyRateMinor === null) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold">Online booking unavailable</h1>
          <p className="mt-2 text-muted-foreground">Contact the venue to arrange {service.name.toLowerCase()}.</p>
          <Button asChild className="mt-6"><Link to="/$brand" params={{ brand: service.brand }}>Back to spaces</Link></Button>
        </div>
      </SiteLayout>
    );
  }
  const total = Math.round(((service.hourlyRateMinor ?? 0) * s.duration) / 60);
  const needsAck = Boolean(service.acknowledgement);

  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <BookingStepper current={2} />
        <h1 className="mt-4 text-3xl font-semibold">Review and reserve</h1>
        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="surface-panel p-5">
              <h2 className="font-semibold">Signed in as</h2>
              <p className="mt-1 text-sm text-muted-foreground">Tamara Reid (demo account) · tamara.reid@example.invalid</p>
            </section>
            <fieldset className="surface-panel space-y-3 p-5">
              <legend className="px-1 font-semibold">How would you like to pay?</legend>
              {(["online", "in-person"] as const).map((m) => (
                <label key={m} className="flex gap-3 text-sm">
                  <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
                  <span>
                    {m === "online" ? "Pay online now" : "Request to pay in person"}
                    <span className="block text-muted-foreground">
                      {m === "online"
                        ? `Your time is held for ${bookingRules.holdMinutes} minutes while you pay. No payment provider is connected yet.`
                        : `Needs staff approval. Expires at the ${bookingRules.payInPersonExpiry.toLowerCase()}.`}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            {needsAck ? (
              <label className="surface-panel flex gap-3 p-5 text-sm">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1" />
                <span>{service.acknowledgement}</span>
              </label>
            ) : null}
          </div>
          <BookingSummary service={service} dateLabel={formatDateLong(s.date)} start={s.start} end={addMinutesToTime(s.start, s.duration)} durationMinutes={s.duration} attendees={s.attendees}>
            <PriceBreakdown lines={[{ label: `${formatDuration(s.duration)} × ${formatMoney(service.hourlyRateMinor ?? 0)}/hr`, amountMinor: total }, { label: "Tax", amountMinor: null }]} totalMinor={total} />
            <Button className="w-full" disabled={needsAck && !ack}
              onClick={() => navigate({ to: "/confirmation", search: { ...s, mode } })}>
              {mode === "online" ? "Reserve and pay (demo)" : "Send request (demo)"}
            </Button>
          </BookingSummary>
        </div>
      </div>
    </SiteLayout>
  );
}
