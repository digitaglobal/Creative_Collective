# Staff operations verification — 29 October 2026

Scope: fixture-based staff operations and isolated hosted database checks. Email provisioning/delivery and business approvals remain pending.

## Coverage

- Request approval and rejection (cancellation), check-in, completion and no-show.
- A future session cannot be marked no-show; terminal states cannot be checked in again.
- Partial/full manual payments, outstanding balances and full refunds.
- Overpayment and over-refund attempts fail without ledger entries.
- Exact retries produce one payment; changing amount, kind, method or receipt is rejected.
- Simultaneous payments cannot exceed the total; simultaneous refunds cannot exceed money paid.
- Concurrent payment retries produce one ledger entry and one audit event.
- Internal notes remain private to staff; customers cannot read or create them.
- Actor/time audit entries for rejection, completion and no-show.
- Search, date, brand, booking status, payment status, current resource allocation filters, and calendar/list views.

## Fixes

Migration `202610290001_payment_retry_details.sql` validates method and receipt reference as well as booking/amount/kind for repeated payment requests, and rejects null required details explicitly. A regression test reproduced the mismatch before this fix. The migration is applied to the hosted backend.

Staff filter dropdowns now have explicit accessible labels. Payment amount parsing errors are shown in the form rather than becoming unhandled errors. Staff and customer summaries show total, paid amount and balance with readable separators.

## Verification

- 18 database/unit tests pass.
- All five browser scenarios pass, including the full staff payment/refund/filter/note/no-show flow and the approval/check-in/completion flow.
- 17 local PostgreSQL reliability/concurrency checks pass.
- 17 hosted PostgreSQL checks pass in a disposable database on the configured Supabase server. Thirteen deployed RPC definitions exactly matched the test definitions (SHA-256 `81e662ad82d2ed87d0c9dc4c92ad18675d2a28c3f669830c6ac4919431ec9e54`). Temporary database cleanup and unchanged application snapshot were verified.
- TypeScript and lint pass; lint retains six existing Fast Refresh warnings.
- Production build passes.

Browser coverage uses the local test HTTP facade and fixture authentication. Hosted database checks exercise PostgreSQL, not the live staff website. UI changes still require website deployment. No real financial transactions were entered, and the production application's settings, users, booking and notification counts were unchanged by the hosted tests.
