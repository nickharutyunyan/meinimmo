import { area, money } from './format.ts';
import type { Locale } from './i18n.ts';

const AMOUNT = String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)`;

function deNumber(raw: string) {
  const clean = raw.replace(/\s/g, '');
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(clean)) return Number(clean.replace(/\./g, '').replace(',', '.'));
  if (clean.includes(',')) return Number(clean.replace(',', '.'));
  return Number(clean);
}

function push(parts: string[], gloss: string) {
  if (gloss && !parts.includes(gloss)) parts.push(gloss);
}

function orientationOnly(quote: string) {
  const rest = quote
    .replace(/süd- und west-ausrichtung/gi, '')
    .replace(/südwest|südost|nordwest|nordost|süd|nord|ost|west|ausrichtung/gi, '')
    .replace(/[^a-zäöü]/gi, '');
  return rest.length === 0;
}

function englishGloss(quote: string) {
  if (orientationOnly(quote)) return '';
  const parts: string[] = [];

  for (const match of quote.matchAll(new RegExp(String.raw`Kaufpreis\s*:?\s*${AMOUNT}\s*(?:€|EUR)(?!\s*\/)`, 'gi'))) {
    const amount = deNumber(match[1]);
    if (amount) push(parts, `purchase price ${money(amount, 'en')}`);
  }
  for (const match of quote.matchAll(new RegExp(String.raw`${AMOUNT}\s*m²\s*Wohnfläche`, 'gi'))) {
    push(parts, `${area(deNumber(match[1]), 'en')} living area`);
  }
  for (const match of quote.matchAll(new RegExp(String.raw`Wohnfläche(?:\s+beträgt)?(?:\s+ca\.)?\s+${AMOUNT}\s*m²`, 'gi'))) {
    push(parts, `${area(deNumber(match[1]), 'en')} living area`);
  }
  for (const match of quote.matchAll(new RegExp(String.raw`Kaufnebenkosten(?:\s+ca\.)?\s*${AMOUNT}\s*(?:€|EUR)`, 'gi'))) {
    push(parts, `ancillary costs ${money(deNumber(match[1]), 'en')}`);
  }
  for (const match of quote.matchAll(new RegExp(String.raw`Hausgeld[\s\S]{0,80}?${AMOUNT}\s*(?:€|EUR)`, 'gi'))) {
    push(parts, `Hausgeld ${money(deNumber(match[1]), 'en')} per month`);
  }

  const use = quote.match(/Aktuelle Nutzung\s+(Nicht vermietet|Vermietet|Eigennutzung)/i);
  if (use) {
    const value = use[1].toLowerCase();
    push(parts, value === 'vermietet' ? 'current use: rented' : value === 'nicht vermietet' ? 'current use: not rented' : 'current use: owner-occupied');
  }
  if (/provisionsfrei/i.test(quote)) push(parts, 'commission-free for the buyer');
  if (/vollständig vermietet/i.test(quote)) push(parts, 'fully rented');
  if (/sofortige einnahmen/i.test(quote)) push(parts, 'immediate income');
  if (/sperrfrist nach §\s*577a bgb besteht nicht mehr/i.test(quote)) push(parts, 'a conversion lock-up under § 577a of the German Civil Code no longer applies');
  if (/denkmalschutzobjekt\s+ja/i.test(quote)) push(parts, 'listed building: yes');
  if (/pachtgrundstück/i.test(quote)) push(parts, 'the plot is leased land (Pacht)');
  if (/bis ende november 2026 vermietet/i.test(quote)) push(parts, 'the flat is rented until the end of November 2026');
  if (/wurde im jahr 2020 saniert/i.test(quote)) push(parts, 'the flat was renovated in 2020');

  return parts.join('; ');
}

export function glossListingQuote(quote: string, locale: Locale) {
  if (locale !== 'en') return quote;
  const gloss = englishGloss(quote);
  if (!gloss) return quote;
  return `${quote} (${gloss})`;
}
