import { useState } from "react";
import { Button } from "@/components/ui/button";
import { rpc, backendConfigured } from "@/lib/supabase";
import { venueDate } from "@/lib/booking";

export function EnquiryForm({ serviceId }: { serviceId: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
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
          await rpc("submit_enquiry", {
            p_service: serviceId,
            p_key: key,
            p_name: data.get("name"),
            p_email: data.get("email"),
            p_phone: data.get("phone"),
            p_start: data.get("start"),
            p_end: data.get("end"),
            p_period: data.get("period"),
            p_attendees: Number(data.get("attendees")),
            p_message: data.get("message"),
          });
          setMessage("Enquiry received. Staff will review it; no space has been reserved.");
          form.reset();
          setKey(crypto.randomUUID());
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
            min={type === "date" ? venueDate() : type === "number" ? 1 : undefined}
            maxLength={type === "text" ? 200 : undefined}
            className="mt-1 w-full rounded border bg-background p-2"
          />
        </label>
      ))}
      <label className="block text-sm">
        Rental period
        <select
          name="period"
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
          maxLength={5000}
          className="mt-1 w-full rounded border bg-background p-2"
        />
      </label>
      <Button disabled={busy || !backendConfigured}>{busy ? "Sending…" : "Send enquiry"}</Button>
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
