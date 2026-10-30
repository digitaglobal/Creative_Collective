import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const key = "creative-collective-tour";
const steps = [
  {
    path: "/admin",
    target: "[data-tour='welcome']",
    title: "Welcome to Creative Collective",
    body: "Enigma offers coworking spaces; Studio D offers production spaces. Customers discover spaces and request bookings or quotes. Your team manages them here. Let's visit the customer side first.",
  },
  {
    path: "/spaces",
    target: "main",
    title: "1. Discover a space",
    body: "This is where customers start. Use the purpose, venue and group-size filters to narrow down spaces. Compare options and browse the cards. You can interact with the highlighted area before selecting Next.",
  },
  {
    path: "/enigma/services/meeting-room",
    target: "main",
    title: "2. Understand a service",
    body: "A service page explains the space, published prices and available options. Explore the details and date/time controls when available. Reservations need staff approval; custom requests begin with an enquiry. This tour never submits a booking for you.",
  },
  {
    path: "/admin",
    target: "[data-tour='overview']",
    title: "3. Start the working day",
    body: "These four cards show requests awaiting approval, arrivals, departures and guests checked in. Click a card to filter the day's work. Zero means there are currently no matching bookings.",
  },
  {
    path: "/admin",
    target: "[data-tour='filters']",
    title: "4. Find a booking",
    body: "Search by customer or reference, or filter by date, brand, status, payment or resource. Try a filter here. The Calendar button switches from the list to a schedule; switch back with List.",
  },
  {
    path: "/admin",
    target: "[data-tour='bookings']",
    title: "5. Review reservations",
    body: "Bookings appear here. Open one to inspect customer details, charges and history. Staff can approve, check in and complete visits, add internal notes, and record payments. Close the booking dialog to continue this tour. An empty list is normal before requests arrive.",
  },
  {
    path: "/admin",
    target: "[data-tour='attention']",
    title: "6. Resolve outstanding work",
    body: "Needs attention brings together booking issues, pending changes and failed notifications. Review each item's context before taking action. Approval, cancellation and retry controls act on real records.",
  },
  {
    path: "/admin",
    target: "[data-tour='enquiries']",
    title: "7. Follow an enquiry through to a quote",
    body: "Customer questions and custom rental requests appear here. Filter requests, track progress, assign follow-ups and keep internal notes. Quotes set the proposed price; customer acceptance still depends on availability. Saving or offering a quote changes real records.",
  },
  {
    path: "/admin",
    target: "[data-tour='create']",
    title: "8. Help a customer book",
    body: "We've opened the staff booking form. Select the customer and service to arrange a reservation on their behalf. Inspect the fields now; submitting creates a real request.",
  },
  {
    path: "/admin",
    target: "[data-tour='insights']",
    title: "9. Understand booking activity",
    body: "Booking insights is now open. This report shows how people move through the booking journey and where activity drops off. Little or no activity is expected while the platform is being reviewed.",
  },
  {
    path: "/admin",
    target: "[data-tour='settings']",
    title: "10. Manage the business",
    body: "Administrator settings is now open. Use Manage to browse venue information, services, prices, physical inventory, operating rules, closures and policies. Browse freely; Save and role controls make actual changes. Business approval is still required before launch.",
    admin: true,
  },
  {
    path: "/admin",
    target: "[data-tour='welcome']",
    title: "You're ready to explore",
    body: "Customers discover spaces and request reservations; your team handles bookings and enquiries here. Prices are in JMD and times are in Jamaica time. You can restart this tour at the top of Operations whenever you need a refresher.",
  },
];

export function AdminWalkthrough() {
  return (
    <section
      data-tour="welcome"
      className="surface-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/30 p-5"
    >
      <div>
        <h2 className="text-xl font-semibold">New to Creative Collective?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Take a guided tour of the customer experience and your team's tools.
        </p>
      </div>
      <Button onClick={() => window.dispatchEvent(new Event("start-platform-tour"))}>
        Start guided tour
      </Button>
    </section>
  );
}

export function PlatformTour() {
  const auth = useAuth();
  const [index, setIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const available = steps.filter((s) => !s.admin || auth.role === "administrator");
  const step = index === null ? undefined : available[index];
  useEffect(() => {
    const saved = sessionStorage.getItem(key);
    if (saved !== null && /^\d+$/.test(saved)) setIndex(Number(saved));
    const start = () => {
      sessionStorage.setItem(key, "0");
      setIndex(0);
    };
    window.addEventListener("start-platform-tour", start);
    return () => window.removeEventListener("start-platform-tour", start);
  }, []);
  const stop = () => {
    sessionStorage.removeItem(key);
    setIndex(null);
    setRect(null);
  };
  useEffect(() => {
    if (!step || !auth.staff || auth.loading) return;
    if (window.location.pathname !== step.path) {
      window.location.assign(step.path);
      return;
    }
    let target: HTMLElement | null = null;
    let observer: ResizeObserver | undefined;
    const update = () => {
      if (target) setRect(target.getBoundingClientRect());
    };
    const locate = () => {
      const found = document.querySelector<HTMLElement>(step.target);
      if (!found || found === target) return;
      target = found;
      if (target instanceof HTMLDetailsElement) target.open = true;
      target.scrollIntoView({ block: "start", behavior: "instant" });
      window.scrollBy(0, -100);
      update();
      observer?.disconnect();
      observer = new ResizeObserver(update);
      observer.observe(target);
    };
    locate();
    const timer = window.setInterval(locate, 300);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    panel.current?.focus({ preventScroll: true });
    return () => {
      clearInterval(timer);
      observer?.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      setRect(null);
    };
  }, [step, auth.staff, auth.loading]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  if (!step || !auth.staff) return null;
  const move = (next: number) => {
    sessionStorage.setItem(key, String(next));
    setIndex(next);
  };
  return (
    <>
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-40 rounded-xl border-4 border-yellow-400"
          style={{
            left: Math.max(4, rect.left - 4),
            top: Math.max(70, rect.top - 4),
            width: Math.min(rect.width + 8, window.innerWidth - 8),
            height: Math.max(
              30,
              Math.min(rect.bottom, window.innerHeight - 260) - Math.max(70, rect.top) + 4,
            ),
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.35)",
          }}
        />
      )}
      <div
        ref={panel}
        tabIndex={-1}
        role="region"
        aria-label="Guided platform tour"
        className="fixed inset-x-3 bottom-3 z-50 mx-auto max-h-[45dvh] max-w-2xl overflow-auto rounded-2xl border border-yellow-400 bg-background p-5 shadow-2xl outline-none"
      >
        <div aria-live="polite" aria-atomic="true">
          <p className="text-xs font-medium text-muted-foreground">
            GUIDED TOUR · {index! + 1} OF {available.length}
          </p>
          <h2 className="mt-2 text-lg font-semibold">{step.title}</h2>
          <p className="mt-2 text-sm leading-6">{step.body}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" disabled={index === 0} onClick={() => move(index! - 1)}>
            Back
          </Button>
          <Button onClick={() => (index === available.length - 1 ? stop() : move(index! + 1))}>
            {index === available.length - 1 ? "Finish tour" : "Next"}
          </Button>
          <Button variant="ghost" onClick={stop}>
            Exit tour
          </Button>
        </div>
      </div>
    </>
  );
}
