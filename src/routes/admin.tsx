import { createFileRoute } from "@tanstack/react-router";
import { PageHeading, SiteLayout } from "@/components/site-chrome";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/status-badges";
import { demoBookings, getService, integrationStatus, todayISO } from "@/data/demo";
import { formatDateLong, formatDateShort, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Operations — Enigma + Studio D staff" },
      { name: "description", content: "Staff view of today's bookings and items needing attention." },
      { property: "og:title", content: "Operations — Enigma + Studio D staff" },
      { property: "og:description", content: "Staff view of today's bookings and items needing attention." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const today = demoBookings.filter((b) => b.date === todayISO).sort((a, b) => a.start.localeCompare(b.start));
  const attention = demoBookings.filter((b) => b.bookingState === "pending_confirmation" || b.bookingState === "payment_exception");
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-12">
        <PageHeading eyebrow="Staff" title="Operations" description={formatDateLong(todayISO)} />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
          <section>
            <h2 className="text-lg font-semibold">Today</h2>
            <div className="surface-panel mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="p-3">Time</th><th className="p-3">Space</th><th className="p-3">Customer</th><th className="p-3">Status</th><th className="p-3 text-right">Total</th></tr>
                </thead>
                <tbody>
                  {today.map((b) => (
                    <tr key={b.reference} className="border-t border-border">
                      <td className="p-3 tabular-nums">{b.start}–{b.end}</td>
                      <td className="p-3">{getService(b.serviceId)?.name}<span className="block text-xs text-muted-foreground">{b.reference}</span></td>
                      <td className="p-3">{b.customerName}</td>
                      <td className="p-3"><div className="flex flex-wrap gap-1"><BookingStatusBadge state={b.bookingState} /><PaymentStatusBadge state={b.paymentState} /></div></td>
                      <td className="p-3 text-right tabular-nums">{formatMoney(b.totalMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <aside className="space-y-6">
            <section>
              <h2 className="text-lg font-semibold">Needs attention</h2>
              <ul className="mt-3 space-y-3">
                {attention.map((b) => (
                  <li key={b.reference} className="surface-panel p-4 text-sm">
                    <div className="flex items-center justify-between gap-2"><span className="font-medium">{b.reference}</span><BookingStatusBadge state={b.bookingState} /></div>
                    <p className="mt-1 text-muted-foreground">{getService(b.serviceId)?.name} · {formatDateShort(b.date)}</p>
                    {b.note ? <p className="mt-2">{b.note}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="text-lg font-semibold">Connections</h2>
              <ul className="surface-panel mt-3 divide-y divide-border text-sm">
                {integrationStatus.map((i) => (
                  <li key={i.name} className="p-3"><p className="font-medium">{i.name}</p><p className="text-muted-foreground">Not set up — {i.detail}</p></li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}
