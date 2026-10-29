# Staging deployment checkpoint — 29 October 2026

## Deployment security fix

The initial GitHub deployment was blocked by Vercel because the previous lockfile resolved `@tanstack/start-server-core@1.169.17`, affected by CVE-2026-102989 / [GHSA-qx66-fv34-fjm8](https://github.com/TanStack/router/security/advisories/GHSA-qx66-fv34-fjm8). Updated TanStack Start to `1.169.4`, React Router to `1.170.46`, and Router Plugin to `1.168.48`; both npm and Bun lockfiles now resolve server core to `1.169.45` (patched minimum: `1.169.39`). The root error component now uses the framework's `ErrorComponentProps` type.

Verification: TypeScript, 18 database/unit tests, all five browser scenarios, lint (six existing Fast Refresh warnings), npm lockfile dry run, and the Node 24 Vercel build pass. No security-bypass environment variable is needed. Redeploy the new commit rather than retrying the old vulnerable commit.

The source is now published at `https://github.com/digitaglobal/Creative_Collective` on `main`; the owner connected that repository to Vercel manually. The account-connection section below records the earlier preparation checkpoint.

The latest source builds successfully for Vercel with Node 24:

```powershell
$env:NITRO_PRESET='vercel'
npm run build
```

The generated `.vercel/output` contains the server function and static assets. Do not deploy client assets alone.

## Remaining account connection

Vercel CLI 65.7.0 reports logged out. This checkout has no `.vercel/project.json` and no Git remote. The Vercel plugin was offered as the recommended account connection; it is not yet confirmed connected. No deployment or Git push was performed at this checkpoint.

After connecting Vercel, inspect the existing Creative-Collective project and its linked repository/team before linking the checkout or deploying. Use its existing staging/preview workflow. Do not invent a repository URL, create a duplicate project, rewrite published Git history, or upload `.env.local`.

Only supply the public frontend environment values to the website: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_DEMO_MODE=false`. The database and service-role secrets are unnecessary for this website and must not be uploaded as deployment environment variables.

## Verification after deployment

- Record the resulting preview URL and confirm the deployment is Ready.
- Check the home page, both venue catalogs, pricing, Enigma hours, Help and policies.
- Verify login and account/admin route protection. The owner enters their own password.
- Confirm the hosted backend still has launch approval and online payments disabled and tax unset.
- Configure the exact staging Auth redirect URLs when the stable staging hostname is known; email provisioning/delivery remains deferred.

The account, business-configuration and notification state must remain pending as agreed. Existing reservation expiry scheduling remains active.
