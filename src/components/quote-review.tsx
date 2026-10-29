import { quoteStatus } from "@/lib/quote-status";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useCatalog } from "@/hooks/use-catalog";
import { db, rpc } from "@/lib/supabase";
import { formatMoney } from "@/lib/format";
import type { Policy } from "@/lib/booking";
import { Button } from "@/components/ui/button";

export type Quote = {
  id: string;
  enquiry_id: string;
  service_id: string;
  version: number;
  starts_at: string;
  ends_at: string;
  attendees: number;
  subtotal_minor: number;
  total_minor: number;
  tax_basis_points: number;
  lines: { label: string; amountMinor: number }[];
  instructions: string;
  expires_at: string;
  state: string;
  booking_id: string | null;
};
const jamaica = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    timeZone: "America/Jamaica",
    dateStyle: "medium",
    timeStyle: "short",
  });

export function QuoteReviews() {
  const auth = useAuth();
  const catalog = useCatalog();
  const query = useQuery({
    queryKey: ["my-quotes", auth.user?.id],
    enabled: !!auth.user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await db()
        .from("quotes")
        .select("*")
        .eq("customer_id", auth.user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Quote[];
    },
  });
  const revisions = useQuery({
    queryKey: ["my-quote-revisions", auth.user?.id],
    enabled: !!auth.user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await db()
        .from("quote_revisions")
        .select("*")
        .eq("customer_id", auth.user!.id);
      if (error) throw error;
      return data;
    },
  });
  const policies = useQuery({
    queryKey: ["policies"],
    queryFn: () => rpc<Policy[]>("public_policies"),
  });
  return (
    <section aria-label="Rental quotes" className="space-y-4">
      <h2 id="rental-quotes" className="scroll-mt-40 text-xl font-semibold">
        Rental quotes
      </h2>
      <p>
        Review the full price and Jamaica-time dates below. Accepting a quote requests a
        reservation; staff must still approve it. No online payment is collected.
      </p>
      {query.isLoading && <p role="status">Loading quotes…</p>}
      {query.error && (
        <p role="alert">
          Could not load quotes.{" "}
          <button className="underline" onClick={() => void query.refetch()}>
            Try again
          </button>
        </p>
      )}
      {revisions.error && (
        <p role="alert">
          Revision history is temporarily unavailable. Please refresh before taking action.
        </p>
      )}
      {!query.isLoading && !query.error && !query.data?.length && (
        <p>No quotes yet. Staff will prepare one after reviewing your enquiry.</p>
      )}
      {query.data?.map((quote) => (
        <QuoteCard
          key={quote.id}
          quote={quote}
          revision={revisions.data?.find((r) => r.quote_id === quote.id)?.message}
          historyReady={revisions.isSuccess}
          policies={policies.data ?? []}
          serviceName={
            catalog.data?.services.find((s) => s.id === quote.service_id)?.name ?? "Space rental"
          }
          acknowledgement={
            catalog.data?.services.find((s) => s.id === quote.service_id)?.acknowledgement
          }
          ready={!!catalog.data?.ready}
        />
      ))}
    </section>
  );
}

function QuoteCard({
  quote: q,
  revision,
  historyReady,
  policies,
  serviceName,
  acknowledgement,
  ready,
}: {
  quote: Quote;
  revision?: string | undefined;
  historyReady: boolean;
  policies: Policy[];
  serviceName: string;
  acknowledgement?: string | undefined;
  ready: boolean;
}) {
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [changes, setChanges] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const status = quoteStatus(q, !!revision, now);
  const canAccept = status === "Awaiting your decision" && ready && historyReady;
  const canRevise = q.state === "offered" && !revision && historyReady;
  return (
    <div className="surface-panel space-y-4 p-5">
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!canAccept || busy) return;
          const data = new FormData(event.currentTarget);
          setBusy(true);
          setMessage("");
          try {
            await rpc("accept_quote", {
              p_id: q.id,
              p_service_ack: data.get("ack") === "on",
              p_policy_versions: Object.fromEntries(policies.map((p) => [p.id, p.version])),
            });
            await qc.invalidateQueries();
            setMessage("Quote accepted. Reservation awaits staff approval.");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Unable to accept quote");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3 className="text-lg font-semibold">
          {serviceName} · Quote v{q.version}
        </h3>
        <p className="font-medium">{status}</p>
        <p className="break-all text-xs text-muted-foreground">Enquiry: ENQ-{q.enquiry_id}</p>
        <p>
          {jamaica(q.starts_at)} – {jamaica(q.ends_at)} · Jamaica time
        </p>
        <p>{q.attendees} attendees</p>
        <dl className="space-y-2 text-sm">
          {q.lines.map((line, index) => (
            <div key={index} className="flex justify-between gap-3">
              <dt className="min-w-0 break-words">{line.label}</dt>
              <dd className="shrink-0">{formatMoney(line.amountMinor)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t pt-2">
            <dt>Subtotal including listed extras</dt>
            <dd className="shrink-0">{formatMoney(q.subtotal_minor)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Tax ({q.tax_basis_points / 100}%)</dt>
            <dd>{formatMoney(q.total_minor - q.subtotal_minor)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-base font-semibold">
            <dt>Total (JMD)</dt>
            <dd>{formatMoney(q.total_minor)}</dd>
          </div>
        </dl>
        <p className="whitespace-pre-wrap break-words">{q.instructions}</p>
        <p>
          {status === "Expired" ? "Expired" : "Offer expiry"}: {jamaica(q.expires_at)} Jamaica time.
          Quotes do not reserve space.
        </p>
        {q.state === "accepted" && (
          <p>
            See your reservation above for its latest status. Quote acceptance alone does not
            confirm it.
          </p>
        )}
        {revision && (
          <div className="rounded border p-3">
            <p className="font-medium">Your requested changes</p>
            <p className="whitespace-pre-wrap break-words">{revision}</p>
            <p>
              Staff will review these requirements. Check here for a new quote version; no email is
              sent.
            </p>
          </div>
        )}
        {status === "Awaiting your decision" && (
          <>
            {!ready && <p>Acceptance awaits approved venue configuration.</p>}
            {policies.map((policy) => (
              <details key={policy.id}>
                <summary>{policy.title}</summary>
                <p className="whitespace-pre-wrap">{policy.body}</p>
              </details>
            ))}
            {acknowledgement && (
              <label className="flex gap-2">
                <input type="checkbox" name="ack" required />
                {acknowledgement}
              </label>
            )}
            <label className="flex gap-2">
              <input type="checkbox" required />I accept the current policies.
            </label>
            <Button disabled={!canAccept || policies.length !== 7 || busy}>
              Accept quote and request reservation
            </Button>
          </>
        )}
      </form>
      {canRevise && (
        <details>
          <summary className="cursor-pointer py-2 font-medium">Request a revision</summary>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setMessage("");
              try {
                await rpc("request_quote_revision", { p_id: q.id, p_message: changes.trim() });
                await qc.invalidateQueries();
                setMessage(
                  "Revision requested. Check here for a new quote; no space has been reserved.",
                );
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Unable to request revision");
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="text-sm">
              Describe different dates, attendees, equipment or other requirements. Sending this
              request withdraws this offer from acceptance. It does not change or reserve any dates;
              staff must prepare a new quote.
            </p>
            <label className="block">
              Requested changes
              <textarea
                required
                minLength={10}
                maxLength={2000}
                value={changes}
                onChange={(event) => setChanges(event.target.value)}
                className="mt-2 w-full rounded border bg-background p-3"
              />
            </label>
            <Button disabled={busy || changes.trim().length < 10}>Send revision request</Button>
          </form>
        </details>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
