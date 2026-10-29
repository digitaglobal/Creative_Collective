import { useCatalog } from "@/hooks/use-catalog";
import { statusLabel, staffDateTime } from "@/lib/staff-workflow";
import { QuoteReviews } from "@/components/quote-review";
import { MyEnquiries } from "@/components/my-enquiries";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site-chrome";
import { AccessGate } from "@/components/access-gate";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { db, rpc } from "@/lib/supabase";
import { downloadCalendar, venueTime, type Booking, type Payment } from "@/lib/booking";
import { formatMoney } from "@/lib/format";
export const Route = createFileRoute("/account/bookings")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: Account,
});
function Account() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-4xl px-4 py-12">
        <AccessGate>
          <Bookings />
        </AccessGate>
      </div>
    </SiteLayout>
  );
}
function Bookings() {
  const auth = useAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("upcoming");
  const q = useQuery({
    queryKey: ["my-bookings", auth.user?.id],
    enabled: !!auth.user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await db()
        .from("bookings")
        .select("*")
        .eq("customer_id", auth.user!.id)
        .order("starts_at");
      if (error) throw error;
      return data as Booking[];
    },
  });
  const [updates, setUpdates] = useState<string[]>([]);
  useEffect(() => {
    if (!q.data || !auth.user) return;
    const key = `booking-status:${auth.user.id}`;
    try {
      const previous = JSON.parse(localStorage.getItem(key) || "{}") as Record<string, string>;
      setUpdates((old) => [
        ...new Set([
          ...old,
          ...q
            .data!.filter((b) => previous[b.id] && previous[b.id] !== b.booking_state)
            .map((b) => `${b.reference}: ${statusLabel(b.booking_state)}`),
        ]),
      ]);
      localStorage.setItem(
        key,
        JSON.stringify(Object.fromEntries(q.data.map((b) => [b.id, b.booking_state]))),
      );
    } catch {
      /* Updates remain optional when browser storage is unavailable. */
    }
  }, [q.data, auth.user]);
  const visible = (q.data ?? []).filter((b) =>
    tab === "upcoming"
      ? !["cancelled", "expired", "completed", "no_show"].includes(b.booking_state) &&
        new Date(b.ends_at) >= new Date()
      : ["cancelled", "expired", "completed", "no_show"].includes(b.booking_state) ||
        new Date(b.ends_at) < new Date(),
  );
  if (tab === "past") visible.sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const profile = useQuery({
    queryKey: ["profile", auth.user?.id],
    enabled: !!auth.user,
    queryFn: async () => {
      const { data, error } = await db()
        .from("profiles")
        .select("full_name,phone")
        .eq("id", auth.user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">YOUR WORKSPACE & STUDIO PLANS</p>
          <h1 className="mt-2 text-3xl font-semibold">My bookings</h1>
          <p className="mt-2 text-muted-foreground">
            Your reservations, enquiries and quotes in one place.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={q.isFetching}
          onClick={() => void qc.invalidateQueries()}
        >
          Refresh updates
        </Button>
      </header>
      {updates.length > 0 && (
        <section
          aria-label="Booking updates"
          className="rounded-2xl border border-primary/30 bg-primary/5 p-5"
        >
          <h2 className="font-semibold">Since your last visit</h2>
          {updates.map((text) => (
            <p key={text} className="mt-2 text-sm">
              {text}
            </p>
          ))}
          <Button variant="ghost" onClick={() => setUpdates([])}>
            Dismiss updates
          </Button>
        </section>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [
            "Upcoming reservations",
            (q.data ?? []).filter(
              (b) =>
                !["cancelled", "expired", "completed", "no_show"].includes(b.booking_state) &&
                new Date(b.ends_at) >= new Date(),
            ).length,
          ],
          [
            "Awaiting approval",
            (q.data ?? []).filter((b) => b.booking_state === "pending_confirmation").length,
          ],
          [
            "Confirmed plans",
            (q.data ?? []).filter(
              (b) =>
                ["confirmed", "checked_in"].includes(b.booking_state) &&
                new Date(b.ends_at) >= new Date(),
            ).length,
          ],
        ].map(([label, count]) => (
          <div key={label} className="surface-panel rounded-2xl p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{q.isLoading ? "—" : count}</p>
          </div>
        ))}
      </div>
      <nav aria-label="Account sections" className="flex flex-wrap gap-4">
        <a href="#enquiries" className="underline">
          My enquiries
        </a>
        <a href="#rental-quotes" className="underline">
          Rental quotes
        </a>
      </nav>
      <p>{auth.user?.email}</p>
      <details className="surface-panel rounded-2xl p-5">
        <summary className="cursor-pointer font-medium">Your profile</summary>
        <form
          key={profile.data?.full_name}
          className="grid gap-4 pt-5 [&_label]:grid [&_label]:gap-2 [&_input]:ml-0 [&_input]:min-w-0 [&_input]:w-full"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              const { error } = await db()
                .from("profiles")
                .update({ full_name: f.get("name"), phone: f.get("phone") })
                .eq("id", auth.user!.id);
              if (error) throw error;
              setMessage("Profile saved.");
              await qc.invalidateQueries({ queryKey: ["profile"] });
            } catch (err) {
              setMessage(err instanceof Error ? err.message : "Unable to save");
            }
          }}
        >
          <h2 className="font-semibold">Your profile</h2>
          <label className="block">
            Full name
            <input
              name="name"
              required
              maxLength={200}
              defaultValue={profile.data?.full_name}
              className="ml-2 rounded border bg-background p-2"
            />
          </label>
          <label className="block">
            Phone
            <input
              name="phone"
              type="tel"
              required
              maxLength={50}
              defaultValue={profile.data?.phone}
              className="ml-2 rounded border bg-background p-2"
            />
          </label>
          <Button>Save profile</Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              await db().auth.signOut();
              window.location.assign("/login");
            }}
          >
            Sign out
          </Button>
        </form>
      </details>
      {message && <p role="status">{message}</p>}
      {profile.error && <p role="alert">{profile.error.message}</p>}
      <div className="flex gap-3">
        {["upcoming", "past"].map((t) => (
          <Button
            aria-pressed={tab === t}
            key={t}
            variant={tab === t ? "default" : "outline"}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>
      {q.isLoading && <p role="status">Loading bookings…</p>}
      {q.error && (
        <p role="alert">
          Could not load your reservations. Check your connection and use Refresh updates to try
          again.
        </p>
      )}
      {visible.map((b) => (
        <BookingCard key={b.id} booking={b} />
      ))}
      {!q.isLoading && !q.error && !visible.length && (
        <div className="surface-panel rounded-2xl p-8 text-center">
          <h2 className="text-lg font-semibold">
            {tab === "upcoming" ? "No upcoming reservations" : "No past reservations"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {tab === "upcoming"
              ? "Find a workspace or studio for your next plan. Enquiries and quotes are shown below."
              : "Completed, cancelled and expired reservations will appear here."}
          </p>
          <a
            href="/spaces"
            className="mt-4 inline-block rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground"
          >
            Find a space
          </a>
        </div>
      )}
      <MyEnquiries />
      <QuoteReviews />
    </div>
  );
}

function BookingCard({ booking: b }: { booking: Booking }) {
  const qc = useQueryClient();
  const catalog = useCatalog();
  const service = catalog.data?.services.find((s) => s.id === b.service_id);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState("cancel");
  const [busy, setBusy] = useState(false);
  const payments = useQuery({
    queryKey: ["payments", b.id],
    queryFn: async () => {
      const { data, error } = await db()
        .from("payments")
        .select("*")
        .eq("booking_id", b.id)
        .order("created_at");
      if (error) throw error;
      return data as Payment[];
    },
  });
  const changes = useQuery({
    queryKey: ["changes", b.id],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await db().from("change_requests").select("*").eq("booking_id", b.id);
      if (error) throw error;
      return data;
    },
  });
  return (
    <article className="surface-panel min-w-0 space-y-5 rounded-2xl p-5 sm:p-6">
      <h2 className="font-semibold">
        {b.service_name} · {b.reference}
      </h2>
      <div className="rounded-xl bg-muted p-4">
        <p className="font-semibold">{statusLabel(b.booking_state)}</p>
        <p className="mt-1 text-sm">
          {
            {
              pending_confirmation:
                "Your request is with the team. Wait for approval before making travel plans.",
              confirmed: "You are confirmed. Check your arrival details below.",
              checked_in: "You are checked in. Enjoy your session.",
              completed: "Your session is complete. Ready to plan your next visit?",
              cancelled: "This reservation has been cancelled.",
              expired: "This request expired. Choose a new time to try again.",
              no_show: "This reservation was marked as a no-show.",
              payment_exception: "Staff are reviewing the payment status.",
            }[b.booking_state]
          }
        </p>
      </div>
      <p className="text-sm font-medium">
        {b.brand === "studio-d" ? "Studio D" : "Enigma"} · {b.attendees}{" "}
        {b.attendees === 1 ? "attendee" : "attendees"}
      </p>
      <p>
        {new Date(b.starts_at).toLocaleDateString("en-GB", { timeZone: "America/Jamaica" })} ·{" "}
        {venueTime(b.starts_at)} – {staffDateTime(b.ends_at)} Jamaica time
      </p>
      <p>Payment: {b.payment_state}</p>
      {b.price_snapshot.lines.map((l, i) => (
        <p key={i} className="text-sm">
          {l.label}: {formatMoney(l.amountMinor)}
        </p>
      ))}
      <p>
        Total {formatMoney(b.total_minor)} · Paid {formatMoney(b.paid_minor)} · Balance{" "}
        {formatMoney(b.total_minor - b.paid_minor)}
      </p>
      {b.arrival_instructions && (
        <section className="rounded-xl border p-4">
          <h3 className="font-semibold">Arrival details</h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{b.arrival_instructions}</p>
        </section>
      )}
      {service && (
        <a
          className="inline-block font-medium underline underline-offset-4"
          href={`/${service.brand}/services/${service.slug}`}
        >
          Book this space again
        </a>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => downloadCalendar(b)}>
          Add to calendar
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          Print summary
        </Button>
      </div>
      <details>
        <summary>Payment history</summary>
        {payments.error && <p role="alert">{payments.error.message}</p>}
        {payments.data?.map((p) => (
          <p key={p.id}>
            {p.kind}: {formatMoney(p.amount_minor)} · {p.method} · {p.reference} · {p.created_at}
          </p>
        ))}
      </details>
      {changes.data?.map((c) => (
        <div key={c.id} className="space-y-2 rounded-xl border bg-muted/40 p-4">
          <p>
            Change request: {c.kind} · {c.state}
          </p>
          {c.proposed_start && (
            <p>
              {staffDateTime(c.proposed_start)} to {staffDateTime(c.proposed_end)} (Jamaica time)
            </p>
          )}
          {c.state === "pending" && c.revised_total_minor != null && (
            <>
              <p>
                Revised rental total including tax: {formatMoney(c.revised_total_minor)}.
                Difference: {formatMoney(c.revised_total_minor - b.total_minor)}.
              </p>
              {c.price_accepted_at ? (
                <p>
                  Price accepted. Awaiting staff approval; your original reservation remains active.
                </p>
              ) : (
                <Button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await rpc("accept_rental_change", {
                        p_id: c.id,
                        p_expected_total: c.revised_total_minor,
                      });
                      await qc.invalidateQueries({ queryKey: ["changes", b.id] });
                      setMessage("Revised price accepted. Awaiting staff approval.");
                    } catch (err) {
                      setMessage(
                        err instanceof Error ? err.message : "Unable to accept revised price",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Accept revised price
                </Button>
              )}
            </>
          )}
        </div>
      ))}
      {changes.error && <p role="alert">{changes.error.message}</p>}
      {["confirmed", "pending_confirmation"].includes(b.booking_state) &&
        changes.isSuccess &&
        !changes.data?.some((c) => c.state === "pending") && (
          <form
            className="grid gap-4 border-t pt-5 [&_label]:grid [&_label]:min-w-0 [&_label]:gap-2 [&_input]:ml-0 [&_input]:w-full [&_input]:min-w-0 [&_select]:ml-0 [&_select]:w-full"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const f = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await rpc("request_change", {
                  p_id: b.id,
                  p_kind: kind,
                  p_start: kind === "reschedule" ? String(f.get("start")) + ":00-05:00" : null,
                  p_end: kind === "reschedule" ? String(f.get("end")) + ":00-05:00" : null,
                  p_reason: f.get("reason"),
                });
                setMessage(
                  "Request sent. Your original reservation stays active until staff approve the change.",
                );
                await qc.invalidateQueries({ queryKey: ["changes", b.id] });
              } catch (err) {
                setMessage(err instanceof Error ? err.message : "Unable to request change");
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3 className="font-semibold">Change or cancel this reservation</h3>
            <p className="text-sm text-muted-foreground">
              Send a request for staff to review. Your current dates stay in place until it is
              approved.
            </p>
            <label>
              Change type
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="ml-2 rounded border bg-background p-2"
              >
                <option value="cancel">Cancellation</option>
                <option value="reschedule">Reschedule</option>
              </select>
            </label>
            {kind === "reschedule" && (
              <>
                {(b.price_snapshot.lines.some((l) => l.label === "Long rental") ||
                  "quoteId" in b.price_snapshot) && (
                  <p>
                    Staff will offer a revised total for you to accept before approving the move.
                    Your original reservation stays active.
                  </p>
                )}
                <label className="block">
                  New start (Jamaica)
                  <input
                    name="start"
                    type="datetime-local"
                    required
                    className="ml-2 rounded border bg-background p-2"
                  />
                </label>
                <label className="block">
                  New end (Jamaica)
                  <input
                    name="end"
                    type="datetime-local"
                    required
                    className="ml-2 rounded border bg-background p-2"
                  />
                </label>
              </>
            )}
            <label className="block">
              Reason
              <textarea
                name="reason"
                required
                minLength={3}
                maxLength={2000}
                className="mt-1 w-full rounded border bg-background p-2"
              />
            </label>
            <Button disabled={busy}>Request change</Button>
          </form>
        )}
      {message && <p role="status">{message}</p>}
    </article>
  );
}
