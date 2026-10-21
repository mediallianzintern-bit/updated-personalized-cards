# Verification — 19 October 2026

## Automated checks

`npm test`: eight passing Node integration tests, using isolated temporary stores and HTTP servers. Coverage: draft/published isolation; persistence across store reload; unpublished team cards; unique URLs; consent and email validation; CSV formula-injection escaping; disabled-action enforcement; profile and URL validation; private admin access; login/logout and secure cookies; cross-origin and Host checks; public activity counts; vCard escaping.

`npm run build`: production bundle built successfully with Vite.

Direct HTTP checks: workspace returns 200; `/data/database.json`, equivalent `/@fs/…/data/database.json`, and `research/raw` evidence return 403 through the development server.

## Browser checks

Used a disposable workspace on port 3001, separate from the user's main data on port 3000.

- Created a team member through Team cards and verified the resulting editable draft.
- Edited a title and URL, published, and opened the correct public profile.
- Opened Exchange Contact, submitted a synthetic consented visitor, and verified the success screen.
- Verified that contact in the inbox with its team-card attribution.
- Verified one public view and one connection in Insights.
- Took the team card offline using the confirmation dialog.
- Changed the founder palette, saved the draft, published and restored the original palette.
- Opened sharing and verified QR rendering, profile identity and the local-only link notice.
- Downloaded the founder's `.vcf` through Save Contact and inspected the file's contact fields.
- Visually inspected the workspace at desktop size and the public founder card/editor at 390 px; no horizontal overflow at that width.
- Browser console showed no application errors during the checked interactions.

The synthetic team card and contact exist only in `/tmp/mediallianz-browser-qa`. Main workspace retains the founder card and no test contacts. Screenshots: `founder-card-mobile.jpg` and `workspace-desktop.jpg`.

## Limits

No public hosting/domain was configured. Local QR links cannot be used from another device. No physical NFC hardware or native Contacts import was exercised; a valid vCard download was verified. Portrait/logo upload controls are implemented, but no user portrait or official logo was supplied. Authentication and secure cookies were covered at HTTP level; production HTTPS deployment and real-host sign-in remain deployment checks. The original private OVOU dashboard/backend were not accessible and are not claimed to have been replicated.

## 20 October: guided setup and tracking
- All 10 integration tests pass, including tagged events, delivery-ID deduplication, card filtering, contact-download counting, and atomic full-profile creation.
- Browser verified all four wizard steps plus branding and successful saved draft in isolated DATA_DIR /tmp/mediallianz-wizard-qa (port 3001).
- Browser opened published founder card with via=qr. Insights changed from zero to one open, displayed QR link, server time and desktop category. Editor preview did not add opens.
- Screenshot: tracking-dashboard.png. Company workspace data was not used for these tests.
- Production bundle compiled successfully. Responsive CSS supplied; this turn's browser verification was desktop only.

## Client flow correction
- Retained the original green admin dashboard at /admin.
- Root onboarding now leads to a client account and the green client card studio, reusing the admin Editor component for Content, Design and Sharing.
- Client login and Design controls visually verified in an isolated QA workspace. Screenshot: client-studio.png.
- All 11 tests pass, including separate-account access, admin access rejection, edits, publish/unpublish, source counts and logout/login.
- Original company cards remain untouched. Email verification/recovery still require integration before customer launch.
