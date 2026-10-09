# Creative Collective setup and operations

## What is implemented and what requires provisioning

The app uses Supabase Auth, RLS-protected tables, PostgreSQL RPCs and exclusion constraints, photo storage, and a Resend notification worker. A hosted Supabase project is configured locally and reachable. Its staging/production designation still needs confirmation. Email sender provisioning and website deployment have not been verified.

### Verification checkpoint — 9 October 2026

- TypeScript passes; lint passes with six React Fast Refresh warnings.
- All 15 database/unit tests and all four browser tests pass. The production build passes.
- Read-only checks of the configured hosted database found 20 services, four resources, and seven policies, all unapproved; no bookings or profiles were present.
- Hosted settings have `launch_approved=false`, `online_payments_enabled=false`, and `tax_basis_points=null`.
- These checks do not establish that every migration is applied, that hosted authentication flows work, or that notification delivery and scheduling work.
- No Supabase management token or Resend API key was available in the local environment. Confirm the target environment, staging URL, verified administrator email, and email sender before provisioning the remaining services.
- No Git remote is configured in this checkout. The local checkpoint cannot sync to Lovable until the correct connected repository and branch are supplied.

Online payments remain disabled in both the UI and database. `src/lib/payments.ts` is the future provider contract, not a working payment integration. Choosing a provider is required before hosted checkout, callback verification, payment reconciliation, and online refunds can be implemented and tested.

## Environments

1. Create separate Supabase projects for staging and production. Link with the Supabase CLI and apply all files in `supabase/migrations` in order (`supabase db push`). Run `supabase start` / `supabase db reset` for local development if Docker is available.
2. Copy `.env.example` to `.env.local`; configure only the public project URL and anonymous/publishable key. Never expose the service-role key, Resend key, or job secret as a `VITE_` variable. Demo mode defaults off and is forcibly off in production.
3. Configure Supabase Auth site URL and redirect allowlist for `/login` and `/login?recovery=1` on each environment. Enable email confirmations, use an eight-character minimum password, and configure Supabase SMTP with Resend for signup/reset emails. Turn on Auth rate limits and CAPTCHA according to deployment traffic.
4. Create and verify the first administrator account. Promote that exact UUID using the Supabase SQL console: `update public.profiles set role='administrator' where id='<verified-user-uuid>';`. Subsequent promotions use the administrator screen; users cannot edit their own role.
5. Configure Edge Function secrets: `RESEND_API_KEY`, `RESEND_FROM`, `JOB_SECRET`. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function. Deploy `notification-worker` with JWT verification disabled as configured; its separate Bearer job secret is mandatory.
6. Invoke the worker every minute with a trusted scheduler: POST `/functions/v1/notification-worker`, `Authorization: Bearer <JOB_SECRET>`. Store the secret in the scheduler's secret store, not source code. The worker expires requests, claims jobs using row locks, sends emails with idempotency keys, and retries failures up to five attempts.
7. Configure an edge/WAF rate limit for public enquiry endpoints. The database additionally limits submissions by email to five per hour. Do not rely on that per-email limit as the only spam defence.

Use `npm ci`, `npm run dev`, `npm run typecheck`, `npm test`, and `npm run build`. The PostgreSQL tests run in PGlite without Docker; they mock Supabase's auth/storage schemas while executing the actual migrations and database functions. Browser tests (`npm run test:e2e`) use a local HTTP facade over those migrations and fixture auth sessions to verify customer/staff UI flows. They do not verify a real hosted Auth deployment or email delivery. They do not replace a multi-connection concurrency test against staging PostgreSQL.

## Business approvals before first live release

The catalog migration contains proposals, not approved business information. Its services and resources start unapproved, tax is null, policies are placeholders, and `launch_approved` is false.

- Confirm actual individual desk/office/pod inventory and which Studio D configurations share a room. Add resources and service mappings accordingly. Unmapped or unapproved services stay enquiry-only.
- Approve actual prices, duration rules, capacity, included equipment, extras, and personnel/equipment resource mappings. Each service document must retain matching id/brand/slug fields and the existing service shape.
- Supply photographs, address/contact/accessibility information, and `arrivalInstructions` in each brand document. Upload approved photography to `venue-photos` and set `imageUrl` in the service document.
- Set operating hours, notice, horizon, and buffers in settings. Jamaica time and JMD are fixed for this release.
- Set `tax_basis_points` to the approved rate (e.g. 1500 means 15%). Zero must be an explicit approval, not a substitute for unknown tax.
- Replace all seven policy bodies: cancellation, refund, no_show, late_arrival, house_rules, privacy, terms. Approve them and increment the version whenever wording changes. Checkout records accepted versions.
- Only after these approvals and staging verification, set `launch_approved=true`. `online_payments_enabled` remains false.

Administrator configuration provides forms for services, prices, extras, inventory, allocation, hours, closures, policies and venue details. Use the allocation sections to assign physical spaces and equipment. Never seed demo customers or demo bookings in production.

## Staff workflow

Review pending reservations and their expiry deadlines. Approve to confirm an unpaid booking or cancel to reject it. Pending requests block inventory until expiry at the earlier of submission + 24 hours or session start.

Use the operations list or calendar grouped by date, with filters for customer/reference, brand, date, resource, booking status, and payment status. Open a booking to record notes, payments, refunds, check-in, completion, or no-show. Staff enter amounts in JMD (e.g. 5000.00); the app converts them to integer minor units for storage.

Partial payments leave a balance. Cancelling never refunds money automatically. Record an actual refund separately and retain the external receipt/reference. The ledger and audit trail record actor and time.

For changes, review the computed new price and any refund required before approval. Original allocations remain until a reschedule succeeds; conflicts roll the transaction back. Long-rental rescheduling currently uses a replacement staff-reviewed quote; customer self-service changes for quoted rentals support cancellation only.

Guests may submit enquiries. To offer an account quote, link a verified account matching the enquiry email; otherwise ask the customer to create/verify an account. Quotes have versions and expiry, do not hold inventory, and require policy acceptance. Acceptance rechecks availability and creates a pending pay-in-person reservation.

## Monitoring, recovery and rollout

Monitor Supabase logs and Edge Function structured `expiry_failed` / `notification_failed` events. Investigate worker invocation failures, overdue pending reservations, stuck processing jobs, failed notifications, and payment exceptions. Retry failed emails from the staff dashboard; do not edit sent jobs or payment ledger entries manually.

Use Supabase backup/PITR capabilities appropriate to the purchased plan. Before rollout, export configuration and retain migration versions. Verify restore into a separate staging project; replaying migrations alone does not restore bookings or ledger entries. Document the selected backup retention and recovery owner before launch.

Run a staging lifecycle: verified signup → reservation → staff approval → confirmation email → partial/full manual payment → check-in → completion. Also test cancellation/refund, conflicting reschedules, quote expiry/acceptance, closure handling, and two simultaneous requests from separate sessions targeting one slot. Confirm one allocation succeeds and the other receives a conflict. Verify cross-customer reads and direct RPC calls with anonymous/customer keys.

Release to a small staff/customer pilot, then enable live pay-in-person booking. To pause new reservations, set `launch_approved=false`; keep staff operations and the worker running so existing bookings can be managed. Preserve published Lovable history and use ordinary commits; do not force-push, amend pushed commits, or rebase published history.

## Payment-provider follow-up

Once selected, verify merchant eligibility, JMD settlement/support, hosted checkout, signed webhooks, event identifiers, refund support, and reconciliation APIs. Implement the provider contract plus transactional payment-event storage, ten-minute hold creation, delayed-payment allocation/payment-exception handling, receipts and reconciliation. Test invalid/duplicate/late callbacks and refunds before relaxing the database's online-payment-disabled constraint. A browser success redirect must never confirm a booking.

Official setup references: [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords), [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Resend email API](https://resend.com/docs/api-reference/emails/send-email).
