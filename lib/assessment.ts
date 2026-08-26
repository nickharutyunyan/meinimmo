import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Report } from './types';
import { htmlToLines, looksLikePropertyListing, normalizedCondition, normalizedFloor, normalizedTenancy, parseListing, refreshDerivedReport } from './listing-parser';
import { displayAddress, resolveLocation } from './display';
import { offerQuestionsFor } from './report-copy';
import { listingAiExcerpt, parseAiJson } from './ai-input';

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
type AiFactEvidence = { propertyType?: unknown; price?: unknown; area?: unknown; rooms?: unknown; housegeld?: unknown; occupancy?: unknown; condition?: unknown; year?: unknown; floor?: unknown; energy?: unknown };

const FREE_VERIFICATION_MODELS = [
  'google/gemma-4-26b-a4b-it:free',
  'dots-studio/dots-3-note-preview:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
] as const;

function verificationModels(configured?: string) {
  return [...new Set([configured, ...FREE_VERIFICATION_MODELS].filter((model): model is string => Boolean(model)))].slice(0, 3);
}

function propertyStreetSupported(street: string, source: string, report: Report) {
  const normalizedStreet = normalizedEvidence(street);
  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    if (!normalizedEvidence(lines[index]).includes(normalizedStreet)) continue;
    const context = lines.slice(Math.max(0, index - 2), index + 2).join(' ');
    if (/\b(?:Makler|Anbieter|Anbietende|Gewerblich|Impressum|Immobilienb(?:ü|u)ro|Scout-ID|Objekt-ID|Kontakt)\b/i.test(context)) continue;
    const postals = [...context.matchAll(/\b(\d{5})\b/g)].map(match => match[1]);
    if (report.facts.postalCode && postals.length && !postals.includes(report.facts.postalCode)) continue;
    if (/\b(?:Adresse|Anschrift|Straße|Lage)\s*[:\-]|\b(?:nahe|Nähe|unweit|bei|direkt\s+(?:an|bei)|gelegen\s+(?:an|bei)|in\s+der)\b/iu.test(context)) return true;
    if (report.facts.postalCode && postals.includes(report.facts.postalCode)) return true;
  }
  return false;
}

function mergeLocation(report: Report, value: unknown, searchableSource: string) {
  if (!value || typeof value !== 'object') return report;
  const location = value as AiLocation;
  const city = validPlace(location.city, searchableSource);
  const district = validPlace(location.district, searchableSource);
  const street = validPlace(location.street, searchableSource, 100).replace(/,?\s*\b\d{5}\b[\s\S]*$/u, '').replace(/\s+0\s*$/u, '').trim();
  const stop = validPlace(location.transitStop, searchableSource);
  const postal = typeof location.postalCode === 'string' && /^\d{5}$/.test(location.postalCode.trim()) && sourceContains(searchableSource, location.postalCode.trim()) ? location.postalCode.trim() : '';
  const evidence = typeof location.evidence === 'string' && sourceContains(searchableSource, location.evidence) ? location.evidence.trim().slice(0, 240) : '';

  if (city && !report.facts.city) report.facts.city = city;
  if (postal && !report.facts.postalCode) report.facts.postalCode = postal;
  const improvesDistrict = district && (!report.facts.district || (/kiez$/i.test(district) && !/kiez$/i.test(report.facts.district)));
  if (improvesDistrict) {
    report.facts.district = district;
    report.location = district;
  } else if (city && !report.facts.district) report.location = city;
  if (stop) report.facts.transitStop = stop;
  if (street && propertyStreetSupported(street, searchableSource, report) && /(?:straße|str\.?|allee|weg|platz|gasse|damm|ufer|chaussee|ring|steig)\b/iu.test(street)) {
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

function mergeVerifiedFacts(report: Report, value: unknown, source: string) {
  if (!value || typeof value !== 'object') return report;
  const evidence = value as AiFactEvidence;
  const facts = { ...report.facts };

  const typeEvidence = verifiedEvidence(evidence.propertyType, source);
  if (typeEvidence) {
    if (/\b(?:einfamilienhaus|reihenhaus|doppelhaush[aä]lfte|wohnhaus|single.family\s+home|detached\s+house|\bhouse\b)\b/i.test(typeEvidence)) report.propertyType = 'house';
    else if (/\b(?:wohnung|apartment|eigentumswohnung|maisonette|penthouse)\b/i.test(typeEvidence)) report.propertyType = 'flat';
  }

  const priceEvidence = verifiedEvidence(evidence.price, source);
  const price = priceEvidence.match(/\bKaufpreis\s*[:\-]?\s*([\d.]+(?:,\d+)?)\s*(?:€|EUR)(?!\s*\/\s*(?:m²|qm))/i)?.[1];
  const verifiedPrice = price ? decimal(price) : 0;
  if (verifiedPrice >= 20_000 && verifiedPrice <= 100_000_000) facts.price = verifiedPrice;

  const roomsEvidence = verifiedEvidence(evidence.rooms, source);
  const rooms = roomsEvidence.match(/\b(\d+(?:[,.]\d+)?)\s*(?:Zimmer|Zi\.|rooms?)\b/i)?.[1];
  if (rooms) facts.rooms = rooms.replace('.', ',');

  const areaEvidence = verifiedEvidence(evidence.area, source);
  const area = areaEvidence.match(/(?:Wohnfl[aä]che|living\s+area)[^\d]{0,35}(\d+(?:[.,]\d+)?)\s*(?:m²|qm)/i)?.[1]
    || areaEvidence.match(/(\d+(?:[.,]\d+)?)\s*(?:m²|qm)[^\n]{0,35}(?:Wohnfl[aä]che|living\s+area)/i)?.[1];
  if (area && decimal(area) > 5 && decimal(area) < 2_000) facts.area = decimal(area);

  const housegeldEvidence = verifiedEvidence(evidence.housegeld, source);
  const housegeld = housegeldEvidence.match(/\bHausgeld\s*[:\-]?\s*([\d.]+(?:,\d+)?)\s*(?:€|EUR)/i)?.[1];
  if (housegeld && decimal(housegeld) > 0 && decimal(housegeld) < 20_000) facts.housegeld = decimal(housegeld);

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
  const floorRaw = floorEvidence.match(/\bTyp\s*[:\-]?\s*(Hochparterre)\b/i)?.[1]
    || floorEvidence.match(/(?:Etage|Geschoss|Stockwerk)\s*[:\-]?\s*((?:\d{1,2}\.?\s*(?:OG|Obergeschoss|Etage|Geschoss)?|EG|Erdgeschoss|DG|Dachgeschoss|Souterrain))/i)?.[1]
    || floorEvidence.match(/\b((?:\d{1,2}\.?\s*(?:OG|Obergeschoss)|EG|Erdgeschoss|DG|Dachgeschoss|Souterrain))\b/i)?.[1];
  const floor = normalizedFloor(floorRaw || '');
  if (floor && (facts.floor === 'not stated' || floor === 'Hochparterre' || facts.floor !== 'Hochparterre')) facts.floor = floor;

  const energyEvidence = verifiedEvidence(evidence.energy, source);
  const energy = energyEvidence.match(/(?:Energieeffizienzklasse|Energieklasse|energy\s+(?:efficiency\s+)?class)\s*[:\-]?\s*([A-H]\+?)(?![\p{L}\p{N}+])/iu)?.[1];
  if (energy) facts.energy = energy.toUpperCase();

  report.facts = facts;
  return report;
}

export async function enrichAssessment(report: Report, sourceText = '', verifySourceFacts = true, timeoutMs = verifySourceFacts ? 8_000 : 10_000) {
  const { env } = await getCloudflareContext({ async: true });
  const fallback = {
    ...report,
    offerQuestions: validatedQuestions(report.offerQuestions, report, 'en') || defaultOfferQuestions(report, 'en'),
    offerQuestionsDe: validatedQuestions(report.offerQuestionsDe, report, 'de') || defaultOfferQuestions(report, 'de'),
    aiLocationChecked: verifySourceFacts ? false : report.aiLocationChecked,
    aiFactChecked: verifySourceFacts ? false : report.aiFactChecked,
  };
  if (!env.OPENROUTER_API_KEY) return refreshDerivedReport(fallback);

  const sourceLines = verifySourceFacts ? htmlToLines(sourceText) : [];
  const searchableSource = sourceLines.join('\n');
  const excerpt = verifySourceFacts ? listingAiExcerpt(sourceLines) : '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const parsedForCheck = {
    propertyType: report.propertyType,
    address: report.address,
    location: report.location,
    facts: {
      price: report.facts.price, rooms: report.facts.rooms, area: report.facts.area, housegeld: report.facts.housegeld,
      tenancy: report.facts.tenancy, condition: report.facts.condition,
      year: report.facts.year, floor: report.facts.floor, energy: report.facts.energy, city: report.facts.city,
      district: report.facts.district, street: report.facts.street, postalCode: report.facts.postalCode,
    },
  };
  const questionContext = {
    propertyType: report.propertyType,
    facts: report.facts,
    qualityWarnings: report.qualityWarnings,
    considerations: report.considerations,
  };
  const body = JSON.stringify({
    models: verificationModels(env.OPENROUTER_MODEL),
    provider: { sort: { by: 'throughput', partition: 'none' }, require_parameters: true, allow_fallbacks: true },
    reasoning: { effort: 'none' },
    temperature: 0,
    max_tokens: verifySourceFacts ? 420 : 360,
    response_format: { type: 'json_object' },
    messages: verifySourceFacts ? [
      { role: 'system', content: 'Verify German property-listing facts. Never invent or infer. Every value must be supported by a short verbatim excerpt from this property listing, never publisher, agency, legal, office, footer or nearby-property text. A nearby station is only a transitStop.' },
      { role: 'user', content: `Return JSON only: {"location":{"city":string|null,"postalCode":string|null,"district":string|null,"street":string|null,"transitStop":string|null,"evidence":string|null},"factEvidence":{"propertyType":string|null,"price":string|null,"rooms":string|null,"area":string|null,"housegeld":string|null,"occupancy":string|null,"condition":string|null,"year":string|null,"floor":string|null,"energy":string|null}}. Evidence values must be short verbatim excerpts; use null if absent or ambiguous. Price evidence must include the explicit Kaufpreis label and amount, never price per m², financing, total costs or monthly payments. Occupancy must distinguish rented from explicitly not rented; do not infer it when unstated. Street is only the property's stated or explicitly nearby street, never an agency or contact address. Parsed facts to verify: ${JSON.stringify(parsedForCheck)}\nLISTING:\n${excerpt}` },
    ] : [
      { role: 'system', content: 'Write concise due-diligence questions for German home buyers. Ask only about material unresolved risks in the supplied property report. Keep each question plain, specific, under 20 words and limited to one request.' },
      { role: 'user', content: `Return JSON only: {"offerQuestionsEn":["exactly four English questions"],"offerQuestionsDe":["exactly four German questions"]}. Do not repeat known facts as questions. PROPERTY REPORT:\n${JSON.stringify(questionContext)}` },
    ],
  });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'content-type': 'application/json', 'HTTP-Referer': 'https://reviewahouse.com', 'X-Title': 'ReviewAHouse' }, body, signal: controller.signal });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      console.warn('OpenRouter enrichment unavailable', { status: response.status, detail });
      return refreshDerivedReport(fallback);
    }
    const data = await response.json() as { model?: string; choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = parseAiJson(content) as { location?: unknown; factEvidence?: unknown; offerQuestionsEn?: unknown; offerQuestionsDe?: unknown };
    const enriched = verifySourceFacts
      ? mergeVerifiedFacts(mergeLocation({ ...fallback, facts: { ...fallback.facts } }, parsed.location, searchableSource), parsed.factEvidence, searchableSource)
      : { ...fallback, facts: { ...fallback.facts } };
    const english = verifySourceFacts ? undefined : validatedQuestions(parsed.offerQuestionsEn, enriched, 'en');
    const german = verifySourceFacts ? undefined : validatedQuestions(parsed.offerQuestionsDe, enriched, 'de');
    enriched.offerQuestions = english || fallback.offerQuestions;
    enriched.offerQuestionsDe = german || fallback.offerQuestionsDe;
    enriched.aiEnriched = verifySourceFacts ? false : Boolean(english && german);
    enriched.aiLocationChecked = verifySourceFacts;
    enriched.aiFactChecked = verifySourceFacts;
    console.info('OpenRouter enrichment complete', { purpose: verifySourceFacts ? 'facts' : 'questions', model: data.model || 'unknown' });
    return refreshDerivedReport(enriched);
  } catch (error) {
    console.warn(error instanceof DOMException && error.name === 'AbortError' ? 'OpenRouter enrichment timed out' : 'OpenRouter enrichment returned invalid JSON', { message: error instanceof Error ? error.message : 'unknown error' });
    return refreshDerivedReport(fallback);
  } finally {
    clearTimeout(timeout);
  }
}

export const enrichOnlyWhenNeeded = enrichAssessment;
export function hasUsableLocation(report: Report) { return resolveLocation(report).basis !== 'none'; }
