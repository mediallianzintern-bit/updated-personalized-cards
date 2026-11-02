# Credential rotation and security deployment

Prepared 2 November 2026. **Provider credentials have not been rotated by this code change.** Never paste the old or new values into this document, Git, screenshots or support chat.

## Why rotation is needed

An administrator password, database password and Supabase server secret appeared in earlier support messages or screenshots. This is a precaution following that exposure, not evidence of misuse. A public Supabase project URL and publishable key are intended for public use and do not need replacing solely because they were shared. Server secrets are different: they carry privileged access. [Supabase API key guidance](https://supabase.com/docs/guides/getting-started/api-keys).

Changing a local `.env` file alone does not invalidate a provider credential or update Vercel. Existing deployments retain their environment configuration until replaced. [Vercel environment variable documentation](https://vercel.com/docs/environment-variables).

## Before starting

- Have the Supabase project and the Vercel project `updated-personalized-cards` open with administrator access. Confirm the project connected to `cards.mediallianz.com`.
- Identify every application/deployment using these credentials, including preview deployments and local scripts. Confirm a recoverable database/Storage backup and arrange a short maintenance window for the database password cutover.
- Store fresh random credentials in your password manager. Use a unique administrator password of at least 24 random characters. Browser credential entry/confirmation/submission must be completed by the account holder.
- Do not rotate a global JWT signing secret or publishable key as a substitute for replacing the exposed `sb_secret_…` server key.

## Ordered cutover

1. Deploy the tested security patch. It requires sign-in for uploads, verifies file type/size, binds media to an owner, filters public profile data and binds admin sessions to the configured password. Old-format admin sessions will need to sign in again; card data and client passwords are unchanged.
2. In Supabase **Settings → API Keys**, create a replacement server secret key with equivalent access. Keep the old key only for the brief transition; do not publish either value.
3. Update Vercel **Settings → Environment Variables → `SUPABASE_SECRET_KEY`** in every intended environment, and the ignored local `.env`. Replace `ADMIN_PASSWORD` there with the fresh password. Never use frontend-prefixed variables for either secret.
4. Redeploy, verify public profile/images and administrator login, then revoke the old Supabase server key. Retire or restrict old deployment URLs; they must not remain accessible using exposed admin credentials.
5. For the database, use Supabase **Database → Settings → Reset database password**. This affects other clients using that database role. Immediately update the password portion of `DATABASE_URL` in Vercel and local `.env`, preserving its host, port, user, database `postgres` and TLS settings. URL-encode special characters in the password. Redeploy/reconnect all consumers. A brief interruption is possible; do not promise a zero-downtime password reset.
6. With the updated local `.env`, run `npm run cloud:check` to verify database and private bucket access without printing credentials.
7. Revoke existing workspace sessions with the command below. This signs out card owners/admins but does not delete their accounts, cards or contacts. Require new sign-ins and verify the old admin password is rejected once without logging it.
8. Verify that old database credentials and the revoked server key no longer work, using a controlled test that does not log values. Remove obsolete deployments/configuration and review access logs for unexpected use.

```sh
cd /Users/parthlodat/Developer/personalized-cards
node --env-file=.env scripts/revoke-sessions.js --confirm
```

Do not roll back to leaked credentials if deployment fails. Repair forward with the new credentials, or create another fresh replacement. Ensure any code rollback is deployed with the new environment values.

## Post-deployment checks

- Public card, profile image, logo and visible media load; hidden sections and follow-up settings are absent from public JSON and media access.
- Anonymous `POST /api/media/upload` returns 401. A signed-in owner can upload, verify, save and publish a valid file. Another owner cannot attach its private reference.
- Signup creates the account before uploads; a failed upload leaves the account available and selected media in the editor for retry.
- A new admin login succeeds; old sessions and the previous admin password fail. Existing users sign in with their own unchanged passwords after session revocation.
- `npm test`, `npm run build` and `npm audit` pass. Monitor errors and upload failures after release.

## Remaining upload limitations

File signature/size checking is not antivirus scanning or image re-encoding. Existing stored files are grandfathered on their original card and are not retroactively scanned. Automatic orphan cleanup, metadata stripping and document malware scanning remain follow-up work. New owner quotas are 80 upload grants/hour and 250 tracked assets per owner; support cleanup is needed if the total is reached. Already issued download URLs can remain usable for up to 60 seconds after visibility changes.
