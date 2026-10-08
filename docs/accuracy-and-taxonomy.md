# Accuracy strategy and factual categories

22 September 2026. Deployed to reviewahouse.com on Cloudflare Worker `goodhomes`, version `52da8d16-1a04-427d-8395-cd0a47efb9f2`.

## What 99% should mean

Target at least 99% source agreement for **displayed factual claims**, with separate measurements for extraction coverage, category consistency and critical errors. This is not a promise that marketing claims in an Exposé are objectively true, or that 99% of complete reports have no error. Even 99% accuracy per field does not imply 99% accuracy across a multi-field report.

Never improve the precision number by hiding the coverage number. Track:

- Displayed precision: correct displayed facts / displayed facts.
- Coverage: correctly extracted available facts / all available source facts, distinguishing text from graphical evidence.
- Critical errors: wrong property, price, living area, rental status, availability and address. These block release regardless of the aggregate score.
- Consistency: the same source produces the same category codes, including across English/German UI and model retries.
- Timing: fresh report response and completed verification separately, with median/p95 and cache-hit rate. Provider-only latency is not the whole report time.

The three existing PDFs are a development regression set, not a statistically representative sample. Before claiming 99%, assemble a human-labeled held-out set spanning at least 100 different listings and multiple sites, PDF templates, scanned/graphical pages, occupied homes, future developments and incomplete offers. Report performance by field and source type and account for correlated errors within each property. Model-reported confidence is not a measured 99% guarantee.

## Implemented approach

1. **Extract exact values with code.** Prices, areas, room counts, addresses and dates remain values, not subjective model-generated buckets. Property address blocks outrank nearby-neighborhood mentions. Preserve approximate quarter dates rather than inventing a calendar day.
2. **Retain source excerpts for classification.** A category gets its own bounded, property-scoped evidence: a labeled table row or explicit property sentence. No generated summary, composite score, private note or demographic assumption is sent as category evidence.
3. **Canonicalize unambiguous table values deterministically.** `Etage: 3 von 5` always means upper floor, with the exact third floor retained separately. `saniert` does not become new build. A low-confidence model answer cannot erase an exact recognized table value.
4. **Use one Jev request for the remaining classification decisions.** Eight independent axes, fixed codes and bilingual labels; source support and a confidence threshold are both required. Missing/ambiguous evidence stays unknown. Conflicting rental-status rows are not resolved by guessing.
5. **Run classification alongside the existing source fact-check.** Categories use independent immutable excerpts, so the two requests do not need to wait for each other. The merge keeps verified facts and only adds the classification result; it never replaces verified facts with an earlier parser snapshot.
6. **Cache by evidence and taxonomy version.** A changed excerpt invalidates categories. Changing a note or generated summary does not. Reparsed PDFs cannot reuse an old verified/category flag.
7. **Render consistently.** The report profile uses the factual taxonomy; comparison daylight/orientation rows use the same label functions and disappear when both values are unknown. Legacy speculative buyer-fit tags are no longer displayed in the new report profile.

`FACT_CHECK_PROVIDER` remains `openrouter`. The unsuccessful Jev-only fact-check trial has not been promoted. This task uses Jev for categorization, not to fabricate corrected numeric facts or addresses.

## Category vocabulary (version 2)

Every axis also supports unknown; evidence conflicts are retained separately.

| Axis | Categories |
| --- | --- |
| Floor | Basement; ground; raised ground; upper; attic; multiple levels |
| Building condition | New build; first occupancy; renovated; maintained; like new; needs work; under construction/planned |
| Daylight | Advertised bright; limited daylight stated; mixed daylight stated |
| Orientation | North; east; south; west; multiple directions |
| Rental status | Rented; not rented; owner-occupied |
| Availability | Immediate according to listing; date stated; by agreement |
| Heating | Heat pump; district; central; individual; underfloor; multiple components |
| Energy certificate class | A+; A through H |

South-facing is not proof of a bright apartment. First occupancy does not mean available now. A fourth floor is not necessarily the top floor. Renovated is distinct from new construction. Category evidence concerns the offered unit, not a neighboring building or the agent's office.

## Extraction fixes included

- Ella-Kay-Straße **24** and the explicit **Prenzlauer Berg** address block are retained.
- `ca. 4. Quartal 2028` remains approximately Q4 2028; it no longer establishes current vacancy.
- `First occupancy` remains first occupancy instead of being rewritten as new construction of the whole building.
- A certificate class is no longer filled from an energy-demand number as if it were explicitly read. The demand figure can still inform the deterministic score. Graphical-only classes remain an unresolved extraction gap.
- New/first-occupancy due-diligence wording avoids assuming an established owners' association reserve.

## Live-provider development check

Final category request run: `tmp/jev-eval/taxonomy-1790078673761.json`; model `jev-1.13.0`. Frozen expectations derive from the independently reviewed PDFs in `jev-astra-ground-truth.json`, not from Jev's answers. Scoring command: `node scripts/score-taxonomy-evaluation.mjs <result-file>`.

| PDF | Jev request + local category parsing | Accepted categories |
| --- | ---: | ---: |
| Perfekt für Paare | 807 ms | 4 |
| Eigentumswohnung, bezugsfrei | 439 ms | 4 |
| Maisonette Berlin | 396 ms | 3 |

All **11 displayed categories matched** the frozen expectations. This tiny result is not proof of 99% accuracy. Three known categories were withheld: one explicit rental-status normalization and two graphical energy badges. Coverage was **11/12 text-available categories (91.7%)**, or **11/14 PDF-available categories (78.6%)**. Unknown fields are not counted as displayed successes. Latencies exclude upload, parsing, storage, the parallel fact-check, UI rendering and questions. The first exploratory run had a 2,744 ms call, so the final median of 439 ms must not be sold as a guaranteed latency.

The later removal of energy-class inference changes only a raw fact; the classifier already used explicit source excerpts and returned unknown for graphical badges in the timed run. Tests cover both behaviors.

120 regression tests and the production build pass. Deployment smoke checks passed for English/German landing and report pages, an existing comparison, build-ID matching, and rejection of non-listing input (HTTP 422). Saved reports were not bulk-reprocessed. Tests include negative/contradictory evidence, fabricated model enums, invalid confidence, malformed responses, source changes, bilingual labels, agency/related-listing boundaries and quarter-based availability.

## Next steps before a 99% claim

1. **Targeted visual extraction**, not whole-document vision on every report: detect high-impact labels with missing values; inspect only the relevant page/crop (energy badges, scanned price tables, floor-plan labels). Require visual provenance and abstain when illegible. This is not implemented in this increment.
2. **Per-field provenance and conflicts for numeric facts.** Expand the source-excerpt approach beyond categories, preserving page/DOM location and competing candidates. Prioritize explicitly labeled property fields over financing widgets and related listings. Current categorical evidence does not prove all other report facts.
3. **Broader held-out evaluation and calibration.** Calibrate thresholds separately for subjective daylight prose versus explicit occupancy, without repeatedly tuning against these same three PDFs. Review false accepted claims and missed known facts separately.
4. **Production measurement.** Measure end-to-end median/p95 under cold and warm conditions; watch timeout/unknown rates and source-template drift. Only deploy a model/taxonomy update after it clears critical-error regressions.

Do not solve uncertainty by lowering one global threshold or by asking a second model to rubber-stamp every report. Exact rules, constrained source-backed decisions and selective visual evidence are the intended combination.
