import 'server-only';
import crypto from 'node:crypto';
import { Report } from './types';
import { displayAddress } from './display';

const clean = (v: string) => v.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]*>/gi, ' ').replace(/\s+/g, ' ').trim();
const match = (text: string, rx: RegExp) => text.match(rx)?.[1]?.trim();
const num = (value?: string) => value ? Number(value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '')) : 0;
const street = (value: string) => {
  const text = value.replace(/\b(?:provisionsfrei|wohnung|eigentumswohnung|haus|kauf|verkauf)\b/gi, ' ');
  return match(text, /\b([A-ZÄÖÜ][\wäöüß.-]*(?:\s+[A-ZÄÖÜ][\wäöüß.-]*){0,2}\s+(?:Straße|Str\.|Allee|Weg|Platz|Gasse)\s+\d{1,3}[a-z]?)\b/) || match(text, /\b([A-ZÄÖÜ][\wäöüß.-]*(?:straße|str\.|allee|weg|platz|gasse)\s+\d{1,3}[a-z]?)\b/i) || '';
};

const listingLocation = (raw: string, text: string, source: string) => {
  const jsonLocation = match(raw, /"(?:neighborhood|addressLocality|addressRegion|district|borough|suburb)"\s*:\s*"([^"\\]{2,60})"/i);
  const labeled = match(text, /\b(?:Mikrolage|Kiez|Stadtteil|Ortsteil|Bezirk)\s*[:\-]?\s*([A-ZÄÖÜ][\p{L}äöüß-]{2,}(?:\s+[A-ZÄÖÜ][\p{L}äöüß-]{2,})?)/u);
  const berlinArea = match(`${text} ${source}`, /\bBerlin[-_\s]+([A-ZÄÖÜ][\p{L}äöüß-]{2,})/u);
  return clean(jsonLocation || labeled || berlinArea || '');
};

export function looksLikeListing(text: string) {
  const unavailable = /seite\s+nicht\s+gefunden|page\s+not\s+found|nicht\s+(mehr\s+)?verf[uü]gbar/i.test(text);
  const signals = [/(?:kaufpreis|mietpreis|preis)\s*[:\-]?\s*[\d.]+(?:,\d+)?\s*(?:€|eur)/i, /\b\d{2,3}(?:[.\s]\d{3})+\s*€/i, /(?:wohnfl[aä]che|fl[aä]che)\s*(?:ca\.)?\s*[:\-]?\s*[\d.,]+\s*(?:m²|qm)/i, /\b\d{1,4}\s*(?:m²|qm)\b/i, /\b[\d,]+\s*(?:zimmer|zi\.)/i, /\b\d{5}\s+[A-ZÄÖÜ]/, /(?:baujahr|energieausweis|heizungsart|etage|geschoss)/i, /(?:expos[eé]|eigentumswohnung|wohnung\s+zum\s+kauf|haus\s+zum\s+kauf|provision)/i];
  return !unavailable && signals.filter(rx => rx.test(text)).length >= 3;
}

export function deterministicAssessment(raw: string, source: string): Report {
  const text = clean(raw); const price = num(match(text, /(?:Kaufpreis|Preis)\s*[:\-]?\s*([\d.]+(?:,\d+)?)\s*(?:€|EUR)/i) || match(text, /\b([\d]{2,3}(?:[.\s]\d{3})+)\s*€/)); const area = num(match(text, /(?:Wohnfl[aä]che|Fl[aä]che)\s*(?:ca\.)?\s*[:\-]?\s*([\d.,]+)\s*(?:m²|qm)/i) || match(text, /\b([\d.,]+)\s*(?:m²|qm)/i));
  const rooms = match(text, /([\d,]+)\s*(?:Zimmer|Zi\.)/i) || 'not stated'; const year = match(text, /(?:Baujahr|erbaut)\s*[:\-]?\s*(\d{4})/i) || 'not stated'; const floor = match(text, /\b(?:Etage|Geschoss|Stockwerk)\b\s*[:\-]?\s*((?:\d{1,2}\.?\s*(?:OG|Obergeschoss)|EG|Erdgeschoss|Dachgeschoss|Souterrain))/i) || match(text, /\b(\d{1,2}\.?\s*OG)\b/i) || 'not stated';
  const energy = match(text, /(?:Energieeffizienzklasse|Effizienzklasse)\s*[:\-]?\s*([A-H][+]?)/i) || 'not stated'; const heating = match(text, /(?:Heizungsart|Heizung)\s*[:\-]?\s*([^,.]{1,40})/i) || 'not stated'; const foundAddress = match(text, /([A-ZÄÖÜ][\wäöüß.\- ]*(?:straße|str\.|allee|weg|platz|gasse)\s+\d{1,3}[a-z]?,?\s*\d{5}\s+[A-ZÄÖÜ][\wäöüß.\- ]+)/i); const address = foundAddress ? displayAddress(foundAddress) : 'Address not stated'; const location = listingLocation(raw, text, source); const titleLocation = street(address) || location;
  const propertyType: 'flat' | 'house' = /(?:einfamilienhaus|reihenhaus|doppelhaush[aä]lfte|haus\s+zum\s+kauf)/i.test(text) ? 'house' : 'flat'; const score = energy === 'not stated' ? 6.8 : ['A+','A','B','C'].includes(energy) ? 8.2 : ['D','E'].includes(energy) ? 7.3 : 6.2;
  const base = { id: crypto.randomUUID().replace(/-/g, '').slice(0,16), title: `${rooms}-room ${propertyType}${titleLocation ? ` · ${titleLocation}` : ''}`, address, location, propertyType, source, createdAt: new Date().toISOString(), facts: { price, area, rooms, year, floor, energy, heating, totalCost: Math.round(price * 1.1028) }, score, summary: `${rooms}-room ${propertyType} with ${area ? `${area} m²` : 'unconfirmed area'}${price ? ` at €${price.toLocaleString('de-DE')}` : ''}. The source indicates ${year === 'not stated' ? 'no confirmed construction year' : `construction in ${year}`} and energy class ${energy}.`, considerations: [floor === 'not stated' ? 'Confirm floor, lift access and daily stair use during viewing.' : `Verify the ${floor} floor, orientation and direct daylight during viewing.`, energy === 'not stated' ? 'Request the Energieausweis before making an offer.' : `Review running costs and the upgrade path for energy class ${energy} and ${heating}.`, 'Ask for WEG minutes, maintenance reserve and planned Sonderumlagen.'], sunOrientation: 'not stated', aiEnriched: false } satisfies Report;
  return { ...base, offerQuestions: defaultOfferQuestions(base) };
}

export function defaultOfferQuestions(report: Report) {
  const questions = [
    report.facts.energy === 'not stated' ? 'Can you provide the valid Energieausweis and the building’s measured energy consumption?' : `Which funded or planned measures address the building’s energy class ${report.facts.energy} and ${report.facts.heating} heating?`,
    'What is the current WEG maintenance reserve, and are any Sonderumlagen already discussed or approved?',
    'Can you provide the last three WEG meeting minutes, annual statements and current Wirtschaftsplan?',
    report.facts.floor === 'not stated' ? 'Which floor is the property on, is there a lift, and who is responsible for lift maintenance?' : `Are there any access, noise or lift issues specific to the ${report.facts.floor} floor?`
  ];
  return questions;
}

export async function enrichOnlyWhenNeeded(report: Report, sourceText: string) {
  if (!process.env.OPENROUTER_API_KEY) return report;
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini', temperature: 0.1, max_tokens: 450, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'You are a cautious German residential property buyer advocate. Never invent a fact. Questions must be specific, concise, and useful before an offer.' }, { role: 'user', content: `Review this assessment and source. Return JSON only: {"floor":"explicit value or empty","energy":"explicit value or empty","heating":"explicit value or empty","sunOrientation":"explicit value or not stated","offerQuestions":["exactly four bespoke questions"]}. Prioritize risks specific to this property: WEG finances, renovations, energy/heating, floor/light/noise, tenancy, legal status or missing documents. Do not ask generic questions when a more specific one is possible. Assessment: ${JSON.stringify(report)} Source excerpt: ${sourceText.slice(0,18000)}` }] }) });
  if (!response.ok) return report; const data = await response.json(); try { const extra = JSON.parse(data.choices?.[0]?.message?.content || '{}'); const questions=Array.isArray(extra.offerQuestions)&&extra.offerQuestions.length>=3?extra.offerQuestions.slice(0,5):report.offerQuestions; return { ...report, facts: { ...report.facts, floor: extra.floor || report.facts.floor, energy: extra.energy || report.facts.energy, heating: extra.heating || report.facts.heating }, offerQuestions:questions, sunOrientation: extra.sunOrientation || 'not stated', aiEnriched: true }; } catch { return report; }
}
