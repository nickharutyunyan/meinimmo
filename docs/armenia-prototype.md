# Armenia prototype — verification, 22 September 2026

## Scope

Country selector: Germany remains the established product; Armenia lives at `/am`; US and Canada are explicitly under construction. Armenia supports English List.am sale listings, pasted listing text, and text-searchable English PDFs. Its deterministic extractor does not spend LLM tokens.

Reports and comparisons use AMD. Original currencies and dated conversion evidence remain visible. Land uses plot area, advertised use, utilities and access rather than apartment-only attributes. Unknown facts are omitted. There is deliberately no German energy grade, purchase-tax assumption, Hausgeld or uncalibrated deal score.

## Financial sources

- Official CBA exchange-rate service: https://www.cba.am/en/exchange-rates-retrieval and https://api.cba.am/exchangerates.asmx. Verified 22 September: USD 363.46 AMD, EUR 416.74 AMD. Respect quoted currency denominations; reject rates older than seven days.
- Mortgage illustration: https://acba.am/en/individual/loan/161. Published example: 20m AMD, 13.5% nominal floating rate, 240 months, approximately 241,475 AMD monthly. This is a lender example, NOT a national mortgage average or a guaranteed fixed rate. It refreshes daily, with a clearly dated stale fallback expiring after 30 days. The CBA policy rate and aggregate business/consumer lending rates are not substituted for mortgage rates.
- The calculator assumes constant nominal interest for an annuity and excludes bank fees, insurance and tax relief. Land does not automatically receive residential mortgage terms.

## Six real listings checked in the browser

Selected source fields are preserved in `tests/fixtures/armenia-listings.mjs`; these are excerpts, not full-page archives.

| List.am item | Kind / location | Advertised price | Area | Renewed |
| --- | --- | --- | --- | --- |
| 23494915 | House, Nork-Marash / Yerevan | 82,000,000 AMD | 177 m² building; 145 living; 335 plot | 18 Sep |
| 23397758 | House, Arinj | 59,000,000 AMD | 144 m² building; 130 living; 200 plot | 16 Sep |
| 24226646 | Flat, Arabkir / Yerevan | 108,000 USD | 43 m²; 1 room; floor 8/12 | 20 Sep |
| 24238129 | Flat, Tsaghkadzor | 27,500,000 AMD | 45 m²; 2 rooms; floor 8/8 | 21 Sep |
| 23765773 | Land, Ajapnyak / Yerevan | 364,000 USD | 910 m² | 22 Sep |
| 24252353 | Land, Nor Yerznka | 36,000 USD | 500 m² | 21 Sep |

Specific discrepancies are surfaced rather than silently resolved: Arinj description says 55m AMD while headline says 59m; the last plot title says Ashtarak while its Location says Nor Yerznka. An explicitly approximate map address loses its misleading house number. Greyed-out amenity labels are never considered confirmed utilities.

## Verification

- 136 automated tests pass, including 16 Armenia cases: six fixtures, conflicts, source rejection, URL restrictions, exchange denominations, price per m², and annuity math.
- All six fixtures saved successfully through the local report API, roughly 28–543 ms on warm requests. This is not a production latency guarantee.
- Browser: country navigation, actual copied listing import, share confirmation, zero-interest/cash financing, report mobile width, and horizontally scrollable land comparison checked.
- Production build passes. Deployment and production smoke-test results are recorded in the task handoff.

## Prototype limits

List.am can block server-side URL retrieval even while its normal browser page works. The UI offers full English text or PDF import rather than claiming to bypass protection. Armenian-only documents are not supported yet. Address maps are labelled seller-stated/approximate, without a falsely precise property marker. No local comparable-sales model or calibrated Armenia deal score is claimed. Armenia-specific print/PDF report layout is not implemented; print routes return to the report instead of rendering misleading German figures.

Production smoke tests: all six reports created (133–791 ms for pasted source excerpts), land comparison saved, all country pages returned HTTP 200, official CBA conversion succeeded, and the lender quote refreshed live at 13.5%. URL-only List.am import returned the expected actionable 422. R2 is not enabled in this Cloudflare account: PDF analysis can proceed, but the Source section explicitly says the original file is not retained for download.

## Language-link regression, 22 September

`https://www.list.am/item/22791157?ld_src=2` automatically becomes `https://www.list.am/en/item/22791157` in both the UI and server importer. Armenian/default, Russian and English links preserve the advert ID and discard tracking. Redirects are restricted to the same List.am advert, English requests have an explicit language preference, and a blocked request never asks the user to locate an English link manually.

The English browser page is accessible, but server-side URL import remains blocked by List.am. Browser-inspected source: 2-room stone house, 42 m² building, 226 m² plot, 13/3 Nubarashen 1st Street, Yerevan, current asking price USD 72,500. Desktop layout places the title and asking price after the property panel. Regression tests ensure the parser handles that order, ignores a USD 75,000 map ad and old USD 67,500 price, and does not confuse the mortgage calculator's monthly payment with rental status. The test suite now contains 141 passing cases.
