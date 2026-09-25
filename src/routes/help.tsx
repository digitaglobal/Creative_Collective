import { createFileRoute } from "@tanstack/react-router";
import { PageHeading, SiteLayout } from "@/components/site-chrome";
import { bookingRules, operatingHours, VENUE_TIMEZONE_LABEL } from "@/data/demo";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help — Enigma + Studio D" },
      { name: "description", content: "How booking works, opening hours and what to expect." },
      { property: "og:title", content: "Help — Enigma + Studio D" },
      { property: "og:description", content: "How booking works, opening hours and what to expect." },
    ],
  }),
  component: Help,
});

const faqs = [
  { q: "How far ahead can I book?", a: `At least ${bookingRules.advanceNoticeHours} hours ahead and up to ${bookingRules.horizonDays} days out.` },
  { q: "What time zone are times in?", a: `All times are in ${VENUE_TIMEZONE_LABEL}.` },
  { q: "When are you open?", a: `Weekdays ${operatingHours.weekdayOpen}–${operatingHours.weekdayClose}, Saturday ${operatingHours.saturdayOpen}–${operatingHours.saturdayClose}, closed Sunday. (Proposed hours.)` },
  { q: "Can I pay in person?", a: "You can request it. Staff must approve it, and unapproved requests expire." },
];

function Help() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <PageHeading title="Help" description="Answers here are proposals awaiting approval by the business." />
        <dl className="mt-8 space-y-4">
          {faqs.map((f) => (
            <div key={f.q} className="surface-panel p-5">
              <dt className="font-semibold">{f.q}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </SiteLayout>
  );
}
