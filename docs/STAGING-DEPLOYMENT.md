# Staging deployment checkpoint — 29 October 2026

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
