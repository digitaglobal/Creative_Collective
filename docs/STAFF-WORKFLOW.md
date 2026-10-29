# Staff daily workflow

The operations page starts with clickable counts for pending approvals, today's confirmed arrivals and departures (Jamaica calendar dates), and all checked-in bookings. Clicking a count clears other filters; Show all bookings / clear filters returns to the full list. Counts refresh every 30 seconds; staff can refresh manually. Multi-day rentals appear on their departure date.

Booking cards open an accessible dialog with customer details, Jamaica-time dates, balance and valid next actions. Reject, cancel and no-show actions require an explicit confirmation, with a Keep booking escape. No-show is unavailable before the start. Existing server transition rules remain authoritative. A synchronous in-flight guard and disabled buttons prevent concurrent submissions from rapid clicks.

Internal notes stay in the booking dialog after saving; notes and history show local dates and staff names. Customer-facing queries and existing staff-only row security are unchanged. Payment recording remains manual; online payments, business approvals and email delivery remain pending. Booking insights and administrator settings are collapsed so daily tasks remain prominent.

Validation covers the full customer-to-staff workflow, note privacy and duplicate clicks, partial payments/refunds, cancellation confirmation, rejection, no-show, permissions, filtering, mobile overflow and Jamaica midnight/multi-day date boundaries. Test fixtures run against the local database facade; no live booking or configuration changes are required.
