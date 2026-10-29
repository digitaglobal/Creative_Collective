# Creative Collective

Booking and operations platform for Enigma and Studio D, built with React, TanStack Start, Supabase and Resend.

The first release supports staff-approved pay-in-person reservations. Online payments remain disabled until a provider is selected and integrated.

## Development

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run test:reliability
npm run test:e2e
npm run build
```

Copy `.env.example` to `.env.local` and configure Supabase. Apply the versioned migrations before enabling the live catalog. Production booking starts disabled until business configuration is approved.

See [setup, launch dependencies and staff operations](docs/OPERATIONS.md).

`test:reliability` starts an isolated local PostgreSQL server and exercises real concurrent connections. It does not load hosted credentials or modify business configuration. See [reliability results](docs/BOOKING-RELIABILITY.md).

`npm run test:hosted` explicitly loads `.env.local` and creates a disposable database on the configured staging Supabase server. It requires database creation permissions, verifies deployed RPC definitions match the migrations, runs concurrent checks, removes its test database, and checks that application data/configuration remain unchanged. Do not add it to routine CI or run it against an unapproved project.

`npm run test:hosted-http` tests the staging Supabase Auth and PostgREST endpoints with temporary accounts and cancelled fixture bookings. It sends no emails, leaves business approvals pending, removes the exact fixture records afterward, and verifies the original application snapshot is restored. This is an explicit hosted operation, not routine CI.

The repository remains connected to [Lovable](https://lovable.dev/projects/bed65a44-7c49-4bf5-abd2-4c0d5c72a91f). Preserve published Git history and keep changes in a working state.
