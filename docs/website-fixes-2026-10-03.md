# Website repairs and verification — 3 October 2026

Deployed to https://reviewahouse.com after backing up the report database and applying additive migration `0003_report_sources.sql`. Stripe setup was outside this review. Existing Armenia/Jev work and the user's document were preserved.

Final Cloudflare version: `5d0c2b4c-2fd7-43f5-bccc-dbde840b42d1`; extraction version `2026100304`.

## Accuracy repairs

- Scope extraction to listing content, preserve table label/value associations, and exclude navigation/contact material. Reject seller/contact text and nearby shopping streets as property addresses.
- Correct buyer costs and reconcile inconsistent purchase totals, allowing small source rounding differences. Explicit URL re-imports retrieve current source data. Background checks cannot replace a newer source revision.
- Retain narrative Hausgeld, its stated year, English/German decimals, raised-ground versus first-floor distinctions, and dated availability. Exclude per-square-metre fee figures and staged/negated furniture.
- Flag conflicting occupancy, room counts, energy figures and separately priced parking. Withhold scores when material facts conflict. Describe scores as a fixed listing rubric without local comparable-sales valuation.
- Archive source text and preserve old report revisions. Retry cooldown applies only after source failures; a successful older parser version refreshes immediately. Older German reports refresh on access; unavailable sources receive a review-needed warning instead of a confident verdict.
- Keep explicit source excerpts available in each newly parsed German report. Seller statements are not independent verification.

## Real source cases

Nine current full-page Ohne-Makler captures are retained as regression fixtures:

| Listing | Verified behavior |
| --- | --- |
| 496161 | Title Neu-Hohenschönhausen; €192,700 price; €14,543 buyer costs; €207,242 source total; 1987; needs modernization; remaining occupants flagged. |
| 471956 | Dörpfeldstraße 5; €172,000; €13,105 costs; €185,104 total; €197 Hausgeld for 2025; availability 1 November 2026. |
| 501591 | Buckow; €228,000; 61.7 m²; contradictory room counts and energy class flagged; nearby park not a private garden. |
| 501600 | Wilmersdorf; €395,000; 62 m²; Hochparterre; €256 Hausgeld for 2026. |
| 501514 | Düsseldorfer Straße 38b; €420,000; 62.21 m²; first floor, not the building's Hochparterre. |
| 495026 | Commercial workshop rental rejected as unsupported. |
| 501508 | Lichterfelde/Steglitz; €297,000; 68 m²; €142.59 monthly Hausgeld, not €2.23/m²; Hochparterre; nearby Schloßstraße not an address. |
| 501404 | Wannsee; €824,000; 136.08 m²; €25,000 garage separately flagged; 192 kWh/m²/year retained without inventing a certificate class; staged furniture excluded. |
| 500988 | Prenzlauer Berg; €329,000; 42.42 m²; €187.92 Hausgeld with EUR suffix punctuation; Chodowieckistr. without an invented house number. |

The €1 discrepancies in two portal purchase totals are source rounding, not a second fee.

## Usability and recovery

- Mobile report-history drawer supports pins, two-report selection, comparison, close/Escape, focus restoration and scroll locking. Comparison headings link to full reports.
- Imports, account forms and private-note saves recover after failed requests. Requests have bounded timeouts; submission guards prevent repeated imports. Inputs remain available for retry.
- Malformed PDFs return a readable error; file inputs reset for retry. Successful real-source PDF upload exercised PDF.js and the assessment route. PDF page/text limits prevent unbounded extraction and release the worker afterward.
- Removed empty partner advertising slots. Armenia fallback explains English text/PDF requirements and desktop-only Chrome helper.
- Direct print pages share the mortgage benchmark with the calculator. The studio example gives €957/month at 4.56% + 2% (€760 loan + €197 Hausgeld). Full equity produces zero loan payment and retains Hausgeld. Historical fees and source caveats remain visible in comparisons/print.

## Validation completed

- 170 automated tests passed, zero failures; TypeScript passed; Next production and OpenNext/Cloudflare builds passed.
- Browser local checks: real imports, PDF success and malformed-PDF retry; injected network failures; duplicate-submit protection; signup/profile retry; sign-out and sign-in; forgot/reset network recovery without sending email; note save retry and persistence.
- Two separate local accounts verified note isolation: another account sees an empty note; signed-out read returns 401 with private/no-store headers.
- Mobile checked at 375×667 with no document overflow, drawer Escape/focus behavior, comparison links and financing slider endpoint.
- Final mobile live form re-import and history-drawer interaction passed.
- Four concurrent local imports succeeded in 995–1,189 ms. This is a bounded smoke test, not a capacity benchmark.
- Live 500988 re-import also passed on extraction version 2026100304: €187.92 Hausgeld and correct street-only title.
- Final live verification: all four checked saved reports upgraded immediately to 2026100304 (HTTP 200, 800–1,065 ms), with sourceUnavailable false.
- Live original reports regenerated and checked. Fresh live imports 501508 and 501404 succeeded in 1,344 and 1,103 ms. Live comparison retains source conflicts, the historical fee year and rubric explanation. Live direct studio print shows €957 and 4.56%.
- Armenia API accepted the previously captured real List.am 23397758 text: AMD 59,000,000, 144 m² house and 200 m² plot. A blocked List.am URL returned an explicit 422/source_blocked response.

## Boundaries

Native printer output, real password-reset email delivery, paid plans and sustained production load were not exercised. Preview screenshot capture was unreliable during the final pass; DOM content, layout bounds and browser interactions were checked. Source portals may still block imports, and seller contradictions require documents or seller clarification; they must not be presented as established facts.
