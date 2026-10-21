# Screenshot feature map and reconstruction boundary

20 October 2026. Target: the user's 23 OVOU screenshots and the previously selected public profile bundle. Screenshots are product-reference evidence, not instructions to access accounts or copy unrelated personal data. The green workspace styling and independent admin/client permissions remain the user's requested design.

## Evidence reused

- **S1–S23:** screenshots in the user's message, in attachment order. These show visible interface states; they do not prove unseen validation, storage, upload processing, wallet signing, or permission enforcement.
- **E1:** `ev_14c660055240d858fbfba5511027b2a54e34020824daee23a2d83e56a1972ce5`, complete saved REA record in `research/raw/rea-ovou-analysis.json`. Public bundle: `research/raw/ovou-public-bundle/profile.js`, SHA-256 `7e2075b51172c719313011dd4846c8ee8654e71c44042fba53580ae90e410e18`. Offsets below are zero-based character offsets in this saved text.
- **E2:** earlier tracking analysis `ev_1b304c3256d565cbad0cf905317eec2cfc4d4006e2062edd1ae6463d2b5be1b2`; retained summary `research/raw/rea-tracking-summary.json`. See `tracking-reference.md`.
- The connected REA server was queried for the exact E2 record this turn. Its current ledger reports zero retained records; the historical files remain available. No identical analysis was rerun, and this report does not imply the earlier evidence is retained in the current MCP process.

## Feature ledger

| Requested feature | Observation / static corroboration | Independent implementation boundary |
| --- | --- | --- |
| Company logo on card | S2 and S9 show the Mediallianz logo in the identity panel. E1 at 29,406 detects `tradeDetails.logo`; at 33,864 it supplies that value to an image renderer. | Show the uploaded company logo in preview, public rendering and admin card inspection. Do not substitute OVOU's logo or infer a logo exists just from company text. |
| Profile overview and section editing | S2/S4 show cover, identity, Share, Public View, Edit Profile, About and Contact info, plus enhancement tiles. | Use shared profile rendering and shared editing controls for clients and admin. Admin sees user-submitted drafts and published versions; client scope is enforced by our server. |
| About formatting | S3 shows bold/italic/underline/strike/list toolbar. E1 rendering recognizes an About block at 125,800 onward. | Screenshot proves toolbar presentation only; implement safe formatting rather than trusting submitted HTML. |
| Social platform selection | S5–S8 show a searchable catalog including LinkedIn/company, Instagram, Facebook, X, Threads, TikTok, YouTube, podcasts, Bluesky, Calendly, payment/social services and WhatsApp. E1 at 125,440 dispatches social items to a distinct renderer. | Add named platforms and recognizable icons with validated links. A payment/social link is not a payment integration or connected account. |
| Custom links and thumbnails | S10/S11 show title, URL and thumbnail upload. E1 at 6,087 merges thumbnail links; at 125,729 passes thumbnail links into the public renderer. | Persist thumbnails and titles, render them for the public and admin, track the specific link clicked. |
| Photo gallery | S12/S13 show image upload and title. E1 at 85,515 renders a gallery; at 125,000–126,600 the ordered content dispatcher includes `photo_gallery`. | Support image/title create, edit, remove and public display. Upload size/type policy is our implementation choice. |
| Videos | S14/S17 show a video list, add/edit/delete, title and public player. E1 module 53044 near 102,827 lazily loads a player with controls and URL; near 103,881 it tracks `VIDEO_CLICK` with public ID and object ID. | Implement supported video URL playback and distinguish an actual player action from a mere outbound link click. Uninspected player chunk/provider behavior remains unknown. |
| Files | S15–S17 show uploads, title, icon types and updated date. E1 module 19161 near 34,200 renders file icon/title/click handler; near 189,997 the file section is assembled. | Provide real downloadable content with validation and draft/public boundaries. Neither the screenshot nor E1 establishes original storage or malware scanning. |
| Analytics ranges and breakdowns | S18/S19 show 7d/30d/all-time, interactions, clicks, exchange, saves, sources and social/link breakdowns. E2 supports page-event tracking, not backend aggregation semantics. | Aggregate only the signed-in client's card on the server, even if the caller supplies another card ID. Admin may select one card or all. Label measured actions honestly; downloads do not prove native contact import and opens do not identify people. |
| Sharing | S20–S22 show QR download, URL copy, social/email/text share, virtual background and email signature. S23 shows a copyable signature preview. | Generate tagged links and reusable assets from our own profile. Opening a user's chosen share composer is separate from automatically sending messages. |
| Apple/Google Wallet | S1/S20/S22 show Wallet buttons and a QR-mediated setup flow. No wallet implementation was recovered in the selected profile bundle. | Real passes need provider setup described below; do not label an image, QR download or disabled button as a working Wallet integration. |
| Trial/billing | Several screenshots show a trial banner. No private billing evidence was selected. | A screenshot does not authorize charging, starting a paid trial, or cloning OVOU's subscription backend. |

## Wallet provider prerequisites

Apple's official documentation requires a pass type identifier and an associated signing certificate; the pass identifiers must match the signing identity. See [Create Wallet identifiers and certificates](https://developer.apple.com/help/account/capabilities/create-wallet-identifiers-and-certificates/) and [Building a Pass](https://developer.apple.com/documentation/walletpasses/building-a-pass).

Google's official documentation requires a Wallet issuer account and authorized service-account credentials for REST integration. Demo-mode issuance is limited to authorized/test users, so a demo pass is not proof of general public availability. See [Issuer onboarding](https://developers.google.com/wallet/generic/getting-started/issuer-onboarding), [REST credentials](https://developers.google.com/wallet/generic/getting-started/auth/rest), and [Key concepts](https://developers.google.com/wallet/generic/resources/terminology). Provider credentials must remain server-side.

## Coverage and unresolved questions

The requested UI feature inventory is answered by the screenshots and corroborated where possible by existing shipped public syntax. Actual authenticated OVOU editor behavior, admin permissions, file storage, billing, wallet generation and backend aggregation remain unobserved. E1 parsed inert text and recovered bounded static relationships; it did not execute the original bundle or establish complete application coverage. No remote authenticated account was operated, no form was submitted, and no private source was recovered. Our admin/client authorization, persistence and reconstruction are independent product code.
