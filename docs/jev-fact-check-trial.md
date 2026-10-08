# Jev fact-check replacement trial

Date: 22 September 2026. Status: implemented locally behind a flag; **not enabled or deployed**.

## Scope and design

The existing parser extracts property facts. The trial sends the original extracted listing text and 24 candidate fields to Jev, not the report's generated summary, private notes, account details or API credentials. Jev decides `supported`, `absent`, `contradicted` or `uncertain` for each field. It cannot generate arbitrary corrected values.

A report may skip the existing OpenRouter reviewer only if every known candidate is supported, every missing candidate is genuinely absent, and every decision reaches confidence 0.90. A missing answer, invalid response, timeout, oversized source, unsupported field or uncertainty takes the existing evidence-review path. Confidence is a routing heuristic, not proof of truth.

The API is restricted to the official TypeSafe endpoint. Its [schema](https://api.typesafe.ai/openapi.json) supports typed decisions; Jev does not generate arbitrary evidence strings. This makes it a possible verification gate, not a drop-in replacement for free-form evidence extraction and correction.

## Measured results

Each of three user-supplied PDFs was extracted with the website's existing PDF text helper and checked twice. Separately, six deliberately corrupted cases and a clean synthetic control were tested twice. No test created a production report or changed live settings.

| PDF | Run 1 | Run 2 | Passed without fallback |
| --- | ---: | ---: | --- |
| Perfekt für Paare – mit Platz fürs Homeoffice | 1,149 ms | 1,601 ms | No / No |
| Eigentumswohnung, bezugsfrei | 309 ms | 526 ms | No / No |
| Expose Maisonette Berlin | 376 ms | 462 ms | No / No |

Median across the six real-PDF Jev calls: **494 ms**. Model returned: `jev-1.13.0`. These are desktop-to-provider request times, not full report-generation times or Cloudflare latency measurements. PDF extraction, uploads, storage, category generation and due-diligence questions are excluded.

The previous 7.7-second live report test included additional stages and is not an apples-to-apples baseline for these measurements. No end-to-end speed-up is established.

Every real report required fallback. The clean synthetic control also required fallback for a correctly absent usable-area field. The six corrupted cases covered incorrect price/living area, rented-as-vacant, renovated-as-new, agency address substituted for property address, missing explicit values and source prompt injection. No deliberately corrupted field was falsely accepted at the configured threshold in either run; this small set is not a general safety guarantee.

## Independent quality review

GPT-6 Astra established source ground truth from the original PDFs before seeing Jev outputs. It inspected rendered factual sections as well as extracted text. See `jev-astra-ground-truth.json` and `jev-astra-evaluation.md`.

Important discoveries include a future approximate Q4 2028 availability date omitted by the current parser, a property street number lost during extraction, incorrect district attribution, and graphical energy-class badges missing from plain text. A text-only Jev check cannot recover a graphical value that was never passed to it; the existing text-only reviewer has the same limitation.

## Release decision

Keep `FACT_CHECK_PROVIDER=openrouter`. With zero accepted real reports, enabling this strict Jev gate would add a request before the existing reviewer and make generation slower.

The next useful experiment is source-grounded candidate selection/correction, not lowering the threshold to force these cases through. Improve extraction of quarter-based availability and subject-address blocks, distinguish graphic-only facts, and then rerun the frozen source audit plus a larger held-out set. Only count eliminated reviewer calls as a speed benefit, and measure full fresh-report latency separately.

## Implementation and regression checks

- `lib/jev-fact-check.ts`: bounded, untruncated source request and strict response validation.
- `lib/jev-verification-flow.ts`: testable routing with an existing-reviewer fallback and shared deadline.
- `lib/fact-verification.ts`: server-only configuration and credential use.
- `FACT_CHECK_PROVIDER=jev`: experimental opt-in; remains `openrouter` by default.
- Reparsed PDFs no longer inherit old verification/category flags.
- 113 tests pass; production build succeeds. No deployment was performed.

Raw local trial outputs are in ignored `tmp/jev-eval/`; no API key is persisted by the harness. `scripts/evaluate-jev.mjs` accepts PDF paths and reads the credential from standard input, never command arguments. When using an interactive terminal, disable terminal echo before entering the key and restore it afterward. Do not paste credentials into a shell command or commit them.
