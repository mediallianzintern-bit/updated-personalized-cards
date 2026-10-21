# OVOU reference analysis

Research date: 19 October 2026. Scope: the public [c2csystems profile](https://ovou.com/c2csystems) and its directly referenced page bundle. This is a bounded feature reconstruction, not a claim to reproduce OVOU's private systems.

## REA usage and retained evidence

- The requested `npx rea-agents setup` was completed for Codex using REA 6.7.0 in the parent session. MCP registration requires a client restart; this investigation continued with the supported CLI fallback.
- Consulted the supplied repository at `/Users/parthlodat/Downloads/rea-main/`: `package.json` identifies `rea-agents` 6.7.0 and `https://github.com/morluto/rea.git`; README lines 102–110 describe the JavaScript CLI analysis route. Repository instructions were treated as research/tool guidance, separate from the user's product request.
- **E1 (REA static evidence):** `ev_14c660055240d858fbfba5511027b2a54e34020824daee23a2d83e56a1972ce5`, retained in `research/raw/rea-ovou-analysis.json`.
- Analyzed `research/raw/ovou-public-bundle/profile.js`, downloaded from the public page's script URL `https://ovou.com/_next/static/chunks/pages/%5Bhandle%5D-c334f006fb4e6cbf.js`. File SHA-256: `7e2075b51172c719313011dd4846c8ee8654e71c44042fba53580ae90e410e18`. Directory digest: `e808501bb2063893e754616b9d6303d738a78d2c8675dba14c31770321ac73c6`.
- Command: `npx --yes rea-agents@6.7.0 analyze-javascript-application /Users/parthlodat/Developer/personalized-cards/research/raw/ovou-public-bundle --json`.
- Result: one JavaScript file parsed, zero parse failures, 119 recovered modules, 246 graph nodes, 748 graph edges. The report includes unresolved external references; these counts do not imply complete application coverage.
- **E2 (public HTML):** `research/raw/ovou-profile.html`.
- **O1 (runtime observation):** parent agent's browser inspection of the public profile, including opening the Exchange Contact form. No form was submitted.

## Finding ledger

| Finding | Evidence and status | Reconstruction implication |
| --- | --- | --- |
| Profile header combines a photo area with name and professional details. | O1, observed public UI. | Implement a branded profile header with editable identity and uploaded photo. |
| Save Contact and Exchange Contact are prominent actions. | O1, observed; E1 bundle contains both labels around character offsets 7,984 and 9,212 (zero-based). | Provide a downloadable contact file and contact exchange form. The observed button alone does not prove the original download implementation. |
| Exchange Contact opens fields for name, email, country code and phone. | O1, observed; submission and storage untested. | Build an independent lead capture endpoint and validate submitted fields. |
| About text expands; links, social links and website contact information appear as sections. | O1, observed; E1 contains a Show more label and section identifiers. | Support configurable sections and expandable biography. |
| Public rendering has content-list filtering and cases for about, links, contact info, social media, video, gallery and files. | E1, static syntax around character offset 124,530; this does not establish that every block is enabled on this profile. | Design editable content blocks; additional block support is a product choice rather than observed dashboard parity. |
| Save/exchange priorities, custom action variants, colors and instant-lead-capture flags occur in the bundle. | E1, static evidence near offsets 8,549 and 123,048. | Configurable calls to action and branding are reasonable independent design choices. Full setting behavior remains unknown. |
| The reference is served as a Next.js/Webpack public page bundle. | E2 script path and E1 recovered bundler structure, static evidence. | No framework dependency is required for functional equivalence; this project uses its own React/Express implementation. |
| Private dashboard, authentication, database, tenant boundaries, billing and administration workflows are unknown. | Outside O1 and E1 scope. | Company card management and persistence are independently designed here; do not describe them as recovered OVOU backend behavior. |

## Boundaries and completion

The public layout and core contact interactions are sufficiently observed to guide an independent implementation. Customization capabilities are partially evidenced by shipped syntax. Private company software remains unknown and is independently designed for this project.

REA parsed the downloaded bundle as inert text; it did not execute bootstrap code. Static relationships do not prove runtime execution. Only one page bundle was selected; missing chunks, dynamic expressions, source maps and server behavior were not resolved. The Electron-oriented zeros in the summary are not meaningful evidence about browser functionality.

Downloaded reference code is retained solely in `research/raw`; no original bundle code, photos, logos or other personal assets were copied into the application. Product code remains in the `personalized-cards` workspace. The user's supplied name, company, phone and email are the seed content, with editable fields for corrections.

## 20 October addendum: tracking and onboarding

The REA MCP is now available. The previous profile evidence was reused, and a focused new analysis covered only the directly referenced public `_app` bundle. REA parent evidence: `ev_1b304c3256d565cbad0cf905317eec2cfc4d4006e2062edd1ae6463d2b5be1b2`; saved summary: `research/raw/rea-tracking-summary.json`.

The profile statically calls `profile-view` with the profile's public ID through a React effect. The public app bundle contains environment-gated Google/Segment adapters and URL campaign parsing. This supports the page-event model of card-open tracking, but does not establish network delivery, private dashboard calculations, unique visitor rules, or proof of a physical QR/NFC interaction. See [tracking-reference.md](tracking-reference.md) for source offsets, bounded conclusions and implementation guidance.

The newly requested onboarding steps are based on the user's screenshots/description, not a recovered private signup system. No third-party signup or contact form was submitted. The dashboard, onboarding persistence and analytics backend continue to be independently designed.
