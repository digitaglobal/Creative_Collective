# Booking reliability — 28 October 2026

Update, 29 October: the suite now has 17 passing checks, adding simultaneous payment overage prevention, payment retry deduplication and refund overage prevention. Both local PostgreSQL and isolated hosted PostgreSQL runs passed. Thirteen deployed RPC definitions matched. See [staff operations verification](STAFF-OPERATIONS-VERIFICATION.md) for the payment retry fix and current results; the 28 October figures below describe the earlier checkpoint.

Run `npm run test:reliability`. The suite starts disposable PostgreSQL on a random loopback port, applies every application migration, and uses fixture accounts/resources. It never loads `.env.local` or connects to hosted Supabase. The server stops and removes its temporary test data on completion. npm installs the platform PostgreSQL binaries as development dependencies. This check is included in CI.

## Results

14 checks pass on PostgreSQL 18.4, Windows x64:

- Same room: competing transactions produce exactly one booking.
- Different Studio D services sharing one room: exactly one succeeds.
- Concurrent retries with the same customer/key return the same booking.
- Adjacent reservations work without a buffer.
- Independent rooms can be reserved simultaneously.
- Setup buffers block otherwise adjacent reservations.
- Cancellation releases inventory.
- Expired requests release inventory before the next reservation.
- Shared equipment prevents conflicts across otherwise independent rooms.
- Equipment closures reject the entire reservation, without orphan bookings.
- Failed reschedules preserve original dates, allocations and pending requests.
- Concurrent reschedules into one slot preserve the losing original reservation.
- Concurrent quote acceptance rechecks shared inventory; the losing quote stays offered.
- Resource allocations contain no overlaps.

Concurrency checks keep the first transaction uncommitted and assert that the second backend is actually waiting on a PostgreSQL lock before committing the winner. They are not sequential overlap checks disguised as concurrent requests.

## Defect fixed

Concurrent retries previously raced past the existing-booking lookup, causing a unique-constraint error for the second request. Migration `202610280004_booking_retry_lock.sql` takes a transaction-scoped advisory lock for the customer/idempotency key before that lookup. Competing requests with different keys remain protected by the resource exclusion constraint. The regression test reproduced the failure before the migration and passes afterward.

## Limits and pending work

These tests validate the actual migrations and booking RPCs with minimal Supabase Auth/storage schema substitutes. Hosted HTTP, network failure, and load/throughput remain separate checks. Shared-space/resource relationships in the suite are fixtures; the actual venue inventory still needs business confirmation. Emails, launch approval, policies and tax remain pending.

## Hosted PostgreSQL verification

Completed successfully on 28 October 2026: all 14 checks passed, automatic database cleanup succeeded, and the application snapshot was unchanged. The earlier run also passed its checks; its pooler-related cleanup failure was resolved and its disposable database was removed.

`npm run test:hosted` runs the same 14 scenarios using multiple connections on the configured Supabase staging server (PostgreSQL 17.11). Each run creates a uniquely named `cc_reliability_<uuid>` database, applies the migrations and fixture-only approvals there, and compares ten booking RPC definitions byte-for-byte with the deployed application database. SHA-256 of the matched definitions: `67898a88c9d7f1b1ea23eed9f72bd3983c1161c73fc3de35a95b6c3df9ff1440`.

The app database is only read. Its settings, services, resources, policies, and user/booking/notification counts are compared before and after. Fixtures never enter the application database. No notification worker or email provider is invoked. Supabase's session pooler retains backend sessions, so cleanup disconnects sessions only in the test database using `DROP DATABASE ... WITH (FORCE)`. The temporary test database and its fixtures are disposable and removed after the run.

This verifies hosted database concurrency and deployed function parity. It does not exercise the live PostgREST HTTP endpoint or full Supabase Auth flows; the isolated database uses minimal auth/storage fixtures. It is an explicit staging operation, not part of routine CI, and requires the configured database owner to have database creation privileges.

## Live HTTP and authentication permissions

Completed on 28 October 2026 with `npm run test:hosted-http`: all 14 checks passed against the actual hosted Supabase Auth and PostgREST endpoints.

- Public catalog remains available while reservations are disabled.
- Anonymous users cannot read customer profiles or bookings.
- Customers see their own booking but cannot fetch another customer's known booking ID.
- Customer profiles are isolated.
- Customer role escalation and direct booking edits are denied.
- Customer calls to staff actions and internal expiry/allocation/notification functions are rejected.
- Customers cannot edit business configuration.
- Staff can read both fixture customer bookings but cannot assign administrator roles.
- An administrator can change another fixture account's role through the deployed RPC.
- Authenticated booking requests remain blocked by pending launch approval.

Four temporary users were created using the Auth admin API, which sends no invitation or verification email; actual password sign-ins supplied the test access tokens. Signup metadata containing an administrator role did not change the default customer role. Two explicitly cancelled fixture bookings tested real row-level isolation without allocating inventory. Exact run-owned account, booking and audit UUIDs were removed afterward. Settings, service/resource/policy documents, user and booking counts, and notification counts matched their pre-test snapshot. No real administrator account was changed and no email worker was invoked.

These checks validate live authentication, authorization and the launch gate. They do not simulate a live customer reservation through HTTP while business approval remains pending, and they do not test email delivery or password recovery.

Dependency installation also reported eight npm audit findings in existing app/build dependency families (TanStack Start, Vite/launch-editor and Zod); dependency remediation remains separate from this booking reliability change.
