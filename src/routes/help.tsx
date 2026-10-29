import { useCatalog } from "@/hooks/use-catalog";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeading, SiteLayout } from "@/components/site-chrome";
import { VENUE_TIMEZONE_LABEL } from "@/data/catalog";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help — Enigma + Studio D" },
      { name: "description", content: "How booking works, opening hours and what to expect." },
      { property: "og:title", content: "Help — Enigma + Studio D" },
      {
        property: "og:description",
        content: "How booking works, opening hours and what to expect.",
      },
    ],
  }),
  component: Help,
});

function Help() {
  const catalog = useCatalog();
  const rules = catalog.data?.rules;
  const hours = catalog.data?.hours;
  const faqs = [
    {
      q: "How far ahead can I book?",
      a: rules
        ? `At least ${rules.advanceNoticeHours} hours ahead and up to ${rules.horizonDays} days out.`
        : "Booking rules await venue setup.",
    },
    { q: "What time zone are times in?", a: `All times are in ${VENUE_TIMEZONE_LABEL}.` },
    {
      q: "When is Studio D open?",
      a: hours
        ? `Weekdays ${hours.weekdayOpen.slice(0, 5)}–${hours.weekdayClose.slice(0, 5)}, Saturday ${hours.saturdayOpen.slice(0, 5)}–${hours.saturdayClose.slice(0, 5)}.${hours.sundayClosed ? " Closed Sunday." : " Sunday follows weekday hours."}`
        : "Opening hours await venue setup.",
    },
    {
      q: "Can I pay in person?",
      a: "Yes. Request a reservation and wait for staff approval. Unapproved requests expire at the earlier of 24 hours after submission or session start.",
    },
    {
      q: "Can I cancel or reschedule?",
      a: "Request a change from My bookings. Staff approval is required. A cancellation does not automatically refund a recorded payment.",
    },
    {
      q: "How do longer rentals work?",
      a: "Send an enquiry for daily, weekly or monthly rentals. Staff provide a quote. Quotes do not reserve space; accepting one requests a reservation.",
    },
  ];
  return (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <PageHeading
          title="Help"
          description={
            catalog.data?.ready
              ? "How reservations work."
              : "Live reservations await venue setup and approval."
          }
        />
        <dl className="mt-8 space-y-4">
          <div className="surface-panel p-5">
            <dt className="font-semibold">When is Enigma open?</dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              Monday–Thursday 08:00–17:00; Friday 08:00–16:00, Jamaica time. Weekend opening hours
              await confirmation.
            </dd>
          </div>
          {faqs.map((f) => (
            <div key={f.q} className="surface-panel p-5">
              <dt className="font-semibold">{f.q}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
        {catalog.data?.brands
          .filter((b) => b.contactEmail || b.contactPhone)
          .map((b) => (
            <section key={b.slug} className="surface-panel mt-4 p-5">
              <h2 className="font-semibold">Contact {b.name}</h2>
              {b.contactEmail && (
                <p>
                  <a className="underline" href={`mailto:${b.contactEmail}`}>
                    {b.contactEmail}
                  </a>
                </p>
              )}
              {b.contactPhone && (
                <p>
                  <a className="underline" href={`tel:${b.contactPhone}`}>
                    {b.contactPhone}
                  </a>
                </p>
              )}
            </section>
          ))}
      </div>
    </SiteLayout>
  );
}
