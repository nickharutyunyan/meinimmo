# Production assessment audit: Ohne-Makler 471417

Audit date: 24 August 2026  
Source listing: <https://www.ohne-makler.net/immobilie/471417/?utm_source=autosearch>  
Retest report: <https://habitat-real-estate-evaluator.meinimmo.workers.dev/r/4f305a94e3a14cfd>

## Executive summary

The assessment is not reliable enough to support a purchase decision. The title and map place the Berlin property in Reinbek, the displayed living area is actually the larger usable area, the price per square metre is consequently understated, and the buyer-cost estimate is materially overstated. The report also misses the listing's defining investment facts: it is rented, furnished, advertised at a 5.12% return, and carries monthly Hausgeld of €515.

The OpenRouter-key change did not make the assessment faster. The earlier production run took 8.92 seconds; the retest took 10.69 seconds. A separate source-page fetch took 0.81 seconds, so approximately 9.88 seconds of the retest occurred after the source was downloaded. The retest did receive valid AI enrichment, but production still explicitly requests `openrouter/free`; replacing only the API key does not select a different model.

## Source-of-truth facts

| Field | Listing states |
| --- | --- |
| Title | 2.5-room apartment with terrace in Berlin-Mitte; advertised 5.12% return |
| Public location | 10179 Berlin (Mitte); street withheld |
| Price | €539,000 |
| Living area | 60 m² |
| Usable area | 66 m², including terrace |
| Current use | Rented; handover by agreement |
| Condition / year | Near-new; built in 2017 |
| Features | Furnished, terrace, garden share, basement, two bedrooms, full bath, guest WC, barrier-free, floor-to-ceiling windows |
| Energy | Class A; demand certificate; 31.90 kWh/(m²a); district heating |
| Heating distribution | Underfloor heating |
| Monthly Hausgeld | €515 |
| Portal buyer costs | €39,315 (7.30%); €578,314 total |
| Broker fee | €0 |

## Findings

### Critical correctness failures

1. **Wrong city in title, subtitle, sidebar, and map.** Actual: `2,5-room flat · Reinbek`. Expected: a Berlin-Mitte location label because no street is public. The map resolves to Reinbek at approximately 53.5099, 10.2511, so the neighborhood section is about a different city.

   Root cause: the parser takes the first JSON `addressLocality` anywhere in the document. The only such value belongs to the page publisher's `Organization` schema: Ohne-Makler's office in Reinbek. It is not a property address. The visible listing location, `10179 Berlin (Mitte)`, is ignored. There is no schema-scope check and no contradiction check between the page title, visible location, and organization metadata.

2. **Living area is wrong.** Actual: 66 m². Expected: 60 m² living area; 66 m² is usable area including the terrace. Flattening the entire HTML into one string destroys the table structure, and the broad area expression can associate a `Wohnfläche` label with a later number.

3. **Price per square metre is wrong.** Actual: €8,167/m², calculated with 66 m². Expected: approximately €8,983/m² using the stated 60 m² living area. The report understates the figure by about €816/m², or 9.1%.

4. **Estimated acquisition cost is wrong.** Actual total cost: €594,409, based on a hard-coded 10.28% surcharge. The listing's own itemized estimate is €578,314: 6.00% transfer tax, 0.86% notary, 0.44% land register, and no broker fee. The report overstates the total by €16,095 and every financing figure derived from it is therefore distorted.

### High-severity omissions and misleading analysis

5. **The investment case is almost entirely omitted.** The report does not say that the unit is rented, furnished, marketed as a capital investment, or advertised at a 5.12% return. It extracts no current rent, lease terms, recoverable versus non-recoverable Hausgeld, vacancy assumptions, tenant deposit, rent-increase history, or evidence behind the advertised yield. Those are central to this listing.

6. **Hausgeld of €515/month is omitted.** This is a major recurring cost and essential to both affordability and net-yield analysis. The financing panel displays only loan annuity and acquisition costs, making the monthly burden look incomplete.

7. **The 8.2/10 score is unjustified and misleading.** It is effectively assigned from energy class alone. It does not account for the wrong location/area, missing tenancy data, missing yield inputs, Hausgeld, WEG finances, or the absence of a disclosed floor. The accompanying verdict, “A considered yes,” overstates confidence despite these gaps.

8. **The summary repeats incorrect data and misses decision-critical facts.** It says 66 m² and gives only price, year, and energy class. It does not mention Berlin-Mitte, terrace/garden, rented status, advertised yield, monthly Hausgeld, or the difference between living and usable area.

9. **Heating is only partially represented.** `Fußbodenheizung` describes heat distribution. The listing separately identifies `Fernwärme` as the main energy source and gives a demand of 31.90 kWh/(m²a). These facts are omitted, so the energy picture is incomplete.

10. **The energy recommendation is nonsensical for this property.** “Review ... the upgrade path for energy class A” suggests remediation for a high-efficiency 2017 building. More useful checks would cover the demand certificate, district-heating tariff, metering, actual annual consumption/costs, and whether heating costs are recoverable from the tenant.

11. **AI questions remain generic and one is contradicted by the source.** The tailored set asks the seller to confirm whether the unit is tenanted or vacant even though the page explicitly states `Vermietet`. It also asks about measures to achieve/maintain class A instead of examining actual district-heating costs. It misses rent, lease/indexation, tenant payment history, deposit, furnishings inventory, claimed-yield calculation, non-recoverable Hausgeld, and terrace/garden usage rights.

12. **Light and orientation are handled too coarsely.** Cardinal orientation is genuinely not stated and should not be invented, but the listing does state that floor-to-ceiling windows provide abundant daylight. The report reduces both concepts to `not stated` instead of preserving the sourced daylight claim while marking orientation unknown.

13. **The floor is unresolved without useful context.** The source does not visibly state an exact floor, so `not stated` is safer than guessing. However, the assessment should distinguish “not disclosed” from “parser failed,” and connect the barrier-free claim, terrace/garden access, lift question, and exact unit position into a targeted verification item.

14. **Important physical features are omitted.** Terrace, garden share, barrier-free access, basement, two bathrooms, two bedrooms, furnished condition, and near-new condition do not appear in the at-a-glance section or summary.

15. **Neighborhood and transport content is not an assessment.** Apart from showing the wrong map, the page offers only a generic instruction to verify routes. It provides no listing-grounded transport stop, walking distance, park, retail, school, or noise context, even though the listing claims public transport and daily infrastructure nearby.

### Performance and reliability failures

16. **The new key did not improve observed latency.** Earlier identical run: 8.92s total. Retest: 10.69s total, 1.77s slower (19.8%). The listing itself downloaded in 0.81s. One run is not a statistically robust benchmark, but it disproves an immediate speed improvement in this test.

17. **The configured model did not change.** `wrangler.jsonc` sets `OPENROUTER_MODEL` to `openrouter/free`, and the request body uses that value. API keys authenticate; they do not select the requested model. A model change requires changing the model configuration and redeploying.

18. **Generation blocks on optional AI work.** The API waits for OpenRouter before saving and returning the deterministic assessment. The UI shows a single “Reading listing…” message with no progress stages, timeout, early result, or asynchronous enhancement, so model latency becomes total perceived latency.

19. **The free-model router is variable.** The earlier run waited 8.92s but produced no usable enrichment (`aiEnriched: false`). The retest waited 10.69s and did produce JSON (`aiEnriched: true`). That behavior is inconsistent, and fallback is silent to the user.

20. **Valid JSON is treated as successful enrichment even when quality is poor.** The retest receives the `AI tailored` label despite repeating generic questions and asking whether an explicitly rented property is vacant. Validation checks only the JSON shape and question count, not whether questions contradict the source or duplicate known facts.

### Product and trust issues exposed by this test

21. **No field provenance or confidence is shown.** Users cannot see whether a value came from visible listing content, publisher metadata, an inference, or AI. That makes the Reinbek and 66 m² errors look authoritative.

22. **No cross-field validation exists.** Simple checks would have flagged Berlin in the page title and visible location versus Reinbek in organization metadata; 60 m² Wohnfläche versus 66 m² Nutzfläche; and a portal-calculated total versus the hard-coded surcharge.

23. **Unknown, absent, and failed extraction are conflated.** `not stated` can mean the listing withheld the fact, the parser missed it, or AI failed. These states require different user guidance.

24. **The title mixes German and English conventions.** `2,5-room flat` combines a German decimal comma with English wording. This is secondary to the wrong city but makes the product feel inconsistent.

25. **The report is persisted before its quality is established.** A materially wrong assessment is saved, added to the sidebar, and made shareable with no validation warning or review state.

## Root-cause map

| Symptom | Primary cause |
| --- | --- |
| Reinbek title/map | Unscoped regex reads publisher Organization `addressLocality` |
| 66 m² living area | HTML flattened; broad regex loses label/value structure |
| €8,167/m² | Derived from wrong area |
| €594,409 total cost | Hard-coded 10.28% acquisition-cost multiplier |
| Missing tenancy/yield/Hausgeld | Deterministic schema does not model investment fields |
| Generic summary/score | Fixed templates and energy-only score |
| Slow request | Source fetch and synchronous LLM enrichment are on one blocking path |
| New key did not switch model | Model is configured separately as `openrouter/free` |
| “AI tailored” but weak questions | JSON-shape validation without factual or relevance validation |

## Recommended fix order

1. Stop publishing reports that fail location, area, and cost consistency checks.
2. Parse semantic HTML/JSON-LD by schema type and table row; never search a flattened page indiscriminately.
3. Add separate fields for living area, usable area, source energy, heating distribution, tenancy, rent/yield, Hausgeld, and buyer-cost components.
4. Make the deterministic report return immediately; run optional question enrichment afterward with a strict timeout and visible status.
5. Replace the energy-only score with an evidence/completeness-aware assessment, or remove the score until it is defensible.
6. Validate AI output against extracted facts before showing `AI tailored`.
7. Change `OPENROUTER_MODEL` explicitly if a different model is intended, deploy, then benchmark several warm and cold runs using the same listing.

No application code was changed as part of this audit.
