# Booking conversion improvements

- Checkout shows itemized JMD pricing and approval expectations before authentication. Unknown tax is never displayed as a final zero-tax total.
- Sign-in, account verification and password-reset links preserve an allowlisted return destination. Review links restore date, time, duration, attendees and published extras for editing. Availability is always checked again.
- If no slots are available, check the next seven dates within the booking horizon for the same service, duration and extras. Display up to four actual available suggestions. These are not holds.
- Mobile booking and review actions have a sticky price/action area. Confirmation polls the saved booking and distinguishes pending requests from approved bookings.
- Staff can view the last 30 days of first-party measurements in Operations, split by mobile/desktop viewport. Browser-tab session IDs deduplicate each service/step/day. Counts are unique sessions reaching each step, not a strict sequential cohort or a guaranteed conversion rate. Status counts use the current booking state; only an authenticated owner can attach a submitted booking.
- Measurement is best effort, respects Do Not Track, and does not collect contact details, arbitrary URLs or IP addresses. A booking ID links the final step to an existing reservation. Anonymous browsing events can be noisy/spoofed; treat this as directional operational reporting. Reporting is staff-only and the event table is inaccessible through public RLS. No external analytics service is used.

Deployment: apply `202610290002_booking_funnel.sql` before deploying the frontend. No existing booking function or approval setting is changed. Emails, online payments, guest reservations, instant confirmation and unconfirmed business details remain deferred.

Checks: browser coverage includes guest-to-login-to-review with preserved selections on mobile, edit restoration, real alternatives on closed dates, and existing customer/staff/quote flows. Database coverage checks measurement deduplication, forged booking rejection and report access control; redirect tests cover external URLs and unapproved local paths.
