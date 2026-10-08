import { localizedValue, type Locale } from './i18n.ts';
import type { Report } from './types';
import { factualLocation } from './display.ts';
import { formatAvailabilityDate } from './availability.ts';
import { isNewOrFirstOccupancy } from './property-condition.ts';
import { groundLeaseSentence, highFlagQuestions, tenancyConflictSentence } from './red-flags.ts';
import { buyerCostDivergenceNote } from './buyer-costs.ts';

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
  const house = report.propertyType === 'house';
  const type = house ? 'Haus' : 'Wohnung';
  const roomPrefix = stated(facts.rooms) ? `${facts.rooms.replace('.', ',')}-Zimmer-` : '';
  const factualPlace = factualLocation(report);
  const place = factualPlace ? ` in ${factualPlace}` : '';
  const plot = facts.plotArea && house ? ` auf einem ${facts.plotArea.toLocaleString('de-DE')} m² Grundstück` : '';
  const space = facts.area
    ? ` hat ${facts.area.toLocaleString('de-DE', { maximumFractionDigits: 1 })} m² Wohnfläche${facts.usableArea ? ` und ${facts.usableArea.toLocaleString('de-DE', { maximumFractionDigits: 1 })} m² Nutzfläche` : ''}${plot}`
    : '';
  const price = facts.price ? ` Der Kaufpreis liegt bei ${facts.price.toLocaleString('de-DE')} €${facts.area ? ` (${Math.round(facts.price / facts.area).toLocaleString('de-DE')} €/m²)` : ''}.` : '';
  const building = [
    stated(facts.year) ? `Baujahr ${facts.year}` : '',
    facts.construction === 'Timber frame' ? 'Holzbau (Holzständer)' : '',
    stated(facts.condition) ? `Zustand laut Angebot: ${localizedValue(facts.condition, 'de')}` : '',
    stated(facts.energy) ? `Energieklasse ${facts.energy}` : '',
    facts.energySource ? `Energieträger ${facts.energySource}` : '',
  ].filter(Boolean).join(', ');
  const first = `${house ? 'Dieses' : 'Diese'} ${roomPrefix}${type}${place}${space}.${price}${building ? ` Dazu kommen ${building}.` : ''}`;
  const availableFrom = formatAvailabilityDate(facts.availabilityDate, 'de');
  const occupancy = facts.tenancyConflict
    ? tenancyConflictSentence(facts, 'de')
    : facts.tenancy === 'Occupancy unclear' ? 'Das Portal meldet nicht vermietet, die Beschreibung nennt aber noch Bewohner. Kläre deren rechtlichen Status und die freie Übergabe.' : availableFrom && facts.tenancy !== 'Rented'
    ? `Laut Angebot ist die Immobilie ab ${availableFrom} bezugsfrei. Sichere die freie Übergabe zu diesem Termin im Kaufvertrag ab.`
    : facts.tenancy === 'Rented'
    ? `Die Immobilie wird vermietet verkauft${facts.advertisedYield ? `; angegeben sind ${facts.advertisedYield.toLocaleString('de-DE', { maximumFractionDigits: 2 })} % Rendite` : ''}. Lass dir Nettokaltmiete, Mietvertrag und Renditerechnung zeigen.`
    : ['Not rented', 'Available to move in', 'Vacant', 'Owner-occupied'].includes(facts.tenancy || '')
      ? 'Laut Angebot ist die Immobilie nicht vermietet. Kläre den Termin der freien Übergabe im Kaufvertrag.'
      : '';
  const costs = facts.housegeld && !house ? ` Das Hausgeld${facts.housegeldYear ? ` für ${facts.housegeldYear}` : ''} liegt laut Angebot bei ${facts.housegeld.toLocaleString('de-DE')} € im Monat. Wichtig ist die Trennung zwischen umlagefähigem und eigenem Anteil.` : '';
  const asIs = facts.soldAsIs
    ? (house ? 'Das Haus wird im Ist-Zustand verkauft.' : 'Die Einheit wird im Ist-Zustand verkauft.')
    : '';
  const honest = [asIs, groundLeaseSentence(facts, 'de')].filter(Boolean).join(' ');
  const second = `${occupancy}${honest ? ` ${honest}` : ''}${costs}`.trim();
  return second ? `${first}\n\n${second}` : first;
}

export function localizedConsiderations(report: Report, locale: Locale) {
  if (locale === 'en') return report.considerations;
  const { facts } = report;
  const items: string[] = [];
  if (facts.tenancy === 'Occupancy unclear') items.push('Kläre den rechtlichen Status der Bewohner und eine verbindliche Vereinbarung zur freien Übergabe.');
  if (facts.tenancy === 'Rented') items.push('Prüfe Mietvertrag, Nettokaltmiete und Zahlungshistorie.');
  const house = report.propertyType === 'house';
  if (facts.housegeld && !house) {
    items.push(isNewOrFirstOccupancy(facts.condition)
      ? `Prüfe, wie sich die ${facts.housegeld.toLocaleString('de-DE')} € Hausgeld auf laufende Gemeinschafts- und Eigentümerkosten verteilen.`
      : `Prüfe die Aufteilung der ${facts.housegeld.toLocaleString('de-DE')} € Hausgeld und lass dir den aktuellen Stand der WEG-Rücklage zeigen.`);
  }
  if (!stated(facts.floor) && !house) items.push('Kläre Etage, Aufzug sowie Straßen- oder Hoflage.');
  if (stated(facts.energy)) items.push(`Vergleiche den ${facts.energyCertificate || 'Energieausweis'} mit echten Energieabrechnungen.`);
  if (!house && facts.features?.some((feature) => /terrasse|garten/i.test(feature))) items.push('Prüfe, ob Terrasse und Garten rechtlich in der Teilungserklärung stehen und wer für die Pflege zuständig ist.');
  if (!items.length) items.push(house
    ? 'Fordere das vollständige Exposé, den Energieausweis und eine klare Aufstellung der laufenden Kosten an.'
    : 'Fordere das vollständige Exposé, den Energieausweis, WEG-Unterlagen und eine klare Aufstellung der laufenden Kosten an.');
  return items.slice(0, 4);
}

export function localizedWarnings(report: Report, locale: Locale) {
  const divergence = buyerCostDivergenceNote(report, locale);
  const withDivergence = (warnings: string[]) => divergence ? [...warnings, divergence] : warnings;
  if (locale === 'en') return withDivergence(report.qualityWarnings || []);
  return withDivergence((report.qualityWarnings || []).map((warning) => {
    if (/separately quotes/.test(warning)) return `Das Angebot nennt separat ${report.facts.parkingPrice?.toLocaleString('de-DE')} € für Garage oder Stellplatz. Kläre, ob dieser Kauf verpflichtend und zusätzlich ist; der Betrag ist nicht in der angegebenen Gesamtsumme enthalten.`;
    if (/needs a fresh source review/.test(warning)) return 'Dieser gespeicherte Bericht muss erneut aus der Quelle geprüft werden. Importiere das Angebot oder lade das Exposé neu hoch.';
    if (/purchase price, buyer costs/.test(warning)) return 'Kaufpreis, Kaufnebenkosten und Gesamtsumme widersprechen sich. Die Finanzierung nutzt die angegebene Gesamtsumme; kläre die Aufschlüsselung.';
    if (/Construction year and new-build/.test(warning)) return 'Baujahr und Neubauzustand widersprechen sich. Kläre den tatsächlichen Zustand.';
    if (/Hausgeld amount refers to/.test(warning)) return `Die Hausgeldangabe bezieht sich auf ${report.facts.housegeldYear}. Prüfe den aktuellen Wirtschaftsplan.`;
    if (/conflicting room counts/.test(warning)) return 'Das Angebot enthält widersprüchliche Zimmerzahlen. Prüfe den Grundriss; der Titel nennt deshalb keine Zimmerzahl.';
    if (/energy class and consumption/.test(warning)) return 'Die angegebene Energieklasse und der Verbrauch passen nicht zu den üblichen Klassengrenzen. Prüfe den Energieausweis.';
    if (/key-facts table says it is not rented/.test(warning)) return tenancyConflictSentence(report.facts, 'de');
    if (/portal says not rented/.test(warning)) return 'Das Portal meldet nicht vermietet, aber laut Beschreibung wohnen noch Menschen in der Wohnung. Kläre ihren rechtlichen Status und die freie Übergabe.';
    if (/not a valid 5-digit code/i.test(warning)) {
      const code = warning.match(/"(\d+)"/)?.[1] || '';
      return `Im Angebot steht die Postleitzahl „${code}“. Das ist keine gültige fünfstellige PLZ. Der Ort wird trotzdem verwendet.`;
    }
    if (/exact street address/i.test(warning)) return 'Die genaue Straßenadresse steht nicht im Angebot.';
    if (/exact floor/i.test(warning)) return 'Die genaue Etage steht nicht im Angebot.';
    if (/complete acquisition total/i.test(warning)) return 'Im Angebot fehlt eine vollständige Gesamtsumme. Die Finanzierung nutzt deshalb eine grobe Schätzung der Kaufnebenkosten.';
    if (/The house is rented but no verified yield/i.test(warning)) return 'Das Haus ist vermietet, aber es wurde keine verlässliche Renditeangabe gefunden.';
    if (/rented but no verified yield/i.test(warning)) return 'Die Immobilie ist vermietet, aber es wurde keine verlässliche Renditeangabe gefunden.';
    return warning;
  }));
}

export function offerQuestionsFor(report: Report, locale: Locale = 'en') {
  const { facts } = report;
  const questions: string[] = [...highFlagQuestions(report, locale)];
  if (locale === 'de') {
    if (facts.tenancy === 'Rented') questions.push('Kann ich den Mietvertrag, die aktuelle Nettokaltmiete und die Zahlungshistorie sehen?');
    else if (facts.availabilityDate) questions.push(`Ist die freie Übergabe am ${formatAvailabilityDate(facts.availabilityDate, 'de')} im Kaufvertrag zugesichert?`);
    else if (['Not rented', 'Available to move in', 'Vacant', 'Owner-occupied'].includes(facts.tenancy || '')) questions.push('Wann wird die Immobilie vollständig frei übergeben?');
    else questions.push('Ist die Immobilie bei der Übergabe vermietet oder frei?');
    if (report.propertyType === 'flat') questions.push(isNewOrFirstOccupancy(facts.condition)
      ? 'Welcher anfängliche Beitrag zur WEG-Rücklage ist vorgesehen?'
      : 'Wie hoch ist die WEG-Rücklage, und sind Sonderumlagen geplant?');
    if (facts.housegeld && report.propertyType !== 'house') questions.push(`Wie teilen sich die ${facts.housegeld.toLocaleString('de-DE')} € Hausgeld in umlagefähige und eigene Kosten?`);
    if (/Needs renovation|Needs modernization/i.test(facts.condition || '')) questions.push('Welche Arbeiten sind nötig, und gibt es dafür Kostenvoranschläge?');
    if (!stated(facts.floor) && report.propertyType === 'flat') questions.push('In welcher Etage liegt die Wohnung, und gibt es einen Aufzug?');
    questions.push('Kann ich den Energieausweis und die letzten Energieabrechnungen sehen?');
    questions.push('Gibt es bekannte Mängel, Baulasten oder Dienstbarkeiten?');
    return questions.slice(0, 4);
  }

  if (facts.tenancy === 'Rented') questions.push('May I see the lease, current net cold rent and payment history?');
  else if (facts.availabilityDate) questions.push(`Is vacant handover on ${formatAvailabilityDate(facts.availabilityDate, 'en')} guaranteed in the purchase contract?`);
  else if (['Not rented', 'Available to move in', 'Vacant', 'Owner-occupied'].includes(facts.tenancy || '')) questions.push('When will the property be handed over vacant?');
  else questions.push('Will the property be rented or vacant at handover?');
  if (report.propertyType === 'flat') questions.push(isNewOrFirstOccupancy(facts.condition)
    ? 'What initial contribution to the WEG reserve is planned?'
    : 'What is the WEG reserve, and are any Sonderumlagen planned?');
  if (facts.housegeld && report.propertyType !== 'house') questions.push(`How is the €${facts.housegeld.toLocaleString('de-DE')} Hausgeld split between recoverable and owner-only costs?`);
  if (/Needs renovation|Needs modernization/i.test(facts.condition || '')) questions.push('Which repairs are necessary, and are contractor estimates available?');
  if (!stated(facts.floor) && report.propertyType === 'flat') questions.push('Which floor is the unit on, and is there a lift?');
  questions.push('May I see the Energieausweis and recent energy bills?');
  questions.push('Are there known defects, Baulasten or registered Dienstbarkeiten?');
  return questions.slice(0, 4);
}
