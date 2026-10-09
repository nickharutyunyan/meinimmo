import { copy, localizedTenancy, localizedValue, type Locale } from './i18n.ts';
import type { Report } from './types';
import { resolveLocation } from './display.ts';
import { formatAvailabilityDate } from './availability.ts';
import { area, money, moneyPerSqm, percent, plainNumber } from './format.ts';
import { isNewOrFirstOccupancy } from './property-condition.ts';
import { formatRentedUntil, groundLeaseSentence, highFlagQuestions, tenancyConflictSentence } from './red-flags.ts';
import { reportConflicts } from './report-integrity.ts';
import type { FeedbackField } from './fact-provenance.ts';
import { energyClassGap } from './property-score.ts';

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

function roomLabel(rooms: string | undefined, locale: Locale) {
  if (!stated(rooms)) return '';
  const value = Number(String(rooms).replace(',', '.'));
  if (!Number.isFinite(value)) return String(rooms);
  return plainNumber(value, locale, 1);
}

function midSentence(value: string) {
  if (!value || !/[a-z]/.test(value)) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function locationClause(report: Report) {
  const resolved = resolveLocation(report);
  const place = resolved.titleLocation;
  const street = resolved.basis === 'address' || resolved.basis === 'street';
  return { place, street: Boolean(place && street) };
}

/**
 * Usable area only when it adds something. Listings often repeat the living
 * area as "Nutzfläche" (42,4 vs 42,42 m²); showing both reads as a mistake.
 */
export function distinctUsableArea(facts: { area?: number; usableArea?: number }) {
  const usable = facts.usableArea;
  if (!usable) return undefined;
  if (facts.area && Math.abs(usable - facts.area) <= Math.max(0.5, facts.area * 0.01)) return undefined;
  return usable;
}

export function localizedSummary(report: Report, locale: Locale) {
  const { facts } = report;
  const house = report.propertyType === 'house';
  const { place, street } = locationClause(report);
  const rooms = roomLabel(facts.rooms, locale);
  const living = facts.area ? area(facts.area, locale) : '';
  const usableArea = distinctUsableArea(facts);
  const usable = usableArea ? area(usableArea, locale) : '';
  const plot = facts.plotArea && house ? area(facts.plotArea, locale) : '';
  const price = facts.price
    ? (locale === 'de'
      ? ` Der Kaufpreis liegt bei ${money(facts.price, 'de')}${facts.area ? ` (${moneyPerSqm(facts.price / facts.area, 'de')})` : ''}.`
      : ` The asking price is ${money(facts.price, 'en')}${facts.area ? ` (${moneyPerSqm(facts.price / facts.area, 'en')})` : ''}.`)
    : '';
  if (locale === 'de') {
    const type = house ? 'Haus' : 'Wohnung';
    const roomPrefix = rooms ? `${rooms}-Zimmer-` : '';
    const where = place ? (street ? ` (${place})` : ` in ${place}`) : '';
    const space = living
      ? ` hat ${living} Wohnfläche${usable ? ` und ${usable} Nutzfläche` : ''}${plot ? ` auf einem ${plot} Grundstück` : ''}`
      : '';
    const comma = place && !street && space ? ',' : '';
    const building = [
      stated(facts.year) ? `Baujahr ${facts.year}` : '',
      facts.construction === 'Timber frame' ? 'Holzbau (Holzständer)' : '',
      stated(facts.condition) ? `Zustand laut Angebot: ${localizedValue(facts.condition, 'de')}` : '',
      stated(facts.energy) ? `Energieklasse ${facts.energy}` : '',
      facts.energySource && !UNKNOWN.test(facts.energySource) ? `Energieträger ${facts.energySource}` : '',
    ].filter(Boolean).join(', ');
    const first = `${house ? 'Dieses' : 'Diese'} ${roomPrefix}${type}${where}${comma}${space}.${price}${building ? ` Dazu kommen ${building}.` : ''}`;
    const availableFrom = formatAvailabilityDate(facts.availabilityDate, 'de');
    const rentedUntil = facts.rentedUntilText;
    const yieldText = facts.advertisedYield ? percent(facts.advertisedYield, 'de') : '';
    const occupancy = facts.tenancy === 'Rented'
      ? `Die Immobilie wird vermietet verkauft${rentedUntil ? ` bis ${rentedUntil}` : ''}${availableFrom ? ` und ist ab ${availableFrom} frei` : ''}${yieldText ? `; angegeben sind ${yieldText} Rendite` : ''}. Lass dir Nettokaltmiete, Mietvertrag und Renditerechnung zeigen.`
      : facts.tenancy === 'Occupancy unclear' ? 'Das Portal meldet nicht vermietet, die Beschreibung nennt aber noch Bewohner. Kläre deren rechtlichen Status und die freie Übergabe.' : availableFrom
      ? `Laut Angebot ist die Immobilie ab ${availableFrom} bezugsfrei. Sichere die freie Übergabe zu diesem Termin im Kaufvertrag ab.`
      : ['Not rented', 'Available to move in', 'Vacant', 'Owner-occupied'].includes(facts.tenancy || '')
        ? 'Laut Angebot ist die Immobilie nicht vermietet. Kläre den Termin der freien Übergabe im Kaufvertrag.'
        : '';
    const costs = facts.housegeld && !house ? ` Das Hausgeld${facts.housegeldYear ? ` für ${facts.housegeldYear}` : ''} liegt laut Angebot bei ${money(facts.housegeld, 'de')} im Monat. Wichtig ist die Trennung zwischen umlagefähigem und eigenem Anteil.` : '';
    const asIs = facts.soldAsIs
      ? (house ? 'Das Haus wird im Ist-Zustand verkauft.' : 'Die Einheit wird im Ist-Zustand verkauft.')
      : '';
    const honest = [asIs, groundLeaseSentence(facts, 'de')].filter(Boolean).join(' ');
    const second = `${occupancy}${honest ? ` ${honest}` : ''}${costs}`.trim();
    return second ? `${first}\n\n${second}` : first;
  }

  const type = report.propertyType;
  const identity = `${rooms ? `${rooms}-room ` : ''}${type}`;
  const where = place ? (street ? ` at ${place}` : ` in ${place}`) : '';
  const space = living
    ? ` has ${living} of living area${usable ? ` and ${usable} of usable area` : ''}${plot ? ` on a ${plot} plot` : ''}`
    : '';
  const comma = where && space ? ',' : '';
  const heating = facts.energySource && !UNKNOWN.test(facts.energySource) ? localizedValue(facts.energySource, 'en') : '';
  const condition = stated(facts.condition) ? localizedValue(facts.condition, 'en') : '';
  const building = [
    stated(facts.year) ? `built in ${facts.year}` : '',
    facts.construction === 'Timber frame' ? 'timber-frame construction' : '',
    condition ? `described as ${midSentence(condition)}` : '',
    stated(facts.energy) ? `energy class ${facts.energy}` : '',
    heating && heating !== copy.en.report.notDisclosed ? `heated via ${midSentence(heating)}` : '',
  ].filter(Boolean).join(', ');
  const first = `This ${identity}${where}${comma}${space}.${price}${building ? ` Listing details: ${building}.` : ''}`.trim();
  const availableFrom = formatAvailabilityDate(facts.availabilityDate, 'en');
  const rentedUntil = formatRentedUntil(facts.rentedUntilText, 'en');
  const yieldText = facts.advertisedYield ? percent(facts.advertisedYield, 'en') : '';
  const investment = facts.tenancy === 'Rented'
    ? `It is sold rented${rentedUntil ? ` until ${rentedUntil}` : ''}${availableFrom ? ` and free from ${availableFrom}` : ''}${yieldText ? ` and advertised at a ${yieldText} return` : ''}; verify the current net cold rent, lease terms and the seller's yield calculation before relying on that figure.`
    : availableFrom
    ? `The listing states that the property will be available from ${availableFrom}; confirm vacant handover on that date in the purchase contract.`
    : ['Not rented', 'Available to move in', 'Vacant', 'Owner-occupied'].includes(facts.tenancy || '')
      ? 'The listing states that it is not rented; confirm the handover date and vacant possession in the purchase contract.'
      : '';
  const occupancyWarning = facts.tenancy === 'Occupancy unclear' ? 'The portal says not rented, but the description says occupants remain. Current occupancy and vacant handover need clarification.' : '';
  const costs = facts.housegeld && !house ? ` Monthly Hausgeld${facts.housegeldYear ? ` for ${facts.housegeldYear}` : ''} is stated at ${money(facts.housegeld, 'en')}; separate recoverable tenant costs from the owner-only share.` : '';
  const asIs = facts.soldAsIs
    ? (house ? 'The house is sold as-is (Ist-Zustand).' : 'The unit is sold as-is (Ist-Zustand).')
    : '';
  const honest = [asIs, groundLeaseSentence(facts, 'en')].filter(Boolean).join(' ');
  const second = `${occupancyWarning || investment}${honest ? ` ${honest}` : ''}${costs}`.trim();
  return second ? `${first}\n\n${second}` : first;
}

export function localizedConsiderations(report: Report, locale: Locale) {
  const { facts } = report;
  const house = report.propertyType === 'house';
  const items: string[] = [];
  const hausgeld = facts.housegeld ? money(facts.housegeld, locale) : '';
  if (locale === 'de') {
    if (facts.tenancy === 'Occupancy unclear') items.push('Kläre den rechtlichen Status der Bewohner und eine verbindliche Vereinbarung zur freien Übergabe.');
    if (facts.tenancy === 'Rented') items.push('Prüfe Mietvertrag, Nettokaltmiete und Zahlungshistorie.');
    if (hausgeld && !house) {
      items.push(isNewOrFirstOccupancy(facts.condition)
        ? `Prüfe, wie sich die ${hausgeld} Hausgeld auf laufende Gemeinschafts- und Eigentümerkosten verteilen.`
        : `Prüfe die Aufteilung der ${hausgeld} Hausgeld und lass dir den aktuellen Stand der WEG-Rücklage zeigen.`);
    }
    if (!stated(facts.floor) && !house) items.push('Kläre Etage, Aufzug sowie Straßen- oder Hoflage.');
    if (stated(facts.energy)) items.push(`Vergleiche den ${facts.energyCertificate || 'Energieausweis'} mit echten Energieabrechnungen.`);
    const rights = !house ? terraceGardenConsideration(facts, 'de') : '';
    if (rights) items.push(rights);
    if (!items.length) items.push(house
      ? 'Fordere das vollständige Exposé, den Energieausweis und eine klare Aufstellung der laufenden Kosten an.'
      : 'Fordere das vollständige Exposé, den Energieausweis, WEG-Unterlagen und eine klare Aufstellung der laufenden Kosten an.');
    return items.slice(0, 4);
  }
  if (facts.tenancy === 'Occupancy unclear') items.push('Confirm the occupants’ legal status and a binding vacant-handover agreement.');
  if (facts.tenancy === 'Rented') items.push('Check the signed lease, net cold rent and payment history.');
  if (hausgeld && !house) {
    items.push(isNewOrFirstOccupancy(facts.condition)
      ? `Check how the ${hausgeld} Hausgeld is split between shared running costs and owner-only costs.`
      : `Check how the ${hausgeld} Hausgeld is split and ask for the current WEG reserve balance.`);
  }
  if (!house && !stated(facts.floor)) items.push('Confirm the floor, lift access and whether the unit faces the street or courtyard.');
  if (stated(facts.energy)) items.push(`Compare the ${facts.energyCertificate || 'Energieausweis'} with actual energy bills.`);
  const rights = !house ? terraceGardenConsideration(facts, 'en') : '';
  if (rights) items.push(rights);
  if (!items.length) items.push(house
    ? 'Request the complete Exposé, Energieausweis and an itemised list of running costs before making an offer.'
    : 'Request the complete Exposé, Energieausweis, WEG records and itemised running costs before making an offer.');
  return items.slice(0, 4);
}

function parkingWarning(report: Report, locale: Locale) {
  const amount = money(report.facts.parkingPrice, locale);
  if (!amount) return '';
  return locale === 'de'
    ? `Das Angebot nennt separat ${amount} für Garage oder Stellplatz. Kläre, ob dieser Kauf verpflichtend und zusätzlich ist; der Betrag ist nicht in der angegebenen Gesamtsumme enthalten.`
    : `The listing separately quotes ${amount} for parking. Confirm whether this is additional and required; it is not included in the stated total.`;
}

function coveredByRedFlag(report: Report, warning: string) {
  const flags = new Set((report.redFlags || []).map(flag => flag.id));
  if (flags.has('rentedOccupied') && /key-facts table says it is not rented|which conflicts with that description|widerspricht sich/i.test(warning)) return true;
  return false;
}

export function terraceGardenConsideration(facts: Pick<Report['facts'], 'features' | 'privateGarden'>, locale: Locale) {
  const terrace = Boolean(facts.features?.some(feature => /terrasse|terrace/i.test(feature)));
  const garden = Boolean(facts.privateGarden);
  if (!terrace && !garden) return '';
  if (locale === 'de') {
    if (terrace && garden) return 'Prüfe, ob Terrasse und privates Gartennutzungsrecht (Sondernutzungsrecht) in der Teilungserklärung stehen und wer für die Pflege zuständig ist.';
    if (terrace) return 'Prüfe, ob das Terrassenrecht in der Teilungserklärung steht und wer für die Pflege zuständig ist.';
    return 'Prüfe, ob das private Gartennutzungsrecht (Sondernutzungsrecht) in der Teilungserklärung steht und wer für die Pflege zuständig ist.';
  }
  if (terrace && garden) return 'Confirm that terrace rights and private garden use (Sondernutzungsrecht) are recorded in the Teilungserklärung and clarify maintenance responsibility.';
  if (terrace) return 'Confirm that terrace rights are recorded in the Teilungserklärung and clarify maintenance responsibility.';
  return 'Confirm that private garden use (Sondernutzungsrecht) is recorded in the Teilungserklärung and clarify maintenance responsibility.';
}

function germanSquareMetres(value: string) {
  return value.replace('.', ',');
}

const NON_LIVING_KIND_DE: Record<string, string> = {
  'unfinished loft': 'unausgebauter Dachboden',
  loft: 'Dachboden',
  'usable space': 'Nutzfläche',
  cellar: 'Keller',
  'hobby room': 'Hobbyraum',
  'expansion reserve': 'Ausbaureserve',
  'non-living space': 'Nichtwohnfläche',
};

function localizedLivingAreaWarning(warning: string, locale: Locale) {
  const preferred = warning.match(/The header states ([\d.]+) m², but the description gives ([\d.]+) m² of living space(?: plus ([\d.]+) m² of non-living space \(([^)]+)\))?\. The price comparison uses the stated living area of [\d.]+ m²\./);
  if (preferred) {
    if (locale === 'en') return warning;
    const header = germanSquareMetres(preferred[1]);
    const living = germanSquareMetres(preferred[2]);
    const kind = preferred[4] ? (NON_LIVING_KIND_DE[preferred[4]] || preferred[4]) : '';
    const extra = preferred[3] ? ` plus ${germanSquareMetres(preferred[3])} m² Nichtwohnfläche${kind ? ` (${kind})` : ''}` : '';
    return `Im Kopf stehen ${header} m², die Beschreibung nennt aber ${living} m² Wohnfläche${extra}. Der Preisvergleich nutzt die angegebene Wohnfläche von ${living} m².`;
  }
  const unclear = warning.match(/The living area in the listing is unclear: the header states ([\d.]+) m² and the description states ([\d.]+) m²\./);
  if (unclear) {
    if (locale === 'en') return warning;
    return `Die Wohnfläche im Angebot ist unklar: im Kopf stehen ${germanSquareMetres(unclear[1])} m², die Beschreibung nennt ${germanSquareMetres(unclear[2])} m².`;
  }
  return '';
}

export function localizedWarnings(report: Report, locale: Locale) {
  const warnings = (report.qualityWarnings || []).map((warning) => {
    const livingArea = localizedLivingAreaWarning(warning, locale);
    if (livingArea) return livingArea;
    if (/energy class and consumption|one step off the stated demand/.test(warning) && energyClassGap(report) === 1) {
      return locale === 'de'
        ? 'Die Energieklasse weicht eine Stufe vom angegebenen Bedarf ab. Der Score nutzt die schlechtere Klasse.'
        : 'The stated energy class is one step off the stated demand. The score uses the lower class.';
    }
    if (/separately quotes/.test(warning)) return parkingWarning(report, locale);
    if (locale === 'en') return warning;
    if (/needs a fresh source review/.test(warning)) return 'Dieser gespeicherte Bericht muss erneut aus der Quelle geprüft werden. Importiere das Angebot oder lade das Exposé neu hoch.';
    if (/purchase price, buyer costs/.test(warning)) return 'Kaufpreis, Kaufnebenkosten und Gesamtsumme widersprechen sich. Die Finanzierung nutzt die angegebene Gesamtsumme; kläre die Aufschlüsselung.';
    if (/Construction year and new-build/.test(warning)) return 'Baujahr und Neubauzustand widersprechen sich. Kläre den tatsächlichen Zustand.';
    if (/Hausgeld amount refers to/.test(warning)) {
      const year = report.facts.housegeldYear;
      return year ? `Die Hausgeldangabe bezieht sich auf ${year}. Prüfe den aktuellen Wirtschaftsplan.` : '';
    }
    if (/conflicting room counts/.test(warning)) return 'Das Angebot enthält widersprüchliche Zimmerzahlen. Prüfe den Grundriss; der Titel nennt deshalb keine Zimmerzahl.';
    if (/one step off the stated demand/.test(warning)) return locale === 'de'
      ? 'Die Energieklasse weicht eine Stufe vom angegebenen Bedarf ab. Der Score nutzt die schlechtere Klasse.'
      : 'The stated energy class is one step off the stated demand. The score uses the lower class.';
    if (/energy class and consumption/.test(warning)) {
      if (locale === 'de') return 'Die angegebene Energieklasse und der Verbrauch passen nicht zu den üblichen Klassengrenzen. Prüfe den Energieausweis.';
      return warning;
    }
    if (/completion in \d{4}/.test(warning)) {
      const built = warning.match(/year built is (\d{4})/)?.[1] || '';
      const completion = warning.match(/completion in (\d{4})/)?.[1] || '';
      return locale === 'de'
        ? `Als Baujahr steht ${built}, als Fertigstellung ${completion}. Prüfe, welches Datum gilt.`
        : warning;
    }
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
  }).filter(warning => Boolean(warning) && !coveredByRedFlag(report, warning));
  return warnings;
}

/** Conflicts already shown as a red flag or a data note stay out of the clarify box. */
export function clarifyBeforeDecision(report: Report, locale: Locale) {
  const notes = new Set(localizedWarnings(report, locale));
  const onlyHere = reportConflicts(report).filter(item => !(report.qualityWarnings || []).includes(item));
  return localizedWarnings({ ...report, qualityWarnings: onlyHere }, locale).filter(item => !notes.has(item));
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
    if (facts.housegeld && report.propertyType !== 'house') questions.push(`Wie teilen sich die ${money(facts.housegeld, 'de')} Hausgeld in umlagefähige und eigene Kosten?`);
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
  if (facts.housegeld && report.propertyType !== 'house') questions.push(`How is the ${money(facts.housegeld, 'en')} Hausgeld split between recoverable and owner-only costs?`);
  if (/Needs renovation|Needs modernization/i.test(facts.condition || '')) questions.push('Which repairs are necessary, and are contractor estimates available?');
  if (!stated(facts.floor) && report.propertyType === 'flat') questions.push('Which floor is the unit on, and is there a lift?');
  questions.push('May I see the Energieausweis and recent energy bills?');
  questions.push('Are there known defects, Baulasten or registered Dienstbarkeiten?');
  return questions.slice(0, 4);
}

/** At-a-glance rows, formatted for the report locale. Price-check rows stay with that card. */
export function glanceFacts(report: Report, locale: Locale): Array<[string, string, FeedbackField]> {
  const facts = report.facts;
  const text = copy[locale].report;
  const known = (value?: string) => localizedValue(value, locale);
  const shown = (value?: string) => known(value) !== text.notDisclosed;
  const demand = Number.isFinite(facts.energyDemand) && facts.energyDemand ? plainNumber(facts.energyDemand, locale, 2) : '';
  const energy = [
    shown(facts.energy) ? known(facts.energy) : '',
    demand ? `${demand} ${locale === 'de' ? 'kWh/(m²·a)' : 'kWh/(m²·year)'}` : '',
  ].filter(Boolean).join(' · ');
  const heatingParts = [
    shown(facts.heating) ? known(facts.heating) : '',
    facts.energySource && shown(facts.energySource) ? known(facts.energySource) : '',
  ].filter(Boolean);
  const heating = [...new Set(heatingParts)].join(' · ');
  const rows: Array<[string, string, FeedbackField]> = [];
  if (facts.price) rows.push([text.asking, money(facts.price, locale), 'price']);
  if (facts.price && facts.area) rows.push([text.perSqm, moneyPerSqm(facts.price / facts.area, locale), 'perSqm']);
  if (facts.area) rows.push([text.living, area(facts.area, locale), 'area']);
  if (facts.plotArea) rows.push([text.plot, area(facts.plotArea, locale), 'plotArea']);
  const usableArea = distinctUsableArea(facts);
  if (usableArea) rows.push([text.usable, area(usableArea, locale), 'usableArea']);
  if (shown(facts.rooms)) rows.push([text.rooms, roomLabel(facts.rooms, locale) || known(facts.rooms), 'rooms']);
  if (shown(facts.floor)) rows.push([text.floor, known(facts.floor), 'floor']);
  if (shown(facts.tenancy)) rows.push([text.use, localizedTenancy(facts.tenancy, facts.availabilityDate, locale), 'tenancy']);
  if (shown(facts.condition)) rows.push([text.condition, known(facts.condition), 'condition']);
  if (facts.soldAsIs) rows.push([locale === 'de' ? 'Verkauf' : 'Sale', locale === 'de' ? 'Ist-Zustand' : 'As-is', 'condition']);
  if (facts.buyerCommission) rows.push([text.commission, known(facts.buyerCommission), 'buyerCommission']);
  if (facts.housegeld) rows.push(['Hausgeld', `${money(facts.housegeld, locale)} ${text.monthly}${facts.housegeldYear ? ` (${facts.housegeldYear})` : ''}`, 'housegeld']);
  if (facts.advertisedYield) rows.push([text.return, percent(facts.advertisedYield, locale), 'advertisedYield']);
  else if (facts.grossYield && (facts.tenancy === 'Rented' || facts.investmentUse)) rows.push([locale === 'de' ? 'Bruttorendite' : 'Gross yield', percent(facts.grossYield, locale), 'grossYield']);
  if (shown(report.sunOrientation)) rows.push([text.sun, known(report.sunOrientation), 'sunOrientation']);
  if (report.daylight) rows.push([text.daylight, known(report.daylight), 'daylight']);
  if (energy) rows.push([text.energy, energy, 'energy']);
  if (heating) rows.push([text.heating, heating, 'heating']);
  if (shown(facts.year)) rows.push([text.built, known(facts.year), 'year']);
  return rows.filter(([, value]) => Boolean(value));
}
