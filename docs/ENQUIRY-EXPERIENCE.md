# Enquiry submission and tracking

Signed-in users receive editable contact details from their profile. Service-page date, group size, and selected start/duration carry into the enquiry; the latter are explicitly marked preferences. First-date changes also update an untouched last date. Rental period remains selectable and is preserved on a failed submission. Edited fields are never overwritten by a late profile response.

Successful submissions show `ENQ-` followed by the full existing enquiry UUID, a request summary and next steps. This reference is not an access token. No space is reserved. Signed-in customers can use **My bookings → My enquiries** to see linked records and their current status, refreshed every 30 seconds or manually. Quotes remain in the existing Rental quotes section. Guest receipts explain that staff must link a subsequently verified matching account; email alone never grants enquiry access.

The staff queue includes status counts, status filtering, reference/customer/service search, newest-first ordering and a Prepare quote shortcut. Existing staff-only RPCs still control status changes and quote creation. Customer reads continue to use ownership RLS; no database migration is needed.

Emails, business approvals and online payments are unchanged. Existing quote expiry and acceptance rules still apply. Browser tests cover prefill, status tracking, staff filtering/quote preparation, guest selection carryover, retry after a simulated server failure, reference display and mobile layout. Database tests verify that another customer cannot read or change the enquiry.


## Customer progress tracking (30 October 2026)

My enquiries now groups each request with a next-step panel, received/review/quote progress summary, original requirements, quote versions and revision messages. Quote links target the matching quote form; accepted quotes show the linked reservation status. Expired and superseded offers do not show an accept action in the progress panel. Progress is a summary of recorded states, not invented historical transition timestamps.

History is customer-scoped and uses existing row-level security. Staff follow-up notes are never queried. History refreshes every 30 seconds and with Refresh enquiries; quote actions invalidate it immediately. A history failure has its own retry control and does not hide original requests.

Validation: typecheck, production build and customer enquiry-to-quote browser test pass. Mobile screenshot reviewed. Business details, emails, online payments and the broader accessibility work remain pending.
