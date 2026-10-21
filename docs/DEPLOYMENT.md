# Supabase + Vercel deployment

The repository contains a Vercel API entry point, frontend routing, Supabase Postgres persistence, private Storage uploads, and an existing-data import tool. No cloud project has been created or deployed yet. Run staging UAT before inviting clients.

## 1. Create Supabase

Create a project at https://supabase.com/dashboard. Save its database password in your password manager. Open SQL Editor and run `supabase/migrations/001_workspace.sql` once. It creates a private workspace table and private `card-media` bucket. Re-running does not erase data.

Copy these values into a local `.env` (copy `.env.example` first):

| Variable | Where to find it / value |
| --- | --- |
| DATABASE_URL | Supabase **Connect → Transaction pooler** connection URI, port 6543. Substitute the database password, URL-encoding special characters. Keep `sslmode=require`. |
| SUPABASE_URL | Project URL, `https://PROJECT_REF.supabase.co` |
| SUPABASE_SECRET_KEY | Server-only Supabase secret key (legacy service_role key also supported) |
| ADMIN_PASSWORD | A unique random password of at least 16 characters |
| PUBLIC_URL | Your final HTTPS Vercel URL or custom domain; no trailing slash |

Never prefix secrets with `VITE_`. Do not commit `.env` or `data/`.

Run with Node 22:

```sh
npm ci
npm run cloud:check
```

This checks database and bucket access without modifying cards. A real cloud project and credentials are required.

## 2. Import your existing cards

Make a secure backup of `data/database.json`. Then, from the project folder:

```sh
npm run cloud:import -- /Users/parthlodat/Developer/personalized-cards/data/database.json
```

This imports cards, clients, contacts and analytics, uploads embedded images/documents into private Storage, and preserves existing password hashes. It deliberately drops local sessions. It refuses to overwrite a cloud workspace with existing cards/accounts. Local data is unchanged. If you want a fresh workspace, skip import and create cards after deployment.

## 3. Create a private GitHub repository

Create `personalized-cards`, then commit this project and push. Review staged files before committing. `.gitignore` excludes local data, environment files, dependencies, builds and Vercel metadata. Include `package-lock.json`, `api/`, `server/`, `supabase/`, `src/`, `public/`, and `vercel.json`.

## 4. Import into Vercel

Visit https://vercel.com/new and import the private repository.

- Root directory: folder containing package.json
- Framework: Vite
- Node.js: 22.x
- Install command: `npm ci`
- Build command: `npm run build`
- Output: `dist`

The checked-in `vercel.json` routes `/api/*` into the Express function and client routes into the SPA. Do not remove its API rewrite or deploy just `dist` as a standalone static site.

Add all five cloud variables above in **Settings → Environment Variables** for the intended deployment environment. Do not set HOST, PORT or DATA_DIR for Vercel. Redeploy after changing variables. For a first deployment, use your intended Vercel project URL for PUBLIC_URL and then update if Vercel assigns a different URL.

Use a separate Supabase project for staging/Preview so tests cannot change production clients. Preview deployments require their own environment variables. Keep Vercel Preview protection enabled for staff testing; when testing QR links from another device, that device must also have access.

## 5. Staging UAT

Replace BASE with the deployed HTTPS origin:

- BASE/admin — sign in using ADMIN_PASSWORD
- BASE/create — create a client account and card
- BASE/login — client sign-in
- BASE/my-card — client editor and own insights
- BASE/c/pritesh-patel — only if you imported the founder card

Test two distinct client accounts. Verify neither can access the other's card, contacts or analytics, including by changing URLs. Test image/logo/gallery/document uploads, save draft, publish/unpublish, QR on a phone, contact exchange, downloads, and admin deletion of a disposable test card. Reload and sign in after a redeployment to check persistence. Check Vercel function logs for errors.

Only after staging UAT passes, configure production variables, deploy the reviewed code, add your domain in Vercel Settings → Domains, apply the DNS records Vercel supplies, and update PUBLIC_URL/redeploy.

## Architecture and operational limits

- Existing scrypt password authentication is retained; this is not Supabase Auth. Sessions are stored as token hashes in Postgres, with 12-hour expiry and logout revocation. Email verification and self-service password recovery are not implemented.
- Client ownership and administrator authorization are enforced by the API. The private database schema has RLS enabled, no browser policies, and revoked anon/authenticated access. Only the server database connection reads it.
- A transaction locks the workspace row while each API request executes. Writes commit before success is sent, avoiding lost updates across Vercel instances. The JSONB workspace preserves compatibility with the existing 200-card application. This is intended for a small company workspace, not a high-throughput multi-tenant service. Larger workloads need normalized tables and narrower locks.
- Rate limits are persisted across function instances. Media uploads are direct to Storage using signed upload URLs so whole profiles do not carry large base64 payloads through Vercel. The private bucket caps each object at 3 MB; document UI caps at 2 MB.
- Draft media is accessible only to the owning client or admin after it is saved. Public media is served only while referenced by a published card. A previously issued signed download remains valid for up to 60 seconds after unpublish/delete.
- Card deletion revokes application access to its media but does not immediately erase Storage objects. Failed/abandoned uploads can leave orphan objects. Review Storage usage and clean up unreferenced objects with a maintenance process before operating at scale.
- Database backups contain personal data and password hashes: restrict access and enable a backup policy appropriate to your Supabase plan. Storage objects need their own backup plan.
- Apple/Google Wallet passes and subscriptions remain separate integrations; no working wallet issuance or billing is claimed.
