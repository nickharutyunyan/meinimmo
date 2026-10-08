# List.am automated retrieval investigation

Tested 22 September 2026 against `https://www.list.am/en/item/22791157`.

## Observed results

| Method | Result |
| --- | --- |
| Existing direct server fetch | Access blocked; no listing returned |
| Ordinary desktop browser, prior task | Listing visible; confirmed USD 72,500, 2 rooms, 42 m² building, 226 m² plot |
| Cloudflare Browser Run via isolated remote binding | Waiting 10 seconds for `#pcontent` timed out. A diagnostic render returned a document titled “Just a moment...” with a security challenge, not property content |
| Jina Reader, uncached request respecting robots.txt | HTTP 200 envelope, but document contained only “Performing security verification” and no property facts |

An HTTP 200 from a rendering/reader service is not proof of a successful import. Validate listing identity, asking price, currency, sale category and property details before generating a report. Do not substitute a manually pasted historical report for a fresh URL import.

## Product implications

Automatic English URL conversion is implemented. Retrieval authorization remains unresolved. Merely adding a headless browser does not fix this tested listing. No failed provider has been added to the production request path, no paid provider was purchased, and the isolated test server was stopped.

List.am's published terms explicitly restrict automated access and commercial reuse. A public, no-install URL-only product should seek approved access, allowlisting, or an authorized listing-data agreement. No public official property-read API was verified during this investigation. Do not assume such an API exists or that a generic scraper vendor has List.am permission.

The user subsequently selected a one-time browser helper. A scoped Manifest V3 prototype is now implemented in `extensions/reviewahouse`, with a website bridge and setup page at `/am/browser-helper`. It only reads a public listing after a trusted form submission, normalizes to English, excludes map ads/history/calculators, and submits untrusted text to the existing deterministic validator. Browser provenance is labelled separately. No cookies/history/debugger permissions are requested. Chrome's protected extensions page is blocked to agent browser controls, so the user installed it themselves and confirmed installation. Source-use permission remains separate from technical access.

## Browser-helper live verification, 22 September 2026

- Deployed website version: `c256b61a-8ecf-4d22-9a87-00832910bf36`.
- Local unpacked Chrome extension: version `0.1.0`.
- Opened production `/am`: visible “Browser helper connected”.
- Entered original `https://www.list.am/item/22791157?ld_src=2` and clicked Create report. No manual text copying or direct API test substituted for the UI workflow.
- Website normalized to the English URL; helper read the ordinary browser page; a new saved report appeared at https://reviewahouse.com/r/09d5c8ce557a6c8f.
- Verified title/address, USD 72,500 asking price, AMD 26,350,850 at CBA 363.46, 2 rooms, 42 m² house, 226 m² plot, Stone, Cosmetic, Finished, Nubarashen. Source says “Based on browser-provided listing text”.
- 149 automated tests passed, plus TypeScript and production build. New tests cover host/sender/gesture restrictions, extraction boundaries, rental/challenge rejection and temporary-tab cleanup.
- This verifies the selected house listing, not universal compatibility with every List.am layout or browser. Desktop Chrome installation is still required. Armenian prose is not fully translated by this deterministic parser; it must not be presented as a complete multilingual fact review.

## Next integration, once approved

Keep one user-facing URL field. Normalize to the English listing ID, retrieve through the approved source, validate the same listing ID and current price, then use the deterministic parser. Use a short, timestamped source cache, deduplicate concurrent requests, bound retries/timeouts, and retain explicit retrieval provenance. A provider must pass live URL-only tests on houses, apartments and land before launch.

Sources:

- https://www.list.am/help/14
- https://developers.cloudflare.com/browser-run/quick-actions/content-endpoint/
- https://developers.cloudflare.com/browser-run/get-started/
- https://developers.cloudflare.com/browser-run/pricing/
- https://jina.ai/reader/
