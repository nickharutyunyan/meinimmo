import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Report } from './types';
import { htmlToLines, looksLikePropertyListing, normalizedCondition, normalizedFloor, normalizedTenancy, parseListing, refreshDerivedReport } from './listing-parser';
import { displayAddress, resolveLocation } from './display';
import { offerQuestionsFor } from './report-copy';

export const looksLikeListing = looksLikePropertyListing;
export const deterministicAssessment = parseListing;

export function defaultOfferQuestions(report: Report, locale: 'en' | 'de' = 'en') {
  return offerQuestionsFor(report, locale);
}

function validatedQuestions(value: unknown, report: Report, locale: 'en' | 'de') {
  if (!Array.isArray(value) || value.length !== 4) return undefined;
  const questions = value.map(item => typeof item === 'string' ? item.trim() : '');
  if (questions.some(question => question.length < 12 || question.length > 180 || question.split(/\s+/).length > 30)) return undefined;
  if (new Set(questions.map(question => question.toLocaleLowerCase(locale))).size !== questions.length) return undefined;
  const joined = questions.join(' ').toLowerCase();
  if (report.facts.tenancy === 'Rented' && !/(?:rent|tenant|lease|miete|mietvertrag|rendite|yield|return)/i.test(joined)) return undefined;
  if (report.facts.housegeld && !/(?:hausgeld|weg|reserve|recoverable|umlage|umlagefähig)/i.test(joined)) return undefined;
  return questions;
}

function normalizedEvidence(value: string) {
  return value.normalize('NFKD').toLocaleLowerCase('de-DE').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function sourceContains(source: string, value: string) {
  const needle = normalizedEvidence(value);
  return needle.length >= 2 && normalizedEvidence(source).includes(needle);
}

function validPlace(value: unknown, source: string, max = 80) {
  if (typeof value !== 'string') return '';
  const clean = value.replace(/\s+/g, ' ').replace(/[|;,]+$/g, '').trim();
  if (!clean || clean.length > max || !/\p{L}/u.test(clean) || /^(?:0|unknown|not stated|null|deutschland|germany)$/i.test(clean)) return '';
  return sourceContains(source, clean) ? clean : '';
}

type AiLocation = { city?: unknown; postalCode?: unknown; district?: unknown; street?: unknown; transitStop?: unknown; evidence?: unknown };
type AiFactEvidence = { propertyType?: unknown; rooms?: unknown; area?: unknown; occupancy?: unknown; condition?: unknown; year?: unknown; floor?: unknown; energy?: unknown };

function mergeLocation(report: Report, value: unknown, sourceText: string) {
  if (!value || typeof value !== 'object') return report;
  const location = value as AiLocation;
  const searchableSource = htmlToLines(sourceText).join('\n');
  const city = validPlace(location.city, searchableSource);
  const district = validPlace(location.district, searchableSource);
  const street = validPlace(location.street, searchableSource, 100).replace(/,?\s*\b\d{5}\b[\s\S]*$/u, '').replace(/\s+0\s*$/u, '').trim();
  const stop = validPlace(location.transitStop, searchableSource);
  const postal = typeof location.postalCode === 'string' && /^\d{5}$/.test(location.postalCode.trim()) && sourceContains(searchableSource, location.postalCode.trim()) ? location.postalCode.trim() : '';
  const evidence = typeof location.evidence === 'string' && sourceContains(searchableSource, location.evidence) ? location.evidence.trim().slice(0, 240) : '';

  if (city) report.facts.city = city;
  if (postal) report.facts.postalCode = postal;
  if (district) {
    report.facts.district = district;
    report.location = district;
  } else if (city && !report.facts.district) report.location = city;
  if (stop) report.facts.transitStop = stop;
  if (street && /(?:straße|str\.?|allee|weg|platz|gasse|damm|ufer|chaussee|ring|steig)\b/iu.test(street)) {
    const hasNumber = /\b\d{1,4}[a-z]?\s*$/iu.test(street);
    report.facts.street = street;
    report.facts.locationPrecision = hasNumber ? 'address' : 'street';
    report.address = hasNumber ? displayAddress(`${street}${postal ? `, ${postal}` : ''}${report.facts.city ? ` ${report.facts.city}` : ''}`) : 'Address not stated';
  } else if (district) report.facts.locationPrecision = 'neighborhood';
  else if (postal) report.facts.locationPrecision = 'postal';
  else if (stop) report.facts.locationPrecision = 'transit';
  else if (city) report.facts.locationPrecision = 'city';
  if (evidence) report.locationEvidence = evidence;
  return report;
}

function verifiedEvidence(value: unknown, source: string) {
  if (typeof value !== 'string') return '';
  const clean = value.replace(/\s+/g, ' ').trim().slice(0, 280);
  return clean.length >= 3 && sourceContains(source, clean) ? clean : '';
}

function decimal(value: string) {
  return Number(value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, ''));
}

function mergeVerifiedFacts(report: Report, value: unknown, sourceText: string) {
  if (!value || typeof value !== 'object') return report;
  const source = htmlToLines(sourceText).join('\n');
  const evidence = value as AiFactEvidence;
  const facts = { ...report.facts };

  const typeEvidence = verifiedEvidence(evidence.propertyType, source);
  if (typeEvidence) {
    if (/\b(?:einfamilienhaus|reihenhaus|doppelhaush[aä]lfte|wohnhaus|single.family\s+home|detached\s+house|\bhouse\b)\b/i.test(typeEvidence)) report.propertyType = 'house';
    else if (/\b(?:wohnung|apartment|eigentumswohnung|maisonette|penthouse)\b/i.test(typeEvidence)) report.propertyType = 'flat';
  }

  const roomsEvidence = verifiedEvidence(evidence.rooms, source);
  const rooms = roomsEvidence.match(/\b(\d+(?:[,.]\d+)?)\s*(?:Zimmer|Zi\.|rooms?)\b/i)?.[1];
  if (rooms) facts.rooms = rooms.replace('.', ',');

  const areaEvidence = verifiedEvidence(evidence.area, source);
  const area = areaEvidence.match(/(?:Wohnfl[aä]che|living\s+area)[^\d]{0,35}(\d+(?:[.,]\d+)?)\s*(?:m²|qm)/i)?.[1]
    || areaEvidence.match(/(\d+(?:[.,]\d+)?)\s*(?:m²|qm)[^\n]{0,35}(?:Wohnfl[aä]che|living\s+area)/i)?.[1];
  if (area && decimal(area) > 5 && decimal(area) < 2_000) facts.area = decimal(area);

  const occupancyEvidence = verifiedEvidence(evidence.occupancy, source);
  const occupancy = normalizedTenancy(occupancyEvidence, '');
  if (occupancy) facts.tenancy = occupancy;

  const conditionEvidence = verifiedEvidence(evidence.condition, source);
  const condition = normalizedCondition('', conditionEvidence);
  if (condition) facts.condition = condition;

  const yearEvidence = verifiedEvidence(evidence.year, source);
  const year = yearEvidence.match(/(?:Baujahr|built\s+in|errichtet|erbaut)\D{0,20}(18\d{2}|19\d{2}|20\d{2})/i)?.[1]
    || yearEvidence.match(/\b(18\d{2}|19\d{2}|20\d{2})\b\D{0,12}(?:errichtet|erbaut|built)/i)?.[1];
  if (year) facts.year = year;

  const floorEvidence = verifiedEvidence(evidence.floor, source);
  const floorRaw = floorEvidence.match(/(?:Etage|Geschoss|Stockwerk)\s*[:\-]?\s*((?:\d{1,2}\.?\s*(?:OG|Obergeschoss|Etage|Geschoss)?|EG|Erdgeschoss|DG|Dachgeschoss|Souterrain))/i)?.[1]
    || floorEvidence.match(/\b((?:\d{1,2}\.?\s*(?:OG|Obergeschoss)|EG|Erdgeschoss|DG|Dachgeschoss|Souterrain))\b/i)?.[1];
  const floor = normalizedFloor(floorRaw || '');
  if (floor) facts.floor = floor;

  const energyEvidence = verifiedEvidence(evidence.energy, source);
  const energy = energyEvidence.match(/(?:Energieeffizienzklasse|Energieklasse|energy\s+(?:efficiency\s+)?class)\s*[:\-]?\s*([A-H]\+?)(?![\p{L}\p{N}+])/iu)?.[1];
  if (energy) facts.energy = energy.toUpperCase();

  report.facts = facts;
  return report;
}

function sourceExcerpt(raw: string) {
  const lines = htmlToLines(raw);
  const prioritized = lines.filter(line => /(?:adresse|anschrift|lage|stadtteil|ortsteil|bezirk|kiez|mikrolage|straße|str\.|allee|weg|platz|gasse|damm|ufer|chaussee|ring|postleitzahl|\b\d{5}\b|u-?bahn|s-?bahn|bahnhof|haltestelle|wohnfl[aä]che|zimmer|aktuelle\s+nutzung|vermietet|bezugsfrei|leerstehend|eigengenutzt|zustand|baujahr|etage|geschoss|energieeffizienzklasse)/iu.test(line));
  return [...lines.slice(0, 120), ...prioritized.slice(0, 100)].filter((line, index, all) => all.indexOf(line) === index).join('\n').slice(0, 8_000);
}

export async function enrichAssessment(report: Report, sourceText = '', verifySourceFacts = true) {
  const { env } = await getCloudflareContext({ async: true });
  const fallback = {
    ...report,
    offerQuestions: validatedQuestions(report.offerQuestions, report, 'en') || defaultOfferQuestions(report, 'en'),
    offerQuestionsDe: validatedQuestions(report.offerQuestionsDe, report, 'de') || defaultOfferQuestions(report, 'de'),
    aiLocationChecked: verifySourceFacts ? false : report.aiLocationChecked,
    aiFactChecked: verifySourceFacts ? false : report.aiFactChecked,
  };
  if (!env.OPENROUTER_API_KEY) return refreshDerivedReport(fallback);

  const excerpt = sourceExcerpt(sourceText);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const parsedForCheck = {
    propertyType: report.propertyType,
    address: report.address,
    location: report.location,
    facts: {
      rooms: report.facts.rooms, area: report.facts.area, tenancy: report.facts.tenancy, condition: report.facts.condition,
      year: report.facts.year, floor: report.facts.floor, energy: report.facts.energy, city: report.facts.city,
      district: report.facts.district, street: report.facts.street, postalCode: report.facts.postalCode,
    },
  };
  const body = JSON.stringify({
    model: env.OPENROUTER_MODEL || 'openrouter/free', temperature: 0, max_tokens: 650,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You verify facts for German home buyers. Never invent or infer a fact. Every returned location and fact-evidence value must be copied verbatim from the property listing—not publisher, agency, legal notice, office, footer, or nearby-property text. A nearby station is only a transitStop. Keep questions plain, specific and under 20 words.' },
      { role: 'user', content: `Return JSON only: {"location":{"city":string|null,"postalCode":string|null,"district":string|null,"street":string|null,"transitStop":string|null,"evidence":string|null},"factEvidence":{"propertyType":string|null,"rooms":string|null,"area":string|null,"occupancy":string|null,"condition":string|null,"year":string|null,"floor":string|null,"energy":string|null},"offerQuestionsEn":["exactly four short questions"],"offerQuestionsDe":["exactly four short questions"]}. Each factEvidence value is one short verbatim excerpt that directly proves that fact; use null when absent or ambiguous. Occupancy must distinguish rented, available/vacant and owner-occupied. Street is only the property's stated street. Questions should cover the most material unresolved points without combining several requests into one. Parsed facts to check: ${JSON.stringify(parsedForCheck)}\nLISTING TEXT:\n${excerpt}` },
    ],
  });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'content-type': 'application/json' }, body, signal: controller.signal });
    if (!response.ok) {
      console.warn('OpenRouter enrichment unavailable', { status: response.status });
      return refreshDerivedReport(fallback);
    }
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.replace(/^```(?:json)?\s*|\s*```$/g, '') || '{}';
    const parsed = JSON.parse(content) as { location?: unknown; factEvidence?: unknown; offerQuestionsEn?: unknown; offerQuestionsDe?: unknown };
    const enriched = verifySourceFacts
      ? mergeVerifiedFacts(mergeLocation({ ...fallback, facts: { ...fallback.facts } }, parsed.location, sourceText), parsed.factEvidence, sourceText)
      : { ...fallback, facts: { ...fallback.facts } };
    const english = validatedQuestions(parsed.offerQuestionsEn, enriched, 'en');
    const german = validatedQuestions(parsed.offerQuestionsDe, enriched, 'de');
    enriched.offerQuestions = english || fallback.offerQuestions;
    enriched.offerQuestionsDe = german || fallback.offerQuestionsDe;
    enriched.aiEnriched = Boolean(english || german);
    enriched.aiLocationChecked = verifySourceFacts;
    enriched.aiFactChecked = verifySourceFacts;
    return refreshDerivedReport(enriched);
  } catch (error) {
    console.warn(error instanceof DOMException && error.name === 'AbortError' ? 'OpenRouter enrichment timed out' : 'OpenRouter enrichment returned invalid JSON');
    return refreshDerivedReport(fallback);
  } finally {
    clearTimeout(timeout);
  }
}

export const enrichOnlyWhenNeeded = enrichAssessment;
export function hasUsableLocation(report: Report) { return resolveLocation(report).basis !== 'none'; }
