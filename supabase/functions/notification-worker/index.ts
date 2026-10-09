import { createClient } from "npm:@supabase/supabase-js@2";

// Invoke from an authenticated scheduler every minute. JWT verification is replaced
// with a dedicated job secret; no browser may possess that secret or service key.
Deno.serve(async (request: Request) => {
  const secret = Deno.env.get("JOB_SECRET");
  if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`)
    return new Response("Unauthorized", { status: 401 });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const sender = Deno.env.get("RESEND_FROM");
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error: expiryError } = await db.rpc("expire_reservations");
  if (expiryError) {
    console.error(JSON.stringify({ event: "expiry_failed", message: expiryError.message }));
    return Response.json({ error: "Expiry job failed" }, { status: 500 });
  }
  if (!apiKey || !sender)
    return Response.json(
      { error: "Email sender not configured; reservation expiry completed" },
      { status: 503 },
    );
  const { data: jobs, error } = await db.rpc("claim_notifications", { p_limit: 25 });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  let sent = 0;
  for (const job of jobs ?? []) {
    try {
      // Recheck status after claiming: a cancellation or reschedule invalidates a reminder.
      if (job.subject.includes("Session reminder") && job.booking_id) {
        const { data: booking, error: bookingError } = await db
          .from("bookings")
          .select("booking_state,starts_at")
          .eq("id", job.booking_id)
          .single();
        if (bookingError) throw bookingError;
        if (booking.booking_state !== "confirmed" || new Date(booking.starts_at) <= new Date()) {
          await db.from("notification_jobs").update({ state: "cancelled" }).eq("id", job.id);
          continue;
        }
      }
      const { data: current } = await db
        .from("notification_jobs")
        .select("state")
        .eq("id", job.id)
        .single();
      if (current?.state !== "processing") continue;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": job.id,
        },
        body: JSON.stringify({
          from: sender,
          to: [job.recipient],
          subject: job.subject,
          text: job.body,
        }),
      });
      if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
      const { error: saveError } = await db
        .from("notification_jobs")
        .update({ state: "sent", sent_at: new Date().toISOString(), last_error: null })
        .eq("id", job.id)
        .eq("state", "processing");
      if (saveError) throw saveError;
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Notification failed";
      await db
        .from("notification_jobs")
        .update({
          state: job.attempts >= 5 ? "failed" : "pending",
          last_error: message,
          due_at: new Date(Date.now() + Math.min(60, 2 ** job.attempts) * 60_000).toISOString(),
        })
        .eq("id", job.id)
        .eq("state", "processing");
      console.error(JSON.stringify({ event: "notification_failed", job: job.id, message }));
    }
  }
  return Response.json({ claimed: jobs?.length ?? 0, sent });
});
