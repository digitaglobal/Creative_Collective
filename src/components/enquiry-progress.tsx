import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/supabase";
import { quoteStatus } from "@/lib/quote-status";
import { statusLabel } from "@/lib/staff-workflow";
import { formatMoney } from "@/lib/format";
import type { Quote } from "@/components/quote-review";
import type { Booking } from "@/lib/booking";

export function EnquiryProgress({
  enquiryId,
  state,
  createdAt,
}: {
  enquiryId: string;
  state: string;
  createdAt: string;
}) {
  const auth = useAuth();
  const query = useQuery({
    queryKey: ["enquiry-progress", auth.user?.id],
    enabled: !!auth.user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const results = await Promise.all([
        db().from("quotes").select("*").eq("customer_id", auth.user!.id),
        db().from("quote_revisions").select("*").eq("customer_id", auth.user!.id),
        db().from("bookings").select("*").eq("customer_id", auth.user!.id),
      ]);
      for (const result of results) if (result.error) throw result.error;
      return {
        quotes: results[0]!.data as Quote[],
        revisions: results[1]!.data!,
        bookings: results[2]!.data as Booking[],
      };
    },
  });
  if (query.isPending) return <p className="text-sm">Loading enquiry history...</p>;
  if (query.error)
    return (
      <div role="status" className="rounded-xl border p-3 text-sm">
        Enquiry history is temporarily unavailable.{" "}
        <button className="min-h-11 underline" onClick={() => void query.refetch()}>
          Retry history
        </button>
      </div>
    );
  const quotes = query.data.quotes
    .filter((q) => q.enquiry_id === enquiryId)
    .sort((a, b) => b.version - a.version);
  const latest = quotes[0];
  const booking = query.data.bookings.find((b) => b.id === latest?.booking_id);
  const revision = query.data.revisions.find((r) => r.quote_id === latest?.id);
  const offered =
    latest && latest.state === "offered" && !revision && Date.parse(latest.expires_at) > Date.now();
  const next = booking
    ? `Reservation ${booking.reference}: ${statusLabel(booking.booking_state)}. Check My bookings for its latest details.`
    : latest?.state === "accepted"
      ? "Your quote was accepted. Check My bookings for the reservation status."
      : offered
        ? "Your quote is ready. Review the details and choose whether to accept or request changes."
        : revision
          ? "Your revision request is with staff. Check back for a revised quote."
          : state === "closed"
            ? "This enquiry is closed. Any existing quote or booking keeps its own status."
            : latest
              ? "There is no current quote to accept. Staff will need to prepare a new offer."
              : "Waiting for staff to review your requirements and prepare the next step.";
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
        <h3 className="font-semibold">Your next step</h3>
        <p className="mt-2 text-sm leading-relaxed">{next}</p>
        {offered && (
          <a
            className="mt-3 flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
            href={`#quote-${latest.id}`}
          >
            Review quote v{latest.version}
          </a>
        )}
        {booking && (
          <a className="mt-3 inline-flex min-h-11 items-center underline" href="#my-reservations">
            View your bookings
          </a>
        )}
      </div>
      <ol
        aria-label="Enquiry progress"
        className="space-y-3 border-l-2 border-primary/25 pl-4 text-sm"
      >
        <li>
          <p className="font-medium">Enquiry received</p>
          <p className="text-muted-foreground">
            {new Date(createdAt).toLocaleDateString("en-GB", {
              timeZone: "America/Jamaica",
              dateStyle: "medium",
            })}
          </p>
        </li>
        <li>
          <p className="font-medium">Staff review</p>
          <p className="text-muted-foreground">
            {state === "closed"
              ? "Enquiry closed"
              : state === "new" && !latest
                ? "Waiting for review"
                : revision
                  ? "Reviewing your requested changes"
                  : state === "reviewing"
                    ? "Under review"
                    : latest
                      ? "Quote prepared"
                      : "Waiting for an update"}
          </p>
        </li>
        <li>
          <p className="font-medium">Quote and reservation</p>
          <p className="text-muted-foreground">
            {booking
              ? `${booking.reference} - ${statusLabel(booking.booking_state)}`
              : latest
                ? `Latest quote: v${latest.version} - ${quoteStatus(latest, !!revision, Date.now())}`
                : "No quote yet. An enquiry does not reserve a space."}
          </p>
        </li>
      </ol>
      {!!quotes.length && (
        <details className="rounded-xl border p-3">
          <summary className="min-h-8 cursor-pointer font-medium">
            Quote and revision history ({quotes.length})
          </summary>
          <div className="mt-3 space-y-3">
            {quotes.map((quote) => {
              const changes = query.data.revisions.filter((r) => r.quote_id === quote.id);
              return (
                <div key={quote.id} className="space-y-2 rounded-lg bg-muted/40 p-3 text-sm">
                  <p className="font-medium">
                    Quote v{quote.version} - {quoteStatus(quote, !!changes.length, Date.now())}
                  </p>
                  <p>{formatMoney(quote.total_minor)}</p>
                  <a
                    className="inline-flex min-h-11 items-center underline"
                    href={`#quote-${quote.id}`}
                  >
                    View quote v{quote.version} details
                  </a>
                  {changes.map((change) => (
                    <div key={change.quote_id} className="border-t pt-2">
                      <p className="font-medium">Your revision request</p>
                      <p className="mt-1 whitespace-pre-wrap break-words">{change.message}</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
