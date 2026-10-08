# Live website review — 3 October 2026

Reviewed https://reviewahouse.com as an anonymous buyer at 1280×800 and 375×667. Stripe excluded. No application code changed. Existing working-tree changes were preserved.

## Recommendation

Prioritize report accuracy and mobile completion before expanding acquisition or countries. Two current German listings generated plausible-looking reports containing material source-extraction errors. The same errors reproduced with the current local parser; these are not merely old saved reports.

## Real examples

| Source | Result |
| --- | --- |
| Ohne-Makler 496161: 62 m², 3 rooms, €192,700, Berlin Neu-Hohenschönhausen | Report https://reviewahouse.com/r/340db75fabe49533 generated. Price, area, rooms, floor and Hausgeld correct. Location became “den Verkäufer”; a 1987 building became “New build”; buyer costs became €192,700. |
| Ohne-Makler 471956: 30 m², 1 room, €172,000, Dörpfeldstraße 5 | Report https://reviewahouse.com/r/d3027860f829d3aa generated. Core price, area and street correct. Buyer costs became €172,000; narrative Hausgeld €197/month (2025) omitted. |
| Ohne-Makler 471417 and 487839 | Both rejected with unavailable/could-not-open message. Do not count withdrawn listings as product failures. |
| List.am 22791157 | English URL normalization worked; import was blocked by List.am, with explicit error and text/PDF/helper alternatives. No report created. |

Comparison created through the desktop UI: https://reviewahouse.com/c/eddfcf54e06642e2

## Priority findings

### P0 — Acquisition-cost extraction and consistency

496161 source states €14,543 acquisition costs and €207,242 total, but report displays €192,700 acquisition costs alongside €192,700 purchase price and €207,242 total. 471956 repeats the bug: €172,000 acquisition costs instead of source €13,105, total €185,104. Source totals differ from component sums by €1 due to portal rounding; this is distinct from the large extraction error.

`lib/listing-parser.ts:486` searches around a costs label and can select the preceding purchase price. `lib/finance.ts:5` accepts separately supplied costs and total without reconciling them. Enforce arithmetic consistency with rounding tolerance; flag conflicting evidence. Existing loan amounts use the stated total, so they are not doubled despite the wrong costs display.

### P0 — Source-page chrome contaminates facts; verification does not repair it

496161 report title and map query use “den Verkäufer”, not a location. The source identifies 13058 Berlin (Neu-Hohenschönhausen). Condition is “New build” despite source describing a maintained 1987 building with modernization potential. The saved API response has both aiFactChecked and aiLocationChecked true while retaining these errors. Source quality receives 9.3/10; overall verdict is “A strong overall proposition” at 7.71/10.

Scope parsing to the listing body and property fields, excluding navigation/contact widgets. Require evidence per critical field, reject non-address street candidates, and cross-check condition with year/source context. Rebuild affected cached reports after fixes. Relevant code: `lib/listing-parser.ts:294`, `:338`, `:474`, `:508`.

### P1 — Known monthly expense omitted

471956 says “Das Hausgeld betrug im Abrechnungsjahr 2025 rund 197 € pro Monat”. Report omits Hausgeld from facts, finance and comparison. Its €760 illustrative loan payment would be approximately €957 including that historically stated expense, subject to checking the current amount. Preserve the expense with its year rather than silently dropping it. Parser `lib/listing-parser.ts:484` handles narrow labels/adjacent numbers, missing natural-language descriptions.

### P1 — Mobile loses shortlist workflow

At 375px, the sidebar exists but is display:none; there is no visible alternative for history, pinning, selecting two reports, or creating another report from the report page. Desktop compare works. The existing comparison itself fits the small viewport without document overflow. Add a mobile drawer or explicit shortlist navigation. Relevant rule: `app/globals.css` media query max-width:800px.

### P1 — Network failures leave an indefinite loading message

In the review browser only, replaced the assessment fetch with an immediately rejected promise and submitted the normal German form. UI stayed at “Reading listing…” and logged an unhandled rejection. Navigating away restored the original browser state; no server fault was injected. `components/LandingPage.tsx:93` lacks catch/finally and a busy guard. Add error/retry state, timeout/abort, and duplicate-submit protection. The Armenia form already has better busy/error handling.

### P1 — Score precision exceeds the evidence

The inaccurate first report receives a strong recommendation. `lib/property-score.ts` uses fixed euro-per-square-metre bands without city/submarket comparables; its source score rewards field presence rather than verified accuracy. Treat this as a listing-fundamentals rubric, not market valuation. Show uncertainty/conflicts and withhold confident verdicts when critical fields fail validation.

## Secondary usability observations

- Comparison property headings are plain text; the available address links open maps. Provide an obvious link back to each full report.
- Armenia fallback asks for English listing details and suggests a Chrome helper even in a mobile viewport. Explain supported devices and make the most practical fallback prominent.
- Public landing/report pages contain unsold partner placeholder copy. Remove until there is useful content.
- Directly visiting the print URL defaults to 3.5% (€638 in the second report) while the live report used 4.56% (€760). The normal Print/PDF button correctly includes the current financing parameters; do not describe the normal button flow as broken. Align the direct-link fallback and its “current FMH” wording.

## Verification and boundaries

- npm test: 149 passed, zero failed.
- Current HTML downloaded from both active German source pages and compared with live reports. Current local parseListing reproduced their wrong costs/location/condition/omitted Hausgeld.
- Eight browser-origin report GET requests in two batches of four: all HTTP 200, 77–531ms including body reads. This is a small concurrency smoke check, not a capacity benchmark or concurrent AI-generation test.
- A separate Python urllib probe received 403 for all eight requests; browser-origin requests succeeded. Do not use that probe to claim a server outage.
- Desktop report creation and comparison, mobile layouts, blocked/withdrawn imports, a simulated network error, direct print content and Print/PDF URL propagation checked.
- Did not create an account, complete authentication/password recovery, upload a PDF, complete a native print dialog, or exercise paid plans. No sustained production load test performed.

## Suggested implementation order

1. Fix source extraction and add these two full-page source cases as regressions; validate price/cost arithmetic and location/condition contradictions.
2. Repair/regenerate affected cached reports and expose source evidence/uncertainty.
3. Restore mobile report history and comparison access.
4. Add reliable import failure recovery and duplicate-submit protection.
5. Improve blocked-portal fallbacks and recalibrate score presentation.
