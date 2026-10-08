# Independent Astra evaluation of Jev fact verification

Reviewed 22 September 2026. **Recommendation: leave the Jev switch off and retain the existing provider.** In two trials Jev caught the tested dangerous errors, but accepted none of the three real reports and rejected the clean synthetic control. It is a useful experimental verification gate; these trials do not demonstrate a usable replacement for extraction and correction.

Evidence: frozen [PDF ground truth](jev-astra-ground-truth.json), local trials `tmp/jev-eval/results-1790076715686.json` and `tmp/jev-eval/results-1790076835318.json`, request/acceptance logic in `lib/jev-fact-check.ts`, synthetic source/patches in `scripts/evaluate-jev.mjs`, and routing in `lib/jev-verification-flow.ts` / `lib/fact-verification.ts`. Ground truth was established independently before candidate outputs were reviewed, using all extracted source text plus rendered factual pages. No external listing refresh or geographic inference was used. This evaluation did not change application code or deploy anything.

## What was measured

The model was `jev-1.13.0`. There are 24 questions per report. A non-null candidate passes only with `supported` at confidence >= 0.90; a null candidate passes only with `absent` at >= 0.90. `contradicted`, `uncertain`, mismatched verdicts, and low confidence all require review. One held field prevents whole-report acceptance. Thus **a withheld correct field is not necessarily a false factual verdict**, and a correctly blocked bad value is not a correction: Jev supplies no replacement value or evidence quote.

The frozen core comprises 17 fields per PDF (51 field slots); `occupancy` maps to `tenancy`. Seven additional verifier fields were checked against the previously inspected PDF text for the 72-decision analysis. Detailed counts below refer to the first run unless stated otherwise; the repeat is analyzed separately. They are not population estimates or calibrated probabilities.

## Candidate accuracy before Jev

| PDF | Acceptable core values/unknowns | Problems among 17 core slots |
| --- | ---: | --- |
| Perfekt für Paare | 12/17 | Unsupported current `Not rented`; wrong district `Kollwitzkiez`; missing approximate Q4 2028 availability; missing graphical A+; street lacks the explicitly supplied house number 24 |
| Eigentumswohnung, bezugsfrei | 16/17 | Missing `sofort` availability |
| Maisonette | 16/17 | `New build` drops the condition/extension nuance: explicit condition is first occupancy, with new construction on an existing house and a newly renovated section |
| Total | **44/51** | Two unsupported substantive values, three missing facts, one incomplete address, one materially qualified condition |

This is a strict completeness-aware score: 40 of 44 populated core values are acceptable as supplied, four need correction/qualification; four of seven nulls appropriately preserve unknown information, three omit known PDF facts. Normalizations such as `3. OG` for `3 von 5`, `Well maintained` for `Gepflegt`, and `Graunstr.` for `Graunstraße` are accepted. The Maisonette condition is qualified rather than simply false: the source also explicitly labels it new construction. Its 2025 construction-year value is counted correct, while the different certificate year 2021 should remain visible as a caveat.

Important source distinctions:

- Paare p1 says `Bezugsfrei ab: ca. 4. Quartal 2028`; this does not establish current vacancy. Its property district is Prenzlauer Berg; the text places it **between** Kollwitzkiez, Winsviertel, and Volkspark Friedrichshain.
- Bezugsfrei p1 says `Bezugsfrei ab: sofort`. `Not rented` is an acceptable normalization of this advertised vacant possession, although it is not independent confirmation of physical vacancy.
- Maisonette has no explicit availability date or numbered floor; nulls are appropriate. `First occupancy` must not become `available now`. `Mitte` is source-grounded, whereas Wedding/Gesundbrunnen would require an additional location source.
- Paare's A+ and Bezugsfrei's E are visible graphical badges but absent from the extracted text. E is correct against the PDF, yet a text-only verifier cannot directly verify its class. Paare's null class is a real PDF extraction omission, but not a text-verification hallucination.

Outside the 17 core fields, Maisonette omits explicitly named Eberswalder Straße/Bernauer Straße transit stops and puts `Sunny balcony stated` in an orientation field. The phrase is faithful to marketing text, but it does not establish orientation. Paare's combined `Balkon/ Terrasse` portal tag does not confidently establish both separate features. Feature verification also does not measure completeness: Paare's candidate array omits the explicitly listed lift and step-free access.

## Jev decisions on the real PDFs

| PDF | Accepted field decisions | Held for review | Entire report accepted | Measured call time |
| --- | ---: | ---: | --- | ---: |
| Paare | 14/24 | 10/24 | No | 1,149 ms |
| Bezugsfrei | 16/24 | 8/24 | No | 309 ms |
| Maisonette | 13/24 | 11/24 | No | 376 ms |
| Total | **43/72** | **29/72** | **0/3** | Median 376 ms |

No source-factual false acceptance was observed among the **43 accepted decisions**. This includes decisions correctly retaining nulls; it does not mean all 43 are positive factual claims. Across the frozen core, 31/51 decisions passed and 20/51 were held. The latency excludes any later correction, fallback, or full report-generation time.

All six clear text-level problems below were held: Paare's tenancy, missing availability and wrong district; Bezugsfrei's missing availability; Maisonette's missing transit stop and non-orientation marketing text. Jev correctly classified both missing availability dates as `contradicted` (0.99 and 0.93), the wrong district as `contradicted` (0.82), and missing Maisonette transit as `contradicted` (0.94). The Paare tenancy hold was safe, but `absent` at 0.18 violates the prompt's rule that `absent` is only for null candidates.

At least **15 of the 29 holds** are avoidable holds of clearly acceptable text-backed values or nulls:

| PDF | Clearly acceptable decisions withheld |
| --- | --- |
| Paare (4) | Absent usable area; `Erstbezug`; 2027; commission-free |
| Bezugsfrei (6) | Advertised vacant possession; well maintained; 1885; third floor; Möckernstraße; fitted kitchen/cellar |
| Maisonette (5) | Flat; absent usable area; requirement-oriented certificate; Mitte; listed features |

For example, explicit Paare `Erstbezug` receives `contradicted` at 0.36; explicit 1885 receives `supported` at only 0.65; explicit Maisonette `Apartment` receives `supported` at 0.78. Bezugsfrei's non-null tenancy also receives the invalid `absent` verdict, at 0.31. The parser still withholds both invalid verdicts safely, but the model does not consistently follow its label semantics.

The remaining eight holds should not all be scored as model errors: Paare energy/address completeness/combined balcony-terrace tag; Bezugsfrei graphical energy; and Maisonette condition/year distinction/numbered-floor uncertainty/community-fee interval. Some are sensible conservatism, some could improve with better evidence presentation. The €333 fee itself is explicit, but the source does not separately specify a monthly interval.

Crucially, **this run corrected zero values**: Jev only produced verdicts. The two missing move-in dates and other parser problems require a correction stage or remain in the report. If a separate generation step changes facts after validation, those changed facts are outside this gate's guarantee.

## Synthetic corruption tests

One clean source was used for one control plus six deliberately corrupted variants. These repeated fields are correlated tests, not 168 independent properties.

| Variant | Injected bad/missing fields | Result |
| --- | --- | --- |
| Wrong price and area | Mortgage amount €1,450 used as price; living area 520 instead of 85 | Both contradicted at 1.00 |
| Rented as vacant | `Not rented` despite explicitly sold with tenant | Contradicted at 1.00 |
| Renovated as new | `New build` despite `saniert` and 1900 | Contradicted at 1.00 |
| Office as property | Agency city, street and postcode substituted | All three contradicted at 0.99–1.00 |
| Missing listed facts | Null price, area, rooms, energy | All four contradicted at 0.93–1.00 |
| Source instruction injection | Bad €1,450 price plus text demanding all-supported answers | Price contradicted at 1.00 |

**All 12 injected bad/missing field values were blocked**, with zero false acceptances of these 12. Eight are listed in the harness's `mustReject`; four null omissions were independently counted because the harness supplies an empty `mustReject` for that case. The harness's `missedErrors: []` alone therefore cannot establish omission detection, and the real-PDF cases have no harness assertions at all.

The second run's harness fixes those assertions: all four omitted fields are in `mustReject`, and the acceptance check also covers an erroneous high-confidence `absent` for null candidates. The first-run results were evaluated from actual verdicts rather than trusting its incomplete harness summary.

Across 7 × 24 = 168 synthetic decisions, there were 12 legitimate error holds, 7 unnecessary holds of absent `usableArea`, and 149 accepted correct decisions. Accordingly 149/156 otherwise-correct synthetic decisions passed. **The clean control failed** solely because absent usable area received 0.86. This same absent field failed in all seven variants (0.48–0.87), including two incorrect `contradicted` verdicts. No synthetic report passed, even though only six were intentionally bad.

## Repeat consistency and integration

The second run used identical candidates in all ten cases; this was checked directly. All 240 categorical verdicts were unchanged, but confidence variation changed five acceptance decisions:

- Real PDFs: 69/72 pass/hold decisions agreed. Paare commission-free changed from held to accepted (0.89 to 0.95); Maisonette rooms changed from accepted to held (0.92 to 0.89), as did its commission (0.94 to 0.86). The repeat accepted 42/72 fields, held 30/72, and still passed 0/3 reports. No false acceptance was observed among those 42 accepted decisions.
- Synthetics: 166/168 pass/hold decisions agreed. Two otherwise-correct commission fields newly fell below threshold. The repeat accepted 147/156 correct decisions and blocked all 12 injected errors again. The clean control still failed solely on usable area (0.80); usable area remained held in every synthetic variant.
- Real-PDF latency in the repeat was 1,601 ms / 526 ms / 462 ms for Paare / Bezugsfrei / Maisonette, respectively. Across the two runs the observed range was 309–1,601 ms. These are two repeats of three PDFs, not six independent test properties. Across the repeated synthetic suite, 24/24 injected-error instances were blocked, representing 12 distinct corrupt field cases tested twice.

The wrapper is explicitly opt-in (`FACT_CHECK_PROVIDER === 'jev'` with a key); otherwise it uses the existing correction path. It resets verification flags, accepts only a fully passed report, and falls back when a request fails or any field is held. The fallback receives the remaining total timeout; a Jev call therefore both adds latency and reduces the fallback budget. On these PDFs **all six attempts would invoke the fallback**. This trial provides no evidence of an overall speedup.

An accepted Jev branch sets both fact and location verification flags. That establishes only support in supplied source text, not external geographic verification; its user-facing meaning must match that limited guarantee. The 24-field gate also does not validate narrative summaries, scores, derived totals, or complete feature extraction. Parent implementation work reports 113 passing unit tests and a successful production build; those checks are useful integration evidence, not additional semantic accuracy samples independently run by this evaluator.

## Recommendation and next evidence needed

Keep this version experimental and disabled by default. At the current threshold, the observed whole-report bypass rate is **0/3 real reports and 0/1 clean synthetic control in each of two runs**; the Jev-first fallback design would not save a correction call on these inputs and would add the measured verification latency. Zero observed bad acceptances is encouraging but insufficient to certify safety from three PDFs and one synthetic source.

1. Retain an evidence-producing correction path and preserve unverified status when Jev alone cannot clear the report. Do not set `aiFactChecked` merely because a Jev request completed or because only selected fields passed.
2. Diagnose the recurrent usable-area confidence issue and ambiguous verdict semantics before adjusting the threshold. Do not choose a lower global threshold to make this same tiny test pass; validate any field-specific treatment on held-out listings, negations, missing facts and repeated trials.
3. Preserve source provenance and separate extracted claims from unknowns, qualifications and graphical-only evidence. Capture evidence quotes/locations for accepted claims and explicitly support OCR/visual evidence if complete PDF checking is claimed.
4. Tighten the street rule: it currently allows an explicitly nearby street, which is unsafe if the accepted value is later displayed as the property's address. Assess feature completeness separately from correctness of each included feature.
5. Test the actual integration end-to-end: resulting corrected values, user-visible verification status, failure/timeout behavior, subsequent-generation stability and fallback behavior. These result files only test the candidate verifier. Add long/conflicting listings, related-unit distractors, exact negations, legitimate zero-valued fees, and broader instruction-injection cases; one failed injection attempt is not a robustness guarantee.

There is no same-input OpenRouter baseline in this artifact, so this evaluation cannot establish that Jev is more or less accurate than the current provider. It establishes that this Jev configuration safely withheld the tested errors but is not ready to replace the complete fact-checking workflow on its own.
