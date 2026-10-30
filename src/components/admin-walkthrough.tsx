import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const steps = [
  {
    title: "Welcome to Creative Collective",
    body: "This platform brings Enigma coworking spaces and Studio D production spaces into one place. Customers discover spaces and request reservations or quotes. Your team manages those requests here, from first enquiry to the end of a visit.",
    task: "Start with the customer view, then come back here to see how the team runs it.",
  },
  {
    title: "What your customers see",
    body: "Find a space is the starting point. Customers compare spaces, browse photos, and open a service to see its pricing, amenities and booking options. Enigma covers coworking; Studio D covers creative production.",
    task: "Open the customer view below in a new tab. Browse a space from each brand, then return to this tab.",
    customer: true,
  },
  {
    title: "How a reservation works",
    body: "For bookable services, a customer selects a time, signs in, reviews the price and policies, and submits a request. A request needs staff approval before it is confirmed. Longer rentals and custom work start with an enquiry and may need a quote.",
    task: "You can browse service pages without making a reservation. Venue setup and business approval must be completed before reservations are enabled.",
  },
  {
    title: "Your daily Operations dashboard",
    body: "This is the team's workspace. The four cards below show requests awaiting approval, arrivals, departures and people checked in. Search and filters help find a customer or booking; the calendar offers another way to see the schedule.",
    task: "Try a daily overview card, then Show all bookings / clear filters. An empty list simply means there are no matching bookings yet.",
  },
  {
    title: "Inside a booking",
    body: "Open a booking to see the customer, space, time, price and current status. Staff can approve requests, check guests in, record completion and add internal notes. Payment and refund entries record actual transactions; online payments are currently disabled.",
    task: "If bookings are available, open one and inspect its history. Approval, cancellation and payment buttons change real records.",
  },
  {
    title: "Enquiries and quotes",
    body: "Enquiries are customer questions or requests that need a conversation before booking. In Enquiries and quotes, the team can track progress, assign follow-ups, keep internal notes and offer a price. Customer acceptance of a quote leads into the reservation process, subject to availability.",
    task: "Scroll to Enquiries and quotes. Read any available request, or review the empty state if none have arrived.",
  },
  {
    title: "Reporting and business setup",
    body: "Booking insights summarizes activity through the booking journey. Administrator settings controls the business information: services, prices, physical spaces, equipment, operating rules, policies and account roles.",
    task: "Expand Booking insights, then Administrator settings. Use the Manage menu to browse the configuration. Save buttons make actual changes.",
  },
  {
    title: "Ready to explore",
    body: "You now know the two sides: customers discover and request spaces; the team manages bookings and enquiries through Operations. All times are in Jamaica time and prices are in JMD. Some business details still await approval, so the platform is being reviewed before launch.",
    task: "Explore at your own pace. You can restart this walkthrough any time from the top of Operations.",
  },
];

export function AdminWalkthrough() {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(true);
  const current = steps[step]!;
  return (
    <section
      aria-label="Platform walkthrough"
      className="surface-panel rounded-2xl border border-primary/30 p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Your introduction to Creative Collective</h2>
        <Button
          variant="ghost"
          onClick={() => {
            setOpen(!open);
            if (!open) setStep(0);
          }}
        >
          {open ? "Explore on my own" : "Start walkthrough"}
        </Button>
      </div>
      {open && (
        <div className="mt-5 max-w-3xl">
          <p className="text-sm text-muted-foreground">
            About 10 minutes · Step {step + 1} of {steps.length}
          </p>
          <progress
            className="mt-3 h-2 w-full accent-primary"
            value={step + 1}
            max={steps.length}
            aria-label="Walkthrough progress"
          />
          <div aria-live="polite" aria-atomic="true">
            <h3 className="mt-5 text-2xl font-semibold">{current.title}</h3>
            <p className="mt-3 leading-7 text-muted-foreground">{current.body}</p>
            <p className="mt-4 rounded-xl bg-muted p-4 text-sm leading-6">{current.task}</p>
          </div>
          {current.customer && (
            <Button asChild variant="outline" className="mt-4">
              <Link to="/spaces" target="_blank" rel="noopener noreferrer">
                Open customer view in a new tab
              </Link>
            </Button>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(step + 1)}>Next</Button>
            ) : (
              <Button onClick={() => setOpen(false)}>Finish and explore</Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
