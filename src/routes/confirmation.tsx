import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site-chrome";
import { AccessGate } from "@/components/access-gate";
import { db } from "@/lib/supabase";
import { venueTime, type Booking } from "@/lib/booking";
import { formatMoney } from "@/lib/format";
import { BookingStepper } from "@/components/booking-pieces";
export const Route = createFileRoute("/confirmation")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  validateSearch: z.object({ reference: z.string().catch("") }),
  component: Confirmation,
});
function Confirmation() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <AccessGate>
          <Saved />
        </AccessGate>
      </div>
    </SiteLayout>
  );
}
function Saved() {
  const { reference } = Route.useSearch();
  const q = useQuery({
    queryKey: ["booking", reference],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await db()
        .from("bookings")
        .select("*")
        .eq("reference", reference)
        .single();
      if (error) throw error;
      return data as Booking;
    },
  });
  if (q.isLoading) return <p role="status">Loading reservation…</p>;
  if (q.error) return <p role="alert">Reservation unavailable: {q.error.message}</p>;
  const b = q.data!;
  return (
    <div className="surface-panel space-y-4 p-6">
      <BookingStepper current={3} />
      <h1 className="text-3xl font-semibold">Reservation received</h1>
      {b.booking_state === "pending_confirmation" && (
        <p className="font-medium">
          Request received — awaiting staff approval. Your booking is not confirmed yet.
        </p>
      )}
      <p>Reference: {b.reference}</p>
      <p>
        {b.service_name} · {b.starts_at.slice(0, 10)} · {venueTime(b.starts_at)}–
        {venueTime(b.ends_at)} Jamaica time
      </p>
      <p>Status: {b.booking_state.replaceAll("_", " ")}</p>
      <p>Total: {formatMoney(b.total_minor)}. Pay in person after staff approval.</p>
      {b.expires_at && b.booking_state === "pending_confirmation" && (
        <p>
          Approval deadline:{" "}
          {new Date(b.expires_at).toLocaleString("en-GB", { timeZone: "America/Jamaica" })} Jamaica
          time.
        </p>
      )}
      <p>
        Check My bookings for the latest status, arrival details and payment balance. Booking emails
        are not active yet; keep your reference and check back here.
      </p>
      {b.booking_state === "pending_confirmation" && (
        <p>
          If staff do not approve before the deadline, the request expires and the time is released.
        </p>
      )}
      <Link
        to="/account/bookings"
        className="inline-flex rounded bg-primary px-4 py-3 text-primary-foreground"
      >
        Check status / manage my bookings
      </Link>
    </div>
  );
}
