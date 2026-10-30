import { inDailyView, staffDateTime, statusLabel, type DailyView } from "@/lib/staff-workflow";
import { venueDate } from "@/lib/booking";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { parseMoneyMinor } from "@/lib/money";
import { useCatalog } from "@/hooks/use-catalog";
import type { Policy } from "@/lib/booking";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site-chrome";
import { AccessGate } from "@/components/access-gate";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { db, rpc } from "@/lib/supabase";
import { venueTime, type Booking } from "@/lib/booking";
import { formatMoney } from "@/lib/format";
import { AdminConfiguration } from "@/components/admin-configuration";
import { BookingFunnel } from "@/components/booking-funnel";
import { enquiryStates } from "@/lib/enquiries";
export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: Admin,
});
function Admin() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-12">
        <AccessGate staff>
          <Operations />
        </AccessGate>
      </div>
    </SiteLayout>
  );
}
function Operations() {
  const auth = useAuth();
  const qc = useQueryClient();
  const [dailyView, setDailyView] = useState<DailyView>("all");
  const [today, setToday] = useState(() => venueDate());
  useEffect(() => {
    const timer = setInterval(() => setToday(venueDate()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const saving = useRef(false);
  const [search, setSearch] = useState("");
  const [enquiryFilter, setEnquiryFilter] = useState("");
  const [enquirySearch, setEnquirySearch] = useState("");
  const [followupFilter, setFollowupFilter] = useState("");
  const catalog = useCatalog();
  const [date, setDate] = useState("");
  const [brand, setBrand] = useState("");
  const [state, setState] = useState("");
  const [payment, setPayment] = useState("");
  const [resource, setResource] = useState("");
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const data = useQuery({
    queryKey: ["operations"],
    enabled: auth.staff,
    queryFn: async () => {
      const tables = [
        "bookings",
        "change_requests",
        "enquiries",
        "notification_jobs",
        "allocations",
        "resources",
        "quotes",
        "quote_revisions",
        "enquiry_followups",
      ] as const;
      const results = await Promise.all(tables.map((t) => db().from(t).select("*")));
      results.forEach((r) => {
        if (r.error) throw r.error;
      });
      return {
        bookings: results[0]!.data as Booking[],
        changes: results[1]!.data!,
        enquiries: results[2]!.data!,
        jobs: results[3]!.data!,
        allocations: results[4]!.data!,
        resources: results[5]!.data!,
        quotes: results[6]!.data!,
        revisions: results[7]!.data!,
        followups: results[8]!.data!,
      };
    },
    refetchInterval: 30_000,
  });
  const run = async (name: string, args: Record<string, unknown>) => {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    setMessage("");
    try {
      await rpc(name, args);
      await qc.invalidateQueries();
      if (name !== "add_note") setSelected(null);
      setMessage("Saved.");
      return true;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to save");
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const list = (data.data?.bookings ?? [])
    .filter(
      (b) =>
        inDailyView(b, dailyView, today) &&
        (!search ||
          `${b.reference} ${b.customer_name} ${b.customer_email} ${b.service_name}`
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (!date ||
          new Date(b.starts_at).toLocaleDateString("en-CA", { timeZone: "America/Jamaica" }) ===
            date) &&
        (!brand || b.brand === brand) &&
        (!state || b.booking_state === state) &&
        (!payment || b.payment_state === payment) &&
        (!resource ||
          data.data?.allocations.some((a) => a.booking_id === b.id && a.resource_id === resource)),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            STAFF WORKSPACE - JAMAICA TIME
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Operations</h1>
          <p className="mt-2 text-muted-foreground">
            {today} - Open a booking to take the next step.
          </p>
        </div>
        <Button variant="outline" disabled={data.isFetching} onClick={() => void data.refetch()}>
          Refresh dashboard
        </Button>
      </header>
      <nav aria-label="Daily overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["approval", "Awaiting approval", "Review new requests"],
            ["arrivals", "Arriving today", "Confirmed arrivals"],
            ["departures", "Leaving today", "Sessions ending today"],
            ["onsite", "Checked in", "Currently on site"],
          ] as const
        ).map(([value, label, hint]) => (
          <button
            key={value}
            aria-pressed={dailyView === value}
            onClick={() => {
              setDailyView(value);
              setSearch("");
              setDate("");
              setBrand("");
              setState("");
              setPayment("");
              setResource("");
            }}
            className={`surface-panel rounded-2xl border p-4 text-left transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary ${dailyView === value ? "border-primary bg-primary/5" : ""}`}
          >
            <span className="block text-sm font-medium">{label}</span>
            <span className="my-2 block text-3xl font-semibold">
              {data.data
                ? data.data.bookings.filter((b) => inDailyView(b, value, today)).length
                : " - "}
            </span>
            <span className="text-xs text-muted-foreground">{hint}</span>
          </button>
        ))}
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">
          {dailyView === "all"
            ? "All bookings"
            : {
                approval: "Awaiting approval",
                arrivals: "Arriving today",
                departures: "Leaving today",
                onsite: "Checked in",
              }[dailyView]}
        </h2>
        <Button
          variant="ghost"
          onClick={() => {
            setDailyView("all");
            setSearch("");
            setDate("");
            setBrand("");
            setState("");
            setPayment("");
            setResource("");
          }}
        >
          Show all bookings / clear filters
        </Button>
      </div>
      {message && !selected && <p role="status">{message}</p>}
      {data.error && (
        <p role="alert" className="rounded-xl border border-destructive p-4">
          Could not load the dashboard. Check your connection and use Refresh dashboard to try
          again.
        </p>
      )}
      {data.isLoading && <p role="status">Loading operations…</p>}
      <div className="surface-panel grid gap-4 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-4 [&_label]:grid [&_label]:gap-1 [&_input]:m-0 [&_input]:min-w-0 [&_input]:w-full [&_select]:min-w-0 [&_select]:rounded-md [&_select]:border [&_select]:bg-background [&_select]:p-2">
        <label>
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ml-2 rounded border bg-background p-2"
          />
        </label>
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ml-2 rounded border bg-background p-2"
          />
        </label>
        <label>
          Brand
          <select aria-label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">All</option>
            <option>enigma</option>
            <option>studio-d</option>
          </select>
        </label>
        <label>
          Status
          <select aria-label="Status" value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">All</option>
            {[
              "pending_confirmation",
              "confirmed",
              "checked_in",
              "completed",
              "cancelled",
              "expired",
              "no_show",
              "payment_exception",
            ].map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Payment
          <select aria-label="Payment" value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="">All</option>
            {["unpaid", "paid", "pending", "failed", "refunded"].map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Resource
          <select
            aria-label="Resource"
            value={resource}
            onChange={(e) => setResource(e.target.value)}
          >
            <option value="">All</option>
            {data.data?.resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" onClick={() => setView(view === "list" ? "calendar" : "list")}>
          {view === "list" ? "Calendar" : "List"}
        </Button>
      </div>
      {data.data && list.length === 0 && (
        <div className="surface-panel rounded-2xl p-8 text-center">
          <h3 className="font-semibold">
            {data.data.bookings.length
              ? "No bookings in this view"
              : "Your booking day starts here"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.data.bookings.length
              ? "Try another day or clear the filters to see more bookings."
              : "New reservation requests will appear here when bookings open."}
          </p>
        </div>
      )}
      <div className={view === "calendar" ? "grid gap-3 md:grid-cols-3" : "space-y-3"}>
        {view === "list"
          ? list.map((b) => (
              <button
                key={b.id}
                data-testid="booking-card"
                className="surface-panel block w-full rounded-2xl p-4 text-left transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
                onClick={() => setSelected(b)}
              >
                <p className="font-semibold">
                  {new Date(b.starts_at).toLocaleDateString("en-GB", {
                    timeZone: "America/Jamaica",
                  })}{" "}
                  · {venueTime(b.starts_at)}–{venueTime(b.ends_at)} · {b.service_name}
                </p>
                <p>
                  {b.reference} · {b.customer_name} · {statusLabel(b.booking_state)} ·{" "}
                  {statusLabel(b.payment_state)} · {formatMoney(b.total_minor - b.paid_minor)} due
                </p>
              </button>
            ))
          : [
              ...new Set(
                list.map((b) =>
                  new Date(b.starts_at).toLocaleDateString("en-CA", {
                    timeZone: "America/Jamaica",
                  }),
                ),
              ),
            ].map((day) => (
              <section key={day} className="space-y-3">
                <h2 className="font-semibold">{day}</h2>
                {list
                  .filter(
                    (b) =>
                      new Date(b.starts_at).toLocaleDateString("en-CA", {
                        timeZone: "America/Jamaica",
                      }) === day,
                  )
                  .map((b) => (
                    <button
                      key={b.id}
                      data-testid="booking-card"
                      className="surface-panel block w-full rounded-2xl p-4 text-left transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
                      onClick={() => setSelected(b)}
                    >
                      <p className="font-semibold">
                        {new Date(b.starts_at).toLocaleDateString("en-GB", {
                          timeZone: "America/Jamaica",
                        })}{" "}
                        · {venueTime(b.starts_at)}–{venueTime(b.ends_at)} · {b.service_name}
                      </p>
                      <p>
                        {b.reference} · {b.customer_name} · {statusLabel(b.booking_state)} ·{" "}
                        {statusLabel(b.payment_state)} · {formatMoney(b.total_minor - b.paid_minor)}{" "}
                        due
                      </p>
                    </button>
                  ))}
              </section>
            ))}
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl">
          <DialogTitle>Booking details</DialogTitle>
          <DialogDescription>
            Review the reservation and choose its next step. Times are in Jamaica time.
          </DialogDescription>
          {selected && (
            <StaffBooking
              key={selected.id}
              booking={data.data?.bookings.find((b) => b.id === selected.id) ?? selected}
              run={run}
              busy={busy}
            />
          )}
          {message && selected && <p role="status">{message}</p>}
        </DialogContent>
      </Dialog>
      <section className="surface-panel min-w-0 space-y-4 rounded-2xl p-4 sm:p-6 [&_p]:break-words">
        <h2 className="text-xl font-semibold">Needs attention</h2>
        {data.data &&
          !data.data.bookings.some(
            (b) =>
              ["pending_confirmation", "payment_exception"].includes(b.booking_state) ||
              (b.booking_state === "confirmed" && b.paid_minor < b.total_minor),
          ) &&
          !data.data.changes.some((c) => c.state === "pending") &&
          !data.data.jobs.some((j) => j.state === "failed") && (
            <p className="text-sm text-muted-foreground">
              You are all caught up. No booking actions are waiting.
            </p>
          )}
        {data.data?.bookings
          .filter(
            (b) =>
              ["pending_confirmation", "payment_exception"].includes(b.booking_state) ||
              (b.booking_state === "confirmed" && b.paid_minor < b.total_minor),
          )
          .map((b) => (
            <button key={b.id} className="block underline" onClick={() => setSelected(b)}>
              {b.reference} · {statusLabel(b.booking_state)} ·{" "}
              {formatMoney(b.total_minor - b.paid_minor)} due
            </button>
          ))}
        {data.data?.changes
          .filter((c) => c.state === "pending")
          .map((c) => (
            <form
              key={c.id}
              className="space-y-2 border-t pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run("review_change", {
                  p_id: c.id,
                  p_approve: true,
                  p_expected_total: c.kind === "reschedule" ? Number(f.get("total")) : null,
                });
              }}
            >
              <p>
                {c.kind} request:{" "}
                {data.data?.bookings.find((b) => b.id === c.booking_id)?.reference} · {c.reason}
              </p>
              {c.kind === "reschedule" && (
                <>
                  <p>
                    {c.proposed_start} · {c.proposed_end}
                  </p>
                  <ChangePreview id={c.id} busy={busy} />
                  <p className="text-sm">
                    Hourly bookings use current rates. Quoted rentals need an offer accepted by the
                    customer. Refund any excess paid balance before approval.
                  </p>
                </>
              )}
              <div className="flex gap-2">
                {c.kind === "cancel" && <Button disabled={busy}>Approve cancellation</Button>}
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run("review_change", { p_id: c.id, p_approve: false })}
                >
                  Reject
                </Button>
              </div>
            </form>
          ))}
        {data.data?.jobs
          .filter((j) => j.state === "failed")
          .map((j) => (
            <div key={j.id}>
              <p role="alert">
                Email failed: {j.subject} · {j.last_error}
              </p>
              <Button
                disabled={busy}
                onClick={() => void run("retry_notification", { p_id: j.id })}
              >
                Retry email
              </Button>
            </div>
          ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Enquiries and quotes</h2>
        <div className="grid gap-4 rounded-2xl border bg-muted/30 p-4 sm:grid-cols-3 [&_label]:grid [&_label]:gap-2 [&_input]:ml-0 [&_input]:w-full [&_select]:ml-0 [&_select]:min-h-11">
          <label>
            Filter enquiries
            <select
              aria-label="Filter enquiries"
              value={enquiryFilter}
              onChange={(event) => setEnquiryFilter(event.target.value)}
              className="ml-2 rounded border bg-background p-2"
            >
              <option value="">All statuses</option>
              {Object.entries(enquiryStates).map(([value, state]) => (
                <option key={value} value={value}>
                  {state.label} ({data.data?.enquiries.filter((e) => e.state === value).length ?? 0}
                  )
                </option>
              ))}
            </select>
          </label>
          <label>
            Search enquiries
            <input
              className="ml-2 rounded border bg-background p-2"
              value={enquirySearch}
              onChange={(event) => setEnquirySearch(event.target.value)}
              placeholder="Reference, customer or space"
            />
          </label>
        </div>
        <label className="grid gap-2 text-sm sm:max-w-xs">
          Follow-up queue
          <select
            className="min-h-11 rounded-lg border bg-background p-2"
            value={followupFilter}
            onChange={(event) => setFollowupFilter(event.target.value)}
          >
            <option value="">All enquiries</option>
            <option value="mine">Assigned to me</option>
            <option value="unassigned">Unassigned open enquiries</option>
            <option value="due">Follow-up due</option>
          </select>
        </label>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setEnquiryFilter("");
            setEnquirySearch("");
            setFollowupFilter("");
          }}
        >
          Clear enquiry filters
        </Button>
        <p className="text-sm">
          Newest enquiries first. Preparing a quote does not reserve inventory or send an email.
        </p>
        {data.data &&
          !data.data.enquiries.some(
            (e) =>
              (!followupFilter ||
                (() => {
                  const followup = data.data?.followups.find((f) => f.enquiry_id === e.id);
                  if (followupFilter === "mine") return followup?.owner_id === auth.user?.id;
                  if (e.state === "closed") return false;
                  return followupFilter === "unassigned"
                    ? !followup?.owner_id
                    : !!followup?.follow_up_on && followup.follow_up_on.slice(0, 10) <= today;
                })()) &&
              (!enquiryFilter || e.state === enquiryFilter) &&
              `${e.id} ${e.contact_name} ${e.email} ${e.service_id} ${catalog.data?.services.find((s) => s.id === e.service_id)?.name ?? ""}`
                .toLowerCase()
                .includes(enquirySearch.toLowerCase().replace(/^enq-/, "")),
          ) && <p>No enquiries match these filters.</p>}
        {data.data?.enquiries
          .filter(
            (e) =>
              (!followupFilter ||
                (() => {
                  const followup = data.data?.followups.find((f) => f.enquiry_id === e.id);
                  if (followupFilter === "mine") return followup?.owner_id === auth.user?.id;
                  if (e.state === "closed") return false;
                  return followupFilter === "unassigned"
                    ? !followup?.owner_id
                    : !!followup?.follow_up_on && followup.follow_up_on.slice(0, 10) <= today;
                })()) &&
              (!enquiryFilter || e.state === enquiryFilter) &&
              `${e.id} ${e.contact_name} ${e.email} ${e.service_id} ${catalog.data?.services.find((s) => s.id === e.service_id)?.name ?? ""}`
                .toLowerCase()
                .includes(enquirySearch.toLowerCase().replace(/^enq-/, "")),
          )
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
          .map((e) => (
            <form
              key={e.id}
              className="surface-panel min-w-0 space-y-4 rounded-2xl p-4 sm:p-6 [&_p]:break-words"
              onSubmit={(event) => {
                event.preventDefault();
                const f = new FormData(event.currentTarget);
                try {
                  void run("create_quote", {
                    p_enquiry: e.id,
                    p_start: String(f.get("start")) + ":00-05:00",
                    p_end: String(f.get("end")) + ":00-05:00",
                    p_lines: f.getAll("quote_label").map((label, i) => ({
                      label: String(label),
                      amountMinor: parseMoneyMinor(String(f.getAll("quote_amount")[i])),
                    })),
                    p_expiry: String(f.get("expiry")) + ":00-05:00",
                    p_instructions: f.get("instructions"),
                    p_key: f.get("quote_key"),
                    p_extra_ids: f.getAll("quote_extra"),
                  });
                } catch {
                  setMessage("Enter a valid quote amount with at most two decimal places.");
                }
              }}
            >
              <p className="break-all font-semibold">
                ENQ-{e.id} ·{" "}
                {enquiryStates[e.state as keyof typeof enquiryStates]?.label ?? e.state}
              </p>
              <p>
                {catalog.data?.services.find((service) => service.id === e.service_id)?.name ??
                  e.service_id}
              </p>
              <p>
                {e.contact_name} · {e.email} · {e.phone} · {e.service_id}
              </p>
              <p>
                {e.start_date}–{e.end_date} · {e.rental_period} · {e.attendees} attendees
              </p>
              <p>{e.message}</p>
              <EnquiryFollowup
                key={`${e.id}:${data.data?.followups.find((f) => f.enquiry_id === e.id)?.updated_at ?? "new"}`}
                enquiryId={e.id}
                followup={data.data?.followups.find((f) => f.enquiry_id === e.id)}
                userId={auth.user?.id}
                busy={busy}
                save={run}
                today={today}
              />
              {data.data?.revisions
                .filter((revision) => revision.enquiry_id === e.id)
                .map((revision) => (
                  <div key={revision.quote_id} className="rounded border bg-muted p-3">
                    <p className="font-semibold">
                      Customer revision request · Quote v
                      {data.data?.quotes.find((quote) => quote.id === revision.quote_id)?.version}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{revision.message}</p>
                    <p className="text-xs">
                      {new Date(revision.created_at).toLocaleString("en-GB", {
                        timeZone: "America/Jamaica",
                      })}{" "}
                      Jamaica time. Review against any newer quote before preparing another version.
                    </p>
                  </div>
                ))}
              <label>
                Enquiry state
                <select
                  aria-label="Enquiry state"
                  value={e.state}
                  disabled={busy}
                  onChange={(event) =>
                    void run("update_enquiry", { p_id: e.id, p_state: event.target.value })
                  }
                >
                  {["new", "reviewing", "quoted", "closed"].map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              {!e.customer_id ? (
                <div>
                  <p>Customer needs a verified account matching the enquiry email.</p>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void run("link_enquiry_account", { p_id: e.id })}
                  >
                    Link verified account
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(event) =>
                      event.currentTarget.form
                        ?.querySelector<HTMLInputElement>('input[name="start"]')
                        ?.focus()
                    }
                  >
                    Prepare quote
                  </Button>
                  <p>
                    All quote times are Jamaica time. Creating a new version supersedes earlier
                    unaccepted quotes.
                  </p>
                  {["start", "end", "expiry"].map((n) => (
                    <label key={n} className="block">
                      {n}
                      <input
                        name={n}
                        type="datetime-local"
                        required
                        className="ml-2 rounded border bg-background p-2"
                      />
                    </label>
                  ))}
                  <QuoteLines
                    serviceId={e.service_id}
                    key={`${e.id}:${data.data?.quotes.filter((q) => q.enquiry_id === e.id).length ?? 0}`}
                  />
                  <label className="block">
                    Payment and arrival instructions
                    <textarea
                      name="instructions"
                      required
                      className="mt-1 w-full rounded border bg-background p-2"
                    />
                  </label>
                  <Button disabled={busy}>Offer quote</Button>
                </>
              )}
            </form>
          ))}
      </section>
      <StaffCreate run={run} busy={busy} />
      <details className="surface-panel rounded-2xl p-5">
        <summary className="cursor-pointer font-semibold">Booking insights</summary>
        <div className="pt-4">
          <BookingFunnel />
        </div>
      </details>
      {auth.role === "administrator" && (
        <details className="surface-panel rounded-2xl p-5">
          <summary className="cursor-pointer font-semibold">Administrator settings</summary>
          <div className="pt-4">
            <AdminConfiguration />
          </div>
        </details>
      )}
    </div>
  );
}
function StaffCreate({
  run,
  busy,
}: {
  run: (n: string, a: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
}) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const catalog = useCatalog();
  const profiles = useQuery({
    queryKey: ["staff-customers"],
    queryFn: async () => {
      const { data, error } = await db().from("profiles").select("id,full_name,phone");
      if (error) throw error;
      return data;
    },
  });
  const policies = useQuery({
    queryKey: ["policies"],
    queryFn: () => rpc<Policy[]>("public_policies"),
  });
  const [serviceId, setServiceId] = useState("");
  const service = catalog.data?.services.find((s) => s.id === serviceId);
  return (
    <details className="surface-panel p-5">
      <summary>Create booking for customer</summary>
      <form
        className="space-y-3 pt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const saved = await run("submit_booking", {
            p_customer: f.get("customer"),
            p_service: serviceId,
            p_start: String(f.get("start")) + ":00-05:00",
            p_duration: Number(f.get("duration")),
            p_attendees: Number(f.get("attendees")),
            p_key: key,
            p_policy_versions: Object.fromEntries(
              (policies.data ?? []).map((p) => [p.id, p.version]),
            ),
            p_extra_ids: [],
            p_service_ack: f.get("ack") === "on",
          });
          if (saved) setKey(crypto.randomUUID());
        }}
      >
        <label className="block">
          Customer
          <select name="customer" required className="mt-1 w-full rounded border bg-background p-2">
            <option value="">Choose customer</option>
            {profiles.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} - {p.phone}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Service
          <select
            required
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="mt-1 w-full rounded border bg-background p-2"
          >
            <option value="">Choose service</option>
            {catalog.data?.services
              .filter((s) => s.bookableHourly)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        {[
          ["start", "Start (Jamaica)", "datetime-local"],
          ["duration", "Duration (minutes)", "number"],
          ["attendees", "Attendees", "number"],
        ].map(([n, l, t]) => (
          <label key={n} className="block">
            {l}
            <input
              name={n}
              type={t}
              required
              min={t === "number" ? 1 : undefined}
              className="mt-1 w-full rounded border bg-background p-2"
            />
          </label>
        ))}
        <div>
          {policies.data?.map((p) => (
            <details key={p.id}>
              <summary>{p.title}</summary>
              <p className="whitespace-pre-wrap">{p.body}</p>
            </details>
          ))}
        </div>
        <label className="flex gap-2">
          <input type="checkbox" required />
          The customer accepted these policies.
        </label>
        {service?.acknowledgement && (
          <label className="flex gap-2">
            <input type="checkbox" name="ack" required />
            The customer accepted: {service.acknowledgement}
          </label>
        )}
        {profiles.error && <p role="alert">{profiles.error.message}</p>}
        {policies.error && <p role="alert">{policies.error.message}</p>}
        <Button disabled={busy || policies.data?.length !== 7}>Create request</Button>
      </form>
    </details>
  );
}
function StaffBooking({
  booking: b,
  run,
  busy,
}: {
  booking: Booking;
  run: (n: string, a: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
}) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [transactionError, setTransactionError] = useState("");
  const detail = useQuery({
    queryKey: ["staff-detail", b.id],
    queryFn: async () => {
      const [notes, audit, payments, profile, actors] = await Promise.all([
        db()
          .from("internal_notes")
          .select("*")
          .eq("booking_id", b.id)
          .order("created_at", { ascending: false }),
        db().from("audit_events").select("*").eq("booking_id", b.id).order("created_at"),
        db().from("payments").select("*").eq("booking_id", b.id),
        db().from("profiles").select("phone").eq("id", b.customer_id).single(),
        db().from("profiles").select("id,full_name"),
      ]);
      for (const r of [notes, audit, payments, profile, actors]) if (r.error) throw r.error;
      return {
        actors: actors.data!,
        notes: notes.data!,
        audit: audit.data!,
        payments: payments.data!,
        phone: profile.data?.phone,
      };
    },
  });
  const transitions =
    b.booking_state === "pending_confirmation"
      ? ["confirmed", "cancelled"]
      : b.booking_state === "confirmed"
        ? ["checked_in", "cancelled", "no_show"]
        : b.booking_state === "checked_in"
          ? ["completed", "cancelled"]
          : [];
  return (
    <section className="space-y-5 break-words">
      <h2 className="text-xl font-semibold">{b.reference}</h2>
      <p>
        {b.customer_name} · {b.customer_email} · {detail.data?.phone}
      </p>
      <p>
        {b.service_name} / {staffDateTime(b.starts_at)} - {staffDateTime(b.ends_at)}
      </p>
      <p>
        Total {formatMoney(b.total_minor)} · Paid {formatMoney(b.paid_minor)} · Balance{" "}
        {formatMoney(b.total_minor - b.paid_minor)}
      </p>
      <p className="rounded-xl bg-muted p-3 font-medium">
        {statusLabel(b.booking_state)} - {b.attendees} attendees
      </p>
      <div className="flex flex-wrap gap-2">
        {transitions.map((s) => (
          <Button
            key={s}
            variant={s === "cancelled" || s === "no_show" ? "outline" : "default"}
            disabled={busy || (s === "no_show" && new Date(b.starts_at).getTime() > Date.now())}
            onClick={() => {
              if (s === "cancelled" || s === "no_show") setConfirmAction(s);
              else void run("transition_booking", { p_id: b.id, p_state: s });
            }}
          >
            {
              {
                confirmed: "Approve booking",
                checked_in: "Check in",
                completed: "Complete booking",
                cancelled:
                  b.booking_state === "pending_confirmation" ? "Reject request" : "Cancel booking",
                no_show: "Mark no-show",
              }[s]
            }
          </Button>
        ))}
      </div>
      {confirmAction && (
        <div
          role="group"
          aria-label="Confirm booking action"
          className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
        >
          <p className="font-semibold">
            {confirmAction === "no_show"
              ? "Mark this customer as a no-show?"
              : b.booking_state === "pending_confirmation"
                ? "Reject this reservation request?"
                : "Cancel this booking?"}
          </p>
          <p className="text-sm">
            This releases the reserved space. Any payment already recorded remains unchanged; handle
            refunds separately.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void run("transition_booking", { p_id: b.id, p_state: confirmAction })}
            >
              Confirm{" "}
              {confirmAction === "no_show"
                ? "no-show"
                : b.booking_state === "pending_confirmation"
                  ? "rejection"
                  : "cancellation"}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setConfirmAction(null)}>
              Keep booking
            </Button>
          </div>
        </div>
      )}
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer font-medium">Manual payment or refund</summary>
        <form
          className="space-y-3 pt-4 [&_input]:ml-0 [&_input]:w-full"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setTransactionError("");
            try {
              const saved = await run("record_payment", {
                p_id: b.id,
                p_amount: parseMoneyMinor(String(f.get("amount"))),
                p_kind: f.get("kind"),
                p_method: f.get("method"),
                p_reference: f.get("reference"),
                p_key: key,
              });
              if (saved) setKey(crypto.randomUUID());
            } catch (err) {
              setTransactionError(
                err instanceof Error ? err.message : "Check the transaction amount.",
              );
            }
          }}
        >
          <h3 className="font-semibold">Manual payment or refund</h3>
          <label>
            Kind
            <select name="kind" aria-label="Kind">
              <option value="payment">Payment</option>
              <option value="refund">Refund</option>
            </select>
          </label>
          {[
            ["amount", "Amount (JMD)", "number"],
            ["method", "Method", "text"],
            ["reference", "Receipt/reference", "text"],
          ].map(([n, l, t]) => (
            <label key={n} className="block">
              {l}
              <input
                name={n}
                type={t}
                required
                min={t === "number" ? 0.01 : undefined}
                step={t === "number" ? "0.01" : undefined}
                className="ml-2 rounded border bg-background p-2"
              />
            </label>
          ))}
          <Button disabled={busy}>Record transaction</Button>
          {transactionError && <p role="alert">{transactionError}</p>}
        </form>
      </details>
      <form
        className="space-y-3 rounded-xl border p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run("add_note", { p_id: b.id, p_body: note.trim() })) setNote("");
        }}
      >
        <label>
          Internal note
          <textarea
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
            maxLength={5000}
            className="block w-full rounded border bg-background p-2"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Staff only. These notes are never shown to customers.
        </p>
        <Button disabled={busy || !note.trim()}>Add note</Button>
      </form>
      {detail.isLoading && <p role="status">Loading booking history...</p>}
      {detail.error && (
        <p role="alert">
          Could not load booking history.{" "}
          <button className="underline" onClick={() => void detail.refetch()}>
            Try again
          </button>
        </p>
      )}
      <details>
        <summary className="cursor-pointer font-semibold">
          Notes, payments and audit history
        </summary>
        {detail.data &&
          !detail.data.notes.length &&
          !detail.data.payments.length &&
          !detail.data.audit.length && <p className="py-3 text-sm">No activity recorded yet.</p>}
        {detail.data?.notes.map((n) => (
          <p key={n.id}>
            {n.body} / {staffDateTime(n.created_at)} /{" "}
            {detail.data?.actors.find((a) => a.id === n.actor_id)?.full_name || "Staff member"}
          </p>
        ))}
        {detail.data?.payments.map((p) => (
          <p key={p.id}>
            {p.kind} {formatMoney(p.amount_minor)} · {p.reference}
          </p>
        ))}
        {detail.data?.audit.map((a) => (
          <p key={a.id}>
            {staffDateTime(a.created_at)} / {statusLabel(a.action)} /{" "}
            {a.actor_id
              ? detail.data?.actors.find((p) => p.id === a.actor_id)?.full_name || "Staff member"
              : "System"}
          </p>
        ))}
      </details>
    </section>
  );
}

function ChangePreview({ id, busy }: { id: string; busy: boolean }) {
  const qc = useQueryClient();
  const [subtotal, setSubtotal] = useState("");
  const [offering, setOffering] = useState(false);
  const [offerError, setOfferError] = useState("");
  const q = useQuery({
    queryKey: ["change-preview", id],
    queryFn: () =>
      rpc<{
        totalMinor: number | null;
        differenceMinor: number;
        refundRequiredMinor: number;
        requiresOffer?: boolean;
        accepted?: boolean;
      }>("preview_change", { p_id: id }),
  });
  return (
    <div>
      {q.isLoading && <p>Calculating revised price…</p>}
      {q.error && <p role="alert">{q.error.message}</p>}
      {q.data?.requiresOffer && (
        <div className="space-y-2">
          <label className="block">
            Revised rental subtotal (JMD, before tax, including all extras)
            <input
              type="number"
              min="0"
              step="0.01"
              value={subtotal}
              onChange={(e) => setSubtotal(e.target.value)}
              className="ml-2 rounded border bg-background p-2"
            />
          </label>
          <Button
            type="button"
            disabled={busy || offering || subtotal === ""}
            onClick={async () => {
              setOffering(true);
              setOfferError("");
              try {
                await rpc("offer_rental_change", {
                  p_id: id,
                  p_subtotal: parseMoneyMinor(subtotal),
                });
                await qc.invalidateQueries({ queryKey: ["change-preview", id] });
              } catch (err) {
                setOfferError(err instanceof Error ? err.message : "Unable to offer revised price");
              } finally {
                setOffering(false);
              }
            }}
          >
            Offer revised price
          </Button>
          <p>
            {q.data.accepted
              ? "Customer accepted this price."
              : "Awaiting customer acceptance of the revised price."}
          </p>
          {offerError && <p role="alert">{offerError}</p>}
        </div>
      )}
      <input type="hidden" name="total" value={q.data?.totalMinor ?? ""} />
      <Button
        disabled={
          busy ||
          !q.data ||
          !!q.error ||
          (q.data.requiresOffer && !q.data.accepted) ||
          q.data.totalMinor == null ||
          q.data.refundRequiredMinor > 0
        }
      >
        Approve reschedule
      </Button>
      {q.data && q.data.totalMinor != null && (
        <p>
          New total: {formatMoney(q.data.totalMinor)}. Difference:{" "}
          {formatMoney(q.data.differenceMinor)}. Refund required before approval:{" "}
          {formatMoney(q.data.refundRequiredMinor)}.
        </p>
      )}
    </div>
  );
}

function QuoteLines({ serviceId }: { serviceId: string }) {
  const catalog = useCatalog();
  const addons =
    catalog.data?.services
      .find((s) => s.id === serviceId)
      ?.addons.filter((a) => a.status === "published") ?? [];
  const [rows, setRows] = useState(() => [crypto.randomUUID()]);
  const [key] = useState(() => crypto.randomUUID());
  return (
    <fieldset className="space-y-3">
      <legend className="font-semibold">Rental and extra charges</legend>
      {addons.map((a) => (
        <label key={a.id} className="flex gap-2">
          <input type="checkbox" name="quote_extra" value={a.id} />
          {a.name}: {formatMoney(a.amountMinor)} {a.basis}. Added to the quote by the server.
        </label>
      ))}
      <input type="hidden" name="quote_key" value={key} />
      {rows.map((id) => (
        <div key={id} className="flex flex-wrap gap-3">
          <label>
            Charge description
            <input name="quote_label" required className="ml-2 rounded border bg-background p-2" />
          </label>
          <label>
            Amount (JMD)
            <input
              name="quote_amount"
              type="number"
              min="0"
              step="0.01"
              required
              className="ml-2 rounded border bg-background p-2"
            />
          </label>
          {rows.length > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setRows(rows.filter((r) => r !== id))}
            >
              Remove charge
            </Button>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => setRows([...rows, crypto.randomUUID()])}
      >
        Add charge
      </Button>
    </fieldset>
  );
}

function EnquiryFollowup({
  enquiryId,
  followup,
  userId,
  busy,
  save,
  today,
}: {
  enquiryId: string;
  followup?: { owner_id: string | null; notes: string; follow_up_on: string | null };
  userId?: string | undefined;
  busy: boolean;
  today: string;
  save: (name: string, args: Record<string, unknown>) => Promise<boolean>;
}) {
  const [notes, setNotes] = useState(followup?.notes ?? "");
  const [due, setDue] = useState(followup?.follow_up_on?.slice(0, 10) ?? "");
  const [claim, setClaim] = useState(false);
  return (
    <details className="rounded-xl border bg-muted/30 p-4">
      <summary className="cursor-pointer font-medium">
        Staff follow-up /{" "}
        {followup?.owner_id === userId
          ? "Assigned to you"
          : followup?.owner_id
            ? "Assigned to another staff member"
            : "Unassigned"}
        {followup?.follow_up_on
          ? ` / ${followup.follow_up_on.slice(0, 10) <= today ? "Due" : "Follow up"} ${followup.follow_up_on.slice(0, 10)}`
          : ""}
      </summary>
      <div className="mt-4 grid gap-4">
        <p className="text-sm text-muted-foreground">
          Internal notes are visible only to staff. Saving does not contact the customer.
        </p>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={claim} onChange={(e) => setClaim(e.target.checked)} />
          Assign this enquiry to me
        </label>
        <label className="grid gap-2 text-sm">
          Follow-up date (Jamaica)
          <input
            className="min-h-11 w-full min-w-0 rounded-lg border bg-background p-3"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Internal notes
          <textarea
            className="min-h-28 w-full rounded-lg border bg-background p-3"
            maxLength={5000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Next step, customer preferences or handover notes"
          />
        </label>
        <Button
          type="button"
          disabled={busy}
          onClick={() =>
            void save("save_enquiry_followup", {
              p_id: enquiryId,
              p_claim: claim,
              p_due: due || null,
              p_notes: notes,
            })
          }
        >
          Save follow-up
        </Button>
      </div>
    </details>
  );
}
