import { QuoteReviews } from "@/components/quote-review";
import { MyEnquiries } from "@/components/my-enquiries";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
      <h1 className="text-3xl font-semibold">My bookings</h1>
      <nav aria-label="Account sections" className="flex flex-wrap gap-4">
        <a href="#enquiries" className="underline">
          My enquiries
        </a>
        <a href="#rental-quotes" className="underline">
          Rental quotes
        </a>
      </nav>
      <p>{auth.user?.email}</p>
      <form
        key={profile.data?.full_name}
        className="surface-panel space-y-3 p-5"
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
      {message && <p role="status">{message}</p>}
      {profile.error && <p role="alert">{profile.error.message}</p>}
      <div className="flex gap-3">
        {["upcoming", "past"].map((t) => (
          <Button key={t} variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>
            {t}
          </Button>
        ))}
      </div>
      {q.isLoading && <p role="status">Loading bookings…</p>}
      {q.error && <p role="alert">{q.error.message}</p>}
      {q.data
        ?.filter((b) =>
          tab === "upcoming" ? new Date(b.ends_at) >= new Date() : new Date(b.ends_at) < new Date(),
        )
        .map((b) => (
          <BookingCard key={b.id} booking={b} />
        ))}
      {!q.isLoading && !q.data?.length && <p>No reservations yet.</p>}
      <MyEnquiries />
      <QuoteReviews />
    </div>
  );
}

function BookingCard({ booking: b }: { booking: Booking }) {
  const qc = useQueryClient();
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
    queryFn: async () => {
      const { data, error } = await db().from("change_requests").select("*").eq("booking_id", b.id);
      if (error) throw error;
      return data;
    },
  });
  return (
    <article className="surface-panel space-y-3 p-5">
      <h2 className="font-semibold">
        {b.service_name} · {b.reference}
      </h2>
      <p>
        {new Date(b.starts_at).toLocaleDateString("en-GB", { timeZone: "America/Jamaica" })} ·{" "}
        {venueTime(b.starts_at)}–{venueTime(b.ends_at)} Jamaica time
      </p>
      <p>
        {b.booking_state.replaceAll("_", " ")} · {b.payment_state}
      </p>
      {b.price_snapshot.lines.map((l, i) => (
        <p key={i} className="text-sm">
          {l.label}: {formatMoney(l.amountMinor)}
        </p>
      ))}
      <p>
        Total {formatMoney(b.total_minor)} · Paid {formatMoney(b.paid_minor)} · Balance{" "}
        {formatMoney(b.total_minor - b.paid_minor)}
      </p>
      <p className="whitespace-pre-wrap">{b.arrival_instructions}</p>
      <div className="flex gap-2">
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
        <div key={c.id} className="space-y-2">
          <p>
            Change request: {c.kind} · {c.state}
          </p>
          {c.proposed_start && (
            <p>
              {c.proposed_start} to {c.proposed_end} (dates include timezone)
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
        !changes.data?.some((c) => c.state === "pending") && (
          <form
            className="space-y-3 border-t pt-3"
            onSubmit={async (e) => {
              e.preventDefault();
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
