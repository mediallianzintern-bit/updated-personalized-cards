# How card opens are tracked: reference findings

Research date: 20 October 2026. This is static analysis of public OVOU assets, not an inspection of their private backend.

## Evidence

- **E1:** Existing REA profile analysis `ev_14c660055240d858fbfba5511027b2a54e34020824daee23a2d83e56a1972ce5`, retained in `research/raw/rea-ovou-analysis.json`. Reused rather than rerun.
- **E3:** New REA MCP analysis of the directly referenced public `_app` bundle: `ev_1b304c3256d565cbad0cf905317eec2cfc4d4006e2062edd1ae6463d2b5be1b2`. Summary receipt `ev_922a4bd0a538785658f1697d5f41eab6e307eb9ca553e1b894c03a72aeae85e3` saved as `research/raw/rea-tracking-summary.json`.
- Source: `https://ovou.com/_next/static/chunks/pages/_app-410e20f8df468b88.js`, explicitly referenced by the retained profile HTML. Saved as `research/raw/ovou-app-tracking.js`, SHA-256 `bc737bd2204708c97040737ecf368a14484a561c92c732527a4986b5c41404d5`.
- E3 analyzed only this newly acquired file, recovered 779 modules, and reported zero parse failures. Application relationships are partial. Semantic extraction was deliberately bounded at 1,500 nodes and unknown records per file and reports truncation. None of the following claims implies exhaustive data flow or observed execution.

Offsets below are zero-based JavaScript string character offsets, not byte offsets. The retained bundle is minified; module IDs and offsets identify the supporting syntax.

## Findings

| Question | What the shipped code establishes | Evidence / limits |
| --- | --- | --- |
| What counts as an open? | Profile module 60110 schedules a React effect that calls `track(PROFILE_VIEW, {publicId: profile.public_id})` when profile data exists. Module 54160 wraps React `useEffect`. The public `_app` event map resolves `PROFILE_VIEW` to `profile-view`. | E1 profile offsets 130,146 and 106,375; E3 app offset 909,248. This is a page event. The code does not prove successful network delivery or how many opens the dashboard ultimately counts. |
| How is the event linked to a card? | The profile's `public_id` is supplied as `publicId`. Click events also supply `objectId` for individual links or social items. | E1 offsets 10,588, 22,406 and 130,146. The database schema is unknown. |
| Where is tracking routed? | Module 89331 reads a tracking context. The app provider supplies an adapter that fans track calls to Google and Segment adapters when its environment condition permits. The Segment adapter calls `tc.track(event, mappedProperties, options)`; the Google adapter calls `window.gtag` when available. | E3 offsets 1,490,948; 1,620,928; 1,622,152; 1,560,649. These are static call paths, not captured network requests. Active keys and account configuration were not inspected. |
| Can it distinguish QR, NFC and ordinary links? | The page adapter parses `utm_*` parameters and a list of advertising parameters from the URL into campaign data. `utm_campaign` is mapped to campaign name. | E3 offset approximately 1,620,300. Inference: separately tagged entry URLs can support source attribution. Neither examined asset proves direct physical QR-scan/NFC-tap sensing; an open with a copied tagged URL is indistinguishable by that tag alone. |
| Are repeated opens deduplicated? | Segment source middleware maintains a set keyed by event name plus a nonempty supplied `event_id`; repeated matching keys are dropped in that loaded app instance. The visible profile-view call supplies `publicId`, without `event_id`. | E3 around 1,620,000 and E1 130,146. This is not evidence of general unique-visitor or view deduplication. It is unknown whether another component adds an event ID. |
| Does it know who opened a card? | The Segment integration contains anonymous-ID and trait support. A profile open by itself supplies the card ID, not a visitor name, email or phone. | E3 around 1,619,237. Browser identifiers are not verified human identities. Contact details require a separate visitor action such as the observed exchange-contact form. |
| What other interactions are instrumented? | Link redirects, social redirects, show-more biography, video clicks, custom CTA clicks and opening the exchange-contact modal have event calls. | E1 offsets 8,687; 10,588; 22,406; 103,870; 130,007; 132,215. No submissions were performed. |

## Independent implementation guidance

The company software can implement the same understandable product model with its own backend: render a published card, send a `view` event containing the card ID and explicitly tagged entry source, and count accepted events in the dashboard. Keep QR and NFC entry URLs distinct if source totals are desired. Label these as visits attributed to a link source; a tag is not proof of a physical scan.

Choose and document the product's deduplication rule, for example one view per card per browser session, separately from total opens. Owner previews should not contribute. Track save-contact requests and link clicks separately; a downloaded contact file does not prove successful import into an address book. Capture visitor identity only when the visitor chooses to provide it in the contact exchange form.

Backend storage, private analytics calculations, geographic resolution, bot filtering, retention, account access and dashboard reporting remain unknown for OVOU. They must be independently implemented and tested here.

## Onboarding boundary

The requested onboarding design follows the user's screenshots/description: name, contact details, role/company, and photo, followed by brand colours/logo and completion. This is user-provided design direction. No private OVOU onboarding/account flow was entered, and no account or third-party form was submitted during this research. The implementation should use the requested steps with the project's own components and persistence.
