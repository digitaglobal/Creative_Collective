import { createFileRoute } from "@tanstack/react-router";
import { PageHeading, SiteLayout } from "@/components/site-chrome";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/status-badges";
import { demoBookings, demoCustomer, getService } from "@/data/demo";
import { formatDateLong, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/account/bookings")({
  head: () => ({
    meta: [
      { title: "My bookings — Enigma + Studio D" },
      { name: "description", content: "Your upcoming and past bookings." },
      { property: "og:title", content: "My bookings — Enigma + Studio D" },
      { property: "og:description", content: "Your upcoming and past bookings." },
    ],
  }),
  component: MyBookings,
});

function MyBookings() {
  const mine = demoBookings.filter((b) => demoCustomer.references.includes(b.reference));
  return (
    <SiteLayout>
      <div className="mx-auto max-w-4xl px-4 py-12">
        <PageHeading title="My bookings" description={`Signed in as ${demoCustomer.name} (demo account).`} />
        <ul className="mt-8 space-y-4">
          {mine.map((b) => {
            const svc = getService(b.serviceId);
            return (
              <li key={b.reference} className="surface-panel flex flex-wrap items-start justify-between gap-4 p-5">
                <div>
                  <p className="font-semibold">{svc?.name}</p>
                  <p className="text-sm text-muted-foreground">{formatDateLong(b.date)} · {b.start}–{b.end}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Ref {b.reference}</p>
                  {b.note ? <p className="mt-2 text-sm">{b.note}</p> : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-2"><BookingStatusBadge state={b.bookingState} /><PaymentStatusBadge state={b.paymentState} /></div>
                  <p className="text-sm tabular-nums">{formatMoney(b.totalMinor)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </SiteLayout>
  );
}
