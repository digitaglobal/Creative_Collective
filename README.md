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
npm run test:e2e
npm run build
```

Copy `.env.example` to `.env.local` and configure Supabase. Apply the versioned migrations before enabling the live catalog. Production booking starts disabled until business configuration is approved.

See [setup, launch dependencies and staff operations](docs/OPERATIONS.md).

The repository remains connected to [Lovable](https://lovable.dev/projects/bed65a44-7c49-4bf5-abd2-4c0d5c72a91f). Preserve published Git history and keep changes in a working state.
