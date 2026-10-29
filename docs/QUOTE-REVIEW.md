# Customer quote review

Rental quotes show the service, version, enquiry reference, dates in Jamaica time, attendees, itemized charges (including quoted extras), subtotal, quoted tax rate, total and instructions. Accepted, expired, replaced and revision-requested versions are distinct from actionable offers. Expiry is checked every second in the UI and again by the server. Quote/history queries refresh every 30 seconds. Acceptance remains subject to venue readiness, current policies, availability and staff approval; no online payment is collected.

Customers can request changes to an offered version, including an expired offer, using a 10–2000 character description. The form explicitly explains that submission withdraws that offer. The `request_quote_revision` RPC locks the enquiry before the quote, matching quote creation's lock order. It verifies ownership, records one immutable request per quote, supersedes the offer and returns the enquiry to reviewing. Identical retries are safe; changed retries and accepted/replaced offers are rejected. Existing quote acceptance is serialized by the same quote lock. No allocation or notification job is created by a revision request.

Staff sees the request beside the original enquiry and uses the existing quote workflow to issue the next version. Revision history stays visible to its customer and staff only through RLS. This is a request for review, not an automatic change to dates, attendees, equipment or price. Accepted reservations continue to use the existing booking-change process.

Apply `202610290003_quote_revisions.sql` before deploying the frontend. Business approvals, tax configuration, email workers/schedules and payment integration remain unchanged. Existing quote creation may queue its existing notification job; this change does not enable email delivery.

Validation covers status/expiry precedence, ownership and RLS, repeated revision requests, acceptance blocked after withdrawal, new version acceptance, staff review, mobile layout and existing booking flows.
