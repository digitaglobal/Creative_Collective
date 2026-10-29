import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { rpc, db, backendConfigured } from "@/lib/supabase";
import { venueDate } from "@/lib/booking";

export function EnquiryForm({
  serviceId,
  date,
  attendees,
  start,
  duration,
}: {
  serviceId: string;
  date?: string | undefined;
  attendees?: number | undefined;
  start?: string | null | undefined;
  duration?: number | undefined;
}) {
  const auth = useAuth();
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
  const [draft, setDraft] = useState<Record<string, string>>({});
  const defaults: Record<string, string> = {
    name: profile.data?.full_name ?? "",
    email: auth.user?.email ?? "",
    phone: profile.data?.phone ?? "",
    start: date ?? "",
    end: draft["start"] ?? date ?? "",
    attendees: String(attendees ?? 1),
  };
  const value = (name: string) => draft[name] ?? defaults[name] ?? "";
  const [receipt, setReceipt] = useState<{ id: string; summary: string; tracked: boolean } | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const receiptElement = useRef<HTMLElement>(null);
  useEffect(() => {
    if (receipt) {
      receiptElement.current?.focus({ preventScroll: true });
      receiptElement.current?.scrollIntoView({ block: "start" });
    }
  }, [receipt]);
  if (receipt)
    return (
      <section
        ref={receiptElement}
        tabIndex={-1}
        aria-label="Enquiry receipt"
        className="scroll-mt-40 space-y-3 rounded border bg-muted p-4"
      >
        <h2 className="font-semibold">Enquiry received</h2>
        <p>Enquiry received. Staff will review it; no space has been reserved.</p>
        <p className="break-all">Reference: ENQ-{receipt.id}</p>
        <p>{receipt.summary}</p>
        <p className="text-sm">
          Keep this reference. Email notifications are not active yet. A quote is subject to review
          and does not hold the space.
        </p>
        {receipt.tracked ? (
          <Link to="/account/bookings" hash="enquiries" className="block underline">
            Track in My enquiries
          </Link>
        ) : (
          <p className="text-sm">
            To track this in an account, ask the venue to link your enquiry after you create and
            verify an account with the same email. Guest enquiries do not appear automatically.
          </p>
        )}
        <Button
          variant="outline"
          onClick={() => {
            setReceipt(null);
            setDraft({});
            setKey(crypto.randomUUID());
          }}
        >
          Send another enquiry
        </Button>
      </section>
    );
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        setMessage("");
        try {
          const id = await rpc<string>("submit_enquiry", {
            p_service: serviceId,
            p_key: key,
            p_name: data.get("name"),
            p_email: data.get("email"),
            p_phone: data.get("phone"),
            p_start: data.get("start"),
            p_end: data.get("end"),
            p_period: data.get("period"),
            p_attendees: Number(data.get("attendees")),
            p_message: [
              start
                ? `Preferred start: ${start} Jamaica time; duration: ${duration} minutes. Subject to venue confirmation.`
                : "",
              String(data.get("message") ?? ""),
            ]
              .filter(Boolean)
              .join("\n"),
          });
          setMessage("Enquiry received. Staff will review it; no space has been reserved.");
          setReceipt({
            id,
            summary: `${data.get("start")} – ${data.get("end")} · ${data.get("period")} · ${data.get("attendees")} attendees`,
            tracked: !!auth.user,
          });
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Unable to send enquiry");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="font-semibold">Ask about this space or a longer rental</h2>
      <p className="text-sm text-muted-foreground">
        Daily, weekly and monthly rentals are reviewed by staff. Sign in before enquiring to receive
        quotes in your account.
      </p>
      {auth.user && (
        <p className="text-sm">
          Your enquiry will appear in My enquiries. You can edit your contact details below.
        </p>
      )}
      {start && (
        <p className="text-sm">
          Preferred start: {start} Jamaica time · {duration} minutes. Clarify any changes in the
          details below.
        </p>
      )}
      {[
        ["name", "Full name", "text"],
        ["email", "Email", "email"],
        ["phone", "Phone", "tel"],
        ["start", "First date", "date"],
        ["end", "Last date", "date"],
        ["attendees", "Attendees", "number"],
      ].map(([name, label, type]) => (
        <label key={name} className="block text-sm">
          {label}
          <input
            name={name}
            type={type}
            required
            disabled={auth.loading || busy}
            value={value(name!)}
            onChange={(event) =>
              setDraft((previous) => ({ ...previous, [name!]: event.target.value }))
            }
            min={
              type === "date"
                ? name === "end"
                  ? value("start") || venueDate()
                  : venueDate()
                : type === "number"
                  ? 1
                  : undefined
            }
            max={type === "number" ? 1000 : undefined}
            autoComplete={
              name === "name"
                ? "name"
                : name === "email"
                  ? "email"
                  : name === "phone"
                    ? "tel"
                    : "off"
            }
            maxLength={
              name === "phone" ? 50 : name === "email" ? 254 : type === "text" ? 200 : undefined
            }
            className="mt-1 w-full rounded border bg-background p-2"
          />
        </label>
      ))}
      <label className="block text-sm">
        Rental period
        <select
          name="period"
          disabled={auth.loading || busy}
          aria-label="Rental period"
          className="mt-1 w-full rounded border bg-background p-2"
        >
          {["hourly", "daily", "weekly", "monthly"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Equipment needs and other details
        <textarea
          name="message"
          disabled={auth.loading || busy}
          maxLength={4500}
          className="mt-1 w-full rounded border bg-background p-2"
        />
      </label>
      <Button disabled={busy || !backendConfigured || auth.loading}>
        {busy ? "Sending…" : "Send enquiry"}
      </Button>
      {!backendConfigured && (
        <p className="text-sm">Enquiries will be available once venue setup is complete.</p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </form>
  );
}
