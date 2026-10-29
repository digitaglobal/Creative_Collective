import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookingStepper, PriceBreakdown } from "@/components/booking-pieces";
import { trackBookingStep } from "@/lib/booking-analytics";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { SiteLayout } from "@/components/site-chrome";
import { AccessGate } from "@/components/access-gate";
import { Button } from "@/components/ui/button";
import { useCatalog } from "@/hooks/use-catalog";
import { rpc } from "@/lib/supabase";
import type { Booking, Policy } from "@/lib/booking";
import { formatDuration, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  validateSearch: z.object({
    service: z.string().catch(""),
    date: z.string().catch(""),
    start: z.string().catch(""),
    duration: z.coerce.number().int().min(1).max(480).catch(60),
    attendees: z.coerce.number().int().min(1).catch(1),
    extras: z.string().catch(""),
  }),
  component: Checkout,
});
function Checkout() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-2xl px-4 pb-32 pt-12 lg:pb-12">
        <Review />
      </div>
    </SiteLayout>
  );
}
function Review() {
  const auth = useAuth();
  const s = Route.useSearch();
  const navigate = useNavigate();
  const catalog = useCatalog();
  const policies = useQuery({
    queryKey: ["policies"],
    queryFn: () => rpc<Policy[]>("public_policies"),
  });
  const service = catalog.data?.services.find((x) => x.id === s.service);
  const [accepted, setAccepted] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (service) trackBookingStep("checkout_started", service.id);
  }, [service]);
  if (catalog.isLoading) return <p role="status">Loading booking…</p>;
  if (catalog.error) return <p role="alert">{catalog.error.message}</p>;
  if (!service || !s.date || !s.start)
    return (
      <p>
        Pick a space and time first.{" "}
        <Link to="/" className="underline">
          Browse spaces
        </Link>
      </p>
    );
  const extras = service.addons.filter(
    (a) => s.extras.split(",").includes(a.id) && a.status === "published",
  );
  const subtotal =
    Math.round(((service.hourlyRateMinor ?? 0) * s.duration) / 60) +
    extras.reduce(
      (sum, a) => sum + Math.round(a.amountMinor * (a.basis === "per-hour" ? s.duration / 60 : 1)),
      0,
    );
  return (
    <div className="surface-panel space-y-5 p-6">
      <BookingStepper current={auth.user ? 2 : 1} />
      <h1 className="text-3xl font-semibold">Review and request a reservation</h1>
      <p>
        {service.name} · {s.date} · {s.start} Jamaica time · {formatDuration(s.duration)} ·{" "}
        {s.attendees} attendees
      </p>
      <Link
        className="inline-block underline"
        to="/$brand/services/$slug"
        params={{ brand: service.brand, slug: service.slug }}
        search={{
          date: s.date,
          start: s.start,
          duration: s.duration,
          attendees: s.attendees,
          extras: s.extras,
        }}
      >
        Edit space and time selections
      </Link>
      <PriceBreakdown
        lines={[
          {
            label: `Space · ${formatDuration(s.duration)}`,
            amountMinor: Math.round(((service.hourlyRateMinor ?? 0) * s.duration) / 60),
          },
          ...extras.map((a) => ({
            label: a.name,
            amountMinor: Math.round(a.amountMinor * (a.basis === "per-hour" ? s.duration / 60 : 1)),
          })),
          {
            label: "Tax",
            amountMinor:
              catalog.data?.taxBasisPoints == null
                ? null
                : Math.round((subtotal * catalog.data.taxBasisPoints) / 10000),
          },
        ]}
        totalMinor={
          catalog.data?.taxBasisPoints == null
            ? null
            : subtotal + Math.round((subtotal * catalog.data.taxBasisPoints) / 10000)
        }
        note="Your price and availability are checked again when you request this time."
      />
      <p>
        This is a request, not a confirmed booking. Pay in person after staff approval. Your request
        expires at the earlier of 24 hours after submission or session start. No online payment will
        be collected.
      </p>
      <AccessGate>
        {extras.map((a) => (
          <p key={a.id}>{a.name}</p>
        ))}
        {service.acknowledgement && (
          <label className="flex gap-2">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            {service.acknowledgement}
          </label>
        )}
        <div>
          {policies.data?.map((p) => (
            <details key={p.id} className="border-b py-2">
              <summary>
                {p.title} (v{p.version})
              </summary>
              <p className="whitespace-pre-wrap py-2">{p.body}</p>
            </details>
          ))}
        </div>
        {policies.error && <p role="alert">{policies.error.message}</p>}
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          I accept the policies shown above.
        </label>
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background p-4 shadow-lg lg:static lg:p-0 lg:pt-3 lg:shadow-none">
          <p className="mb-2 text-sm font-medium">
            {catalog.data?.taxBasisPoints == null
              ? "Total awaits tax confirmation"
              : `Total: ${formatMoney(subtotal + Math.round((subtotal * catalog.data.taxBasisPoints) / 10000))}`}
          </p>
          <Button
            className="w-full"
            disabled={
              busy ||
              !accepted ||
              !catalog.data?.ready ||
              policies.data?.length !== 7 ||
              Boolean(service.acknowledgement && !ack)
            }
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const b = await rpc<Booking>("submit_booking", {
                  p_service: s.service,
                  p_start: `${s.date}T${s.start}:00-05:00`,
                  p_duration: s.duration,
                  p_attendees: s.attendees,
                  p_key: key,
                  p_policy_versions: Object.fromEntries(
                    (policies.data ?? []).map((p) => [p.id, p.version]),
                  ),
                  p_extra_ids: extras.map((a) => a.id),
                  p_service_ack: ack,
                });
                trackBookingStep("request_submitted", service.id, b.id);
                await navigate({ to: "/confirmation", search: { reference: b.reference } });
              } catch (err) {
                setError(err instanceof Error ? err.message : "Unable to reserve");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Submitting…" : "Request reservation"}
          </Button>
        </div>
        {!catalog.data?.ready && (
          <p role="status">Live booking awaits approved business configuration.</p>
        )}
        {error && <p role="alert">{error}</p>}
        {error && (
          <p className="text-sm">
            Your selections are still here. If this time is no longer available, use “Edit space and
            time selections” to choose another.
          </p>
        )}
      </AccessGate>
    </div>
  );
}
