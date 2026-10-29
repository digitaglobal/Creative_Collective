import { backendConfigured, rpc } from "@/lib/supabase";

type Step = "space_viewed" | "time_selected" | "checkout_started" | "request_submitted";
/** Best-effort first-party measurement. Never send contact details or block booking. */
export function trackBookingStep(step: Step, service: string, bookingId?: string) {
  if (typeof window === "undefined" || !backendConfigured || navigator.doNotTrack === "1") return;
  try {
    let session = sessionStorage.getItem("booking-visit");
    if (!session) {
      session = crypto.randomUUID();
      sessionStorage.setItem("booking-visit", session);
    }
    const key = `booking-step:${new Date().toISOString().slice(0, 10)}:${service}:${step}:${bookingId ?? ""}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void rpc("record_booking_step", {
      p_session: session,
      p_service: service,
      p_step: step,
      p_device: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
      p_booking: bookingId ?? null,
    }).catch(() => {
      sessionStorage.removeItem(key);
    });
  } catch {
    /* Storage or tracking restrictions must not affect booking. */
  }
}
