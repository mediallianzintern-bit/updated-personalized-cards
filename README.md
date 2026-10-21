# Mediallianz Cards

Working digital business card software for Mediallianz, implemented in this repository. React frontend, Express backend, persistent disk storage. Inspired by the supplied OVOU public profile; independently implemented company dashboard and backend.

## Run locally

Requires Node.js 22.19+ and npm.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:3000**. Founder card: **http://127.0.0.1:3000/c/pritesh-patel**.

Local mode only accepts loopback requests and local hostnames. It intentionally lets you use the workspace without a password on this computer. Set `ADMIN_PASSWORD` to enable authentication during development as well.

## Included

- Company card studio and multiple team cards (up to 200).
- Editable identity, title, company, phone, email, website, location and biography.
- Photo, logo and cover image uploads: PNG, JPEG or WebP, max 2 MB each.
- Three layouts, custom colours, typography and corner styles.
- Reorder and show/hide sections, edit/reorder links, add social accounts.
- Separate server-persisted drafts and published versions, with an option to take a card offline.
- Public card routes, vCard contact downloads, and consent-based contact exchange.
- QR PNG download, share links, and stable URLs suitable for NFC tags.
- Company contacts inbox with search, card filters and CSV export.
- Activity counts from real public-card events, with a 14-day chart and 30-day totals.
- Password-protected production admin, httpOnly sessions, request validation, origin checks and rate limits.
- Workspace backup download.

The initial profile uses the supplied name **Dr. Prtiesh Patel**, website **mediallianz.com**, phone **+91 9892906989**, and email **ppatel@mediallainz.com**. The spelling difference between website and email is preserved intentionally. No portrait/logo was supplied; initials are shown until an image is uploaded. The introductory bio is editable starter copy.

## Use the workspace

1. Edit **Card studio → Content**. Changes appear immediately in the preview.
2. **Design** controls layout, palettes, images and section order.
3. **Save draft** persists your changes without changing the public card.
4. **Publish changes** saves and publishes the current card.
5. Use **Share card** to open the published version or download its QR.
6. **Team cards → Create card** adds a colleague. New cards remain unpublished until you publish them.
7. Visitors can download a contact or exchange details. Submitted details appear in **Contacts**, and CSV export includes the card attribution.

Local QR codes point at this computer. They will not work from another phone. Deploy and configure `PUBLIC_URL` before distributing links, printing QR codes or programming NFC cards. Changing a slug invalidates the old URL and its QR code.

## Production deployment on a persistent Node host

For Supabase + Vercel, use [the cloud deployment guide](docs/DEPLOYMENT.md). The following alternative runs the local storage backend on a host with a **persistent writable disk**, a single application process, and an HTTPS reverse proxy. Do not upload only `dist/` or deploy to an ephemeral serverless filesystem.

```sh
npm ci
npm run build
# Set ADMIN_PASSWORD, PUBLIC_URL, HOST, PORT and DATA_DIR in your host's secret/environment settings.
npm start
```

- `ADMIN_PASSWORD`: required in production, at least 12 characters; use a unique secret.
- `PUBLIC_URL`: the full public HTTPS address, e.g. `https://cards.yourcompany.com`.
- `HOST`: defaults to `127.0.0.1`; use `0.0.0.0` only when required by a hosting platform or container.
- `PORT`: defaults to `3000`.
- `DATA_DIR`: durable data directory; defaults to `./data`.

`.env.example` documents the settings. This application does not automatically load `.env`; configure environment variables in the host or use Node's supported environment-file mechanism. Never commit secrets.

Production uses secure cookies and must be served over HTTPS to sign in. Sessions last 12 hours and persist across server restarts. Changing the admin password requires restarting the process. A separate employee login, enterprise SSO, email delivery, billing, automatic domain provisioning and NFC hardware fulfilment are not implemented. This is a single-company workspace with one administrator role, not a multi-tenant SaaS platform.

The local backend stores cards, base64 images, contacts, and bounded event history in `data/database.json`, using atomic replacement and a private file mode. Run **one process** against this directory. The store is appropriate for an initial company installation; migrate to a transactional database/object storage before large-scale or multi-instance operation. Analytics are event counts, not deduplicated users. The last 50,000 events are retained, so high-volume history may be incomplete. IP addresses are used transiently for rate limiting and are not saved with events.

## Backup and restore

Use **Settings → Download backup** or back up the persistent data directory. Backups contain contact information; store them privately. To restore: stop the server, copy the backup to `$DATA_DIR/database.json` (or `./data/database.json`), preserve a backup of the previous file, then restart. Never edit the live data file while the server is running; it maintains an in-memory snapshot.

## NFC cards

Use a standard NFC tag writer to store the published **HTTPS card URL** as a URL record. The software does not write NFC hardware directly. Keeping the URL unchanged allows future profile edits without reprogramming the physical card.

## Verification

```sh
npm test
npm run build
```

Integration tests use disposable temporary data directories and loopback servers. They cover draft/publish isolation, durable data, team cards and URL collisions, validated contact exchange, disabled-action enforcement, safe vCard/CSV output, protected admin routes, logout, cross-origin writes, host checks and real event counts.

## REA investigation

The requested REA setup completed for Codex using `rea-agents` 6.7.0. Codex must reconnect/restart before its new MCP tools appear; this build used the supported CLI fallback without interrupting work. The shared `/Users/parthlodat/Downloads/rea-main` repository was consulted, and REA analyzed the public reference bundle. See [the evidence ledger](docs/reference-analysis.md). Raw reference artifacts stay under ignored `research/raw/`; application code does not import or copy them.

This project recreates the public card's core behaviors and adds an independent company workspace. It does not claim access to OVOU's private backend or complete enterprise feature parity.

### Guided card setup and activity
Open `/create` or use Team cards → Create card for the four-step builder (name, contact, company, photo), followed by logo and palette customization. Guided setup in the studio applies the Signature layout to an existing card. Save creates a draft; Publish changes makes it public.

Share provides distinct `?via=qr`, `?via=nfc`, and `?via=link` URLs. The QR image always encodes the QR-tagged URL. Write the NFC-tagged URL to your physical NFC card. The browser sends a view event after the published profile loads. The server records card, timestamp, source, and approximate device category. Insights refreshes every 15 seconds and supports per-card filtering.

These are event counts, not unique visitors or hardware scan counts. Forwarded tagged links retain attribution. Ad blockers and connection failures can prevent events. A contact download means the vCard endpoint served a file, not that the visitor imported it. Identical event IDs are deduplicated; separate page opens count separately. The app does not store visitor IP addresses or persistent visitor IDs. Visitor identities come only from voluntarily submitted Exchange Contact forms. Production hosting/proxy logging should be configured separately.

See `docs/tracking-reference.md` for the observed OVOU public JavaScript evidence and the limits of that evidence.

### Client onboarding and the green card studio
- `/` and `/create`: client onboarding with the reference-style live preview, followed by account creation.
- `/login`: client sign-in; `/my-card`: the client's green studio with the same Content, Design and Sharing editor used by the admin.
- `/admin`: the original company dashboard, with editing access to every card.

Clients have separate accounts and access only their own card, activity and submitted contacts. Passwords use salted scrypt hashes; sessions use HttpOnly cookies and expire after 12 hours (sessions survive server restarts). Registration saves a private draft; the client explicitly publishes it. Advanced editing remains available after onboarding. Account email remains the original registration email even if the public contact email is edited. Email verification and password reset delivery are not configured yet. Public deployment still requires HTTPS and an administrator password.

### Client profile features (20 October 2026)

The shared client/admin editor now supports company logos, cover/profile images, formatted biographies (bold, italic, underline, strike and bullets), 32 social platform choices, link thumbnails, photo galleries, linked videos, and downloadable documents. Galleries, videos and files can be reordered or hidden in Design. Images/documents are limited to 2 MB each; the total save request is limited to 12 MB. Videos use YouTube/Vimeo embeds or direct MP4 links, not video uploads.

Admin → All cards lists client-submitted and admin-created cards with company logos, search, ownership filters, saved-draft/published previews and editing. Refresh cards retrieves new submissions. Client → Activity uses server-authenticated card scope; query parameters cannot select another client's analytics. Both analytics views support 7 days, 30 days and all retained activity, with source, social, link and media click breakdowns.

Share includes QR download, message composers, an HTML email signature and a 1920×1080 virtual background. Remote logo images may need CORS permission for canvas exports; uploaded images work locally. Apple/Google Wallet issuance is not connected: issuer credentials and pass signing are still required. No trial/billing system is implemented. Reference behavior and evidence are documented in `docs/reference-feature-map.md`.

Local routes: `/admin` (company administrator), `/create` (client onboarding), `/login` (client login), `/my-card` (client editor/connections/activity), `/c/pritesh-patel` (founder public card). These localhost URLs work only on this computer until deployed.

## Supabase and Vercel deployment

Cloud backend support is now included. Follow [the deployment guide](docs/DEPLOYMENT.md) for SQL setup, environment variables, existing-card import, Vercel configuration and staging UAT. The default `npm run dev` still uses the local JSON store; Vercel's `api/index.js` uses Postgres and private Supabase Storage. No cloud services are provisioned automatically.
