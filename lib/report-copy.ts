import { localizedValue, type Locale } from './i18n.ts';
import type { Report } from './types';
import { factualLocation } from './display.ts';

const UNKNOWN = /not stated|unknown/i;
const stated = (value?: string) => Boolean(value && !UNKNOWN.test(value));

export function isObviousAddressQuestion(value: string) {
  const mentionsAddress = /\b(?:street\s+address|address|straßenadresse|strassenadresse|adresse|anschrift)\b/i.test(value);
  const asksForExactness = /\b(?:exact|full|precise|specific|genaue[nrsm]?|exakte[nrsm]?|vollständige[nrsm]?)\b/i.test(value);
  return mentionsAddress && asksForExactness;
}

export function questionsAreConcise(value: unknown): value is string[] {
  return Array.isArray(value) && value.length === 4 && value.every(item => typeof item === 'string'
    && item.trim().length >= 12
    && item.length <= 180
    && item.split(/\s+/).length <= 30
    && !isObviousAddressQuestion(item));
}

export function localizedSummary(report: Report, locale: Locale) {
  if (locale === 'en') {
    const correctedCondition = localizedValue(report.facts.condition, 'en') === 'Renovated'
      ? report.summary.replace(/described as (?:saniert|renoviert|new condition|like new)/i, 'described as renovated')
      : report.summary;
    return correctedCondition
    .replace('The listing states that it is available to move into; confirm the handover date in the purchase contract.', 'The listing states that it is not rented; confirm the handover date and vacant possession in the purchase contract.')
    .replace('It is described as owner-occupied; confirm the agreed handover date and vacant possession in the purchase contract.', 'The listing states that it is not rented; confirm the handover date and vacant possession in the purchase contract.');
  }
  const { facts } = report;
  const type = report.propertyType === 'flat' ? 'Wohnung' : 'Haus';
  const roomPrefix = stated(facts.rooms) ? `${facts.rooms.replace('.', ',')}-Zimmer-` : '';
  const factualPlace = factualLocation(report);
  const place = factualPlace ? ` in ${factualPlace}` : '';
  const space = facts.area
    ? ` hat ${facts.area.toLocaleString('de-DE', { maximumFractionDigits: 1 })} m² Wohnfläche${facts.usableArea ? ` und ${facts.usableArea.toLocaleString('de-DE', { maximumFractionDigits: 1 })} m² Nutzfläche` : ''}`
    : '';
  const price = facts.price ? ` Der Kaufpreis liegt bei ${facts.price.toLocaleString('de-DE')} €${facts.area ? ` (${Math.round(facts.price / facts.area).toLocaleString('de-DE')} €/m²)` : ''}.` : '';
  const building = [
    stated(facts.year) ? `Baujahr ${facts.year}` : '',
    stated(facts.condition) ? `Zustand laut Angebot: ${localizedValue(facts.condition, 'de')}` : '',
    stated(facts.energy) ? `Energieklasse ${facts.energy}` : '',
    facts.energySource ? `Energieträger ${facts.energySource}` : '',
  ].filter(Boolean).join(', ');
  const first = `Diese ${roomPrefix}${type}${place}${space}.${price}${building ? ` Dazu kommen ${building}.` : ''}`;
  const occupancy = facts.tenancy === 'Rented'
    ? `Die Immobilie wird vermietet verkauft${facts.advertisedYield ? `; angegeben sind ${facts.advertisedYield.toLocaleString('de-DE', { maximumFractionDigits: 2 })} % Rendite` : ''}. Lass dir Nettokaltmiete, Mietvertrag und Renditerechnung zeigen.`
    : ['Not rented', 'Available to move in', 'Vacant', 'Owner-occupied'].includes(facts.tenancy || '')
      ? 'Laut Angebot ist die Immobilie nicht vermietet. Kläre den Termin der freien Übergabe im Kaufvertrag.'
      : '';
  const costs = facts.housegeld ? ` Das Hausgeld liegt laut Angebot bei ${facts.housegeld.toLocaleString('de-DE')} € im Monat. Wichtig ist die Trennung zwischen umlagefähigem und eigenem Anteil.` : '';
  const second = `${occupancy}${costs}`.trim();
  return second ? `${first}\n\n${second}` : first;
}

export function localizedConsiderations(report: Report, locale: Locale) {
  if (locale === 'en') return report.considerations;
  const { facts } = report;
  const items: string[] = [];
  if (facts.tenancy === 'Rented') items.push('Prüfe Mietvertrag, Nettokaltmiete und Zahlungshistorie.');
  if (facts.housegeld) items.push(`Prüfe die Aufteilung der ${facts.housegeld.toLocaleString('de-DE')} € Hausgeld und den Stand der WEG-Rücklage.`);
  if (!stated(facts.floor)) items.push('Kläre Etage, Aufzug sowie Straßen- oder Hoflage.');
  if (stated(facts.energy)) items.push(`Vergleiche den ${facts.energyCertificate || 'Energieausweis'} mit echten Energieabrechnungen.`);
  if (facts.features?.some((feature) => /terrasse|garten/i.test(feature))) items.push('Prüfe, ob Terrasse und Garten rechtlich in der Teilungserklärung stehen und wer für die Pflege zuständig ist.');
  if (!items.length) items.push('Fordere das vollständige Exposé, den Energieausweis, WEG-Unterlagen und eine klare Aufstellung der laufenden Kosten an.');
  return items.slice(0, 4);
}

export function localizedWarnings(report: Report, locale: Locale) {
  if (locale === 'en') return report.qualityWarnings || [];
  return (report.qualityWarnings || []).map((warning) => {
    if (/exact street address/i.test(warning)) return 'Die genaue Straßenadresse steht nicht im Angebot.';
    if (/exact floor/i.test(warning)) return 'Die genaue Etage steht nicht im Angebot.';
    if (/complete acquisition total/i.test(warning)) return 'Im Angebot fehlt eine vollständige Gesamtsumme. Die Finanzierung nutzt deshalb eine grobe Schätzung der Kaufnebenkosten.';
    if (/rented but no verified yield/i.test(warning)) return 'Die Immobilie ist vermietet, aber es wurde keine verlässliche Renditeangabe gefunden.';
    return warning;
  });
}

export function offerQuestionsFor(report: Report, locale: Locale = 'en') {
  const { facts } = report;
  const questions: string[] = [];
  if (locale === 'de') {
    if (facts.tenancy === 'Rented') questions.push('Kann ich den Mietvertrag, die aktuelle Nettokaltmiete und die Zahlungshistorie sehen?');
    else if (['Not rented', 'Available to move in', 'Vacant', 'Owner-occupied'].includes(facts.tenancy || '')) questions.push('Wann wird die Immobilie vollständig frei übergeben?');
    else questions.push('Ist die Immobilie bei der Übergabe vermietet oder frei?');
    if (report.propertyType === 'flat') questions.push('Wie hoch ist die WEG-Rücklage, und sind Sonderumlagen geplant?');
    if (facts.housegeld) questions.push(`Wie teilen sich die ${facts.housegeld.toLocaleString('de-DE')} € Hausgeld in umlagefähige und eigene Kosten?`);
    if (/Needs renovation|Needs modernization/i.test(facts.condition || '')) questions.push('Welche Arbeiten sind nötig, und gibt es dafür Kostenvoranschläge?');
    if (!stated(facts.floor) && report.propertyType === 'flat') questions.push('In welcher Etage liegt die Wohnung, und gibt es einen Aufzug?');
    questions.push('Kann ich den Energieausweis und die letzten Energieabrechnungen sehen?');
    questions.push('Gibt es bekannte Mängel, Baulasten oder Dienstbarkeiten?');
    return questions.slice(0, 4);
  }

  if (facts.tenancy === 'Rented') questions.push('May I see the lease, current net cold rent and payment history?');
  else if (['Not rented', 'Available to move in', 'Vacant', 'Owner-occupied'].includes(facts.tenancy || '')) questions.push('When will the property be handed over vacant?');
  else questions.push('Will the property be rented or vacant at handover?');
  if (report.propertyType === 'flat') questions.push('What is the WEG reserve, and are any Sonderumlagen planned?');
  if (facts.housegeld) questions.push(`How is the €${facts.housegeld.toLocaleString('de-DE')} Hausgeld split between recoverable and owner-only costs?`);
  if (/Needs renovation|Needs modernization/i.test(facts.condition || '')) questions.push('Which repairs are necessary, and are contractor estimates available?');
  if (!stated(facts.floor) && report.propertyType === 'flat') questions.push('Which floor is the unit on, and is there a lift?');
  questions.push('May I see the Energieausweis and recent energy bills?');
  questions.push('Are there known defects, Baulasten or registered Dienstbarkeiten?');
  return questions.slice(0, 4);
}
