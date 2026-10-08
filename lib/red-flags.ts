import type { Report } from './types';
import { formatAvailabilityDate } from './availability.ts';

export const RED_FLAG_IDS = [
  'leasehold',
  'lifeInterest',
  'specialLevy',
  'teileigentum',
  'commissionAboveShare',
  'maintenanceBacklog',
  'forcedSale',
  'rentedOccupied',
  'heatingAge',
  'noEnergyData',
  'noHausgeld',
  'basement',
  'socialHousing',
  'listedBuilding',
] as const;

export type RedFlagId = typeof RED_FLAG_IDS[number];
export type RedFlag = { id: RedFlagId; severity: 'high' | 'caution'; evidence?: string };

const HIGH = new Set<RedFlagId>(['leasehold', 'lifeInterest', 'specialLevy', 'teileigentum', 'commissionAboveShare']);

const USUAL_BUYER_COMMISSION_PERCENT = 3.57;

const MONTHS: Record<string, number> = {
  januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
};
const MONTHS_EN: Record<string, string> = {
  januar: 'January', februar: 'February', märz: 'March', maerz: 'March', april: 'April',
  mai: 'May', juni: 'June', juli: 'July', august: 'August', september: 'September',
  oktober: 'October', november: 'November', dezember: 'December',
};

/** Lines after this are topic links and similar-listing chrome, not the offer. */
export function listingFactLines(lines: string[]) {
  const stop = lines.findIndex(line => /^(?:Themenportale|Ähnliche (?:Angebote|Immobilien)|Weitere Angebote|Das könnte dir auch gefallen)$/i.test(line));
  return stop < 0 ? lines : lines.slice(0, stop);
}

/**
 * Skip a keyword when the same sentence negates it.
 * "nein" is included because exposés write "Denkmalschutz: nein".
 */
export function mentionIsNegated(sentence: string, index: number, length: number) {
  const before = sentence.slice(Math.max(0, index - 40), index);
  if (/(?:kein(?:e(?:m|n|r|s)?)?|nicht|ohne|frei von|\bno\b|\bnot\b|\bnone\b|\bnein\b)/i.test(before)) return true;
  const after = sentence.slice(index + length, index + length + 80);
  if (/ausgeschlossen|nicht geplant|nicht beschlossen|keine geplant|\bnein\b/i.test(after)) return true;
  return false;
}

function clearMatch(line: string, pattern: RegExp) {
  const expression = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  for (const match of line.matchAll(expression)) {
    const index = match.index ?? 0;
    if (!mentionIsNegated(line, index, match[0].length)) return { index, text: match[0] };
  }
  return undefined;
}

function evidenceQuote(line: string, index = 0) {
  const clean = line.replace(/\s+/g, ' ').trim();
  if (clean.length <= 220) return clean;
  const start = Math.max(0, Math.min(index, clean.length - 220));
  return clean.slice(start, start + 220).trim();
}

function push(flags: RedFlag[], id: RedFlagId, evidence?: string) {
  if (flags.some(flag => flag.id === id)) return;
  flags.push({ id, severity: HIGH.has(id) ? 'high' : 'caution', ...(evidence ? { evidence } : {}) });
}

const LEASEHOLD = /\b(?:Erbbaurecht\w*|Erbbauzins|Erbpacht|Pachtgrundstück|Pacht|leasehold|ground lease)\b/i;
const LIFE_INTEREST = /\b(?:Nießbrauch|Niessbrauch|lebenslanges?\s+Wohnrecht|Wohnungsrecht|Wohnrecht\w*|Leibrente|Verrentung|right of residence|usufruct)\b/i;
const LEVY = /Sonderumlage/i;
const LEVY_QUALIFIER = /beschlossen|geplant|anstehend|fällig|in Höhe von|\d+\s?€/i;
const BACKLOG = /Instandhaltungsstau|Sanierungsstau|Instandsetzungsstau/i;
const FORCED_SALE = /Zwangsversteigerung|Versteigerungstermin|Verkehrswertgutachten|Amtsgericht.{0,40}Versteigerung/i;
const SOCIAL = /\b(?:WBS|Wohnberechtigungsschein|Belegungsbindung|Mietpreisbindung|öffentlich gefördert)\b/i;
const LISTED = /Denkmalschutz|denkmalgeschützt|Baudenkmal/i;
const HEATING_YEAR = /(?:Baujahr\s+(?:der\s+)?Heizung|Heizungsbaujahr|Baujahr\s+Anlagentechnik)\s*[:\-]?\s*(18\d{2}|19\d{2}|20\d{2})/i;
const OIL_GAS = /\b(?:erdgas|gasheizung|gas(?:zentral)?heizung|gas|heizöl|öl|oel|oil)\b/i;

function boilerPlateTeileigentum(line: string, index: number) {
  return /Wohnungs-?\s*und\s+$/i.test(line.slice(Math.max(0, index - 24), index));
}

function gewerbeIsOfferedUnit(line: string) {
  if (!/Gewerbeeinheit/i.test(line)) return false;
  const inventory = /\b(?:\d+|zwei|drei|vier|mehrere|weitere)\s+Gewerbeeinheiten\b/i.test(line)
    || (/\bsowie\b/i.test(line) && /\bEigentumswohnungen\b/i.test(line) && /\bGewerbeeinheiten\b/i.test(line));
  if (!inventory) return true;
  return /\b(?:diese\s+(?:einheit|gewerbeeinheit)|die\s+angebotene|objekt\s+ist\s+eine\s+gewerbeeinheit)\b/i.test(line);
}

function teileigentumLine(line: string) {
  const expression = /Teileigentum|Gewerbeeinheit|als Wohnung genutzt.{0,80}genehmig/gi;
  for (const match of line.matchAll(expression)) {
    const index = match.index ?? 0;
    if (mentionIsNegated(line, index, match[0].length)) continue;
    if (/^Teileigentum/i.test(match[0]) && boilerPlateTeileigentum(line, index)) continue;
    if (/^Gewerbeeinheit/i.test(match[0]) && !gewerbeIsOfferedUnit(line)) continue;
    return { index };
  }
  return undefined;
}

export function buyerCommissionPercent(value?: string) {
  if (!value || /commission-free|provisionsfrei|courtagefrei/i.test(value)) return 0;
  const match = value.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/);
  if (!match) return undefined;
  let percent = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(percent)) return undefined;
  if (/(?:zzgl|plus|\+|excl|exkl|ohne)\.?\s*(?:gesetzl\.?\s*)?(?:MwSt|USt|VAT|Umsatzsteuer)/i.test(value)) {
    percent = Math.round(percent * 119) / 100;
  }
  return percent;
}

/** Buyer share above the usual 3.57% (half of 7.14% incl. VAT), for a flat or house. */
export function commissionAboveUsualBuyerShare(report: Pick<Report, 'propertyType' | 'facts'>, context = '') {
  if (report.propertyType === 'land') return false;
  if (report.propertyType === 'house' && /\bMehrfamilienhaus\b/i.test(context) && !/\bWohnung\b/i.test(context)) return false;
  const percent = buyerCommissionPercent(report.facts.buyerCommission);
  return percent !== undefined && percent > USUAL_BUYER_COMMISSION_PERCENT + 0.001;
}

function monthNumber(name: string) {
  const key = name.toLocaleLowerCase('de-DE');
  return MONTHS[key] || MONTHS[key.replace('ä', 'ae')];
}

export function findHeatingInstallYear(lines: string[]) {
  return heatingInstallYear(listingFactLines(lines));
}

function heatingInstallYear(lines: string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const joined = `${lines[index]} ${lines[index + 1] || ''}`;
    const match = joined.match(HEATING_YEAR);
    if (!match || match.index === undefined) continue;
    if (mentionIsNegated(joined, match.index, match[0].length)) continue;
    const line = lines[index].length >= match[0].length ? lines[index] : joined;
    return { year: Number(match[1]), evidence: evidenceQuote(line, match.index) };
  }
  return undefined;
}

function sentenceSaysRented(sentence: string) {
  if (/(?:nicht|un)\s*vermietet|kein(?:e|en)?\s+miet/i.test(sentence)) return false;
  return /(?:\bist\b|\bbis\b).{0,80}\bvermietet\b|\bvermietet\s+bis\b|\bMietvertrag\s+l[aä]uft\s+bis\b|\b(?:aktuell|derzeit)\s+vermietet\b|\bwird\s+vermietet\s+verkauft\b|\bvermietet\s+verkauft\b/i.test(sentence);
}

export function lineSaysRented(line: string) {
  return line.split(/(?<=[.!?])\s+/).some(sentenceSaysRented);
}

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

export function findTenancyConflict(lines: string[]) {
  for (const line of listingFactLines(lines)) {
    const sentence = line.split(/(?<=[.!?])\s+/).find(sentenceSaysRented);
    if (!sentence) continue;
    const until = sentence.match(/\bbis\s+((?:Ende\s+)?(?:\d{1,2}\.?\s*)?[A-Za-zÄÖÜäöü]+\s+\d{4})/i)?.[1]?.replace(/\s+/g, ' ').trim();
    const written = sentence.match(/\bab\s+(\d{1,2})\.?\s*(Januar|Februar|M[aä]rz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s*(\d{4})/i);
    const numeric = sentence.match(/\bab\s+(\d{1,2})[./](\d{1,2})[./](\d{4})/i);
    let availableFrom = '';
    if (written) {
      const month = monthNumber(written[2]);
      if (month) availableFrom = isoDate(Number(written[3]), month, Number(written[1]));
    } else if (numeric) {
      availableFrom = isoDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
    }
    return {
      evidence: evidenceQuote(line, line.indexOf(sentence)),
      untilText: until,
      availableFrom: availableFrom || undefined,
    };
  }
  return undefined;
}

function groundRentAmounts(text: string) {
  const year = text.match(/jährlich(?:en|er)?\s+Belastung\s+von\s+(\d[\d.]*)/i)?.[1]
    || text.match(/(\d[\d.]*)\s*(?:€|EUR)\s*(?:pro|\/)\s*Jahr/i)?.[1]
    || text.match(/Erbbauzins[^0-9]{0,24}(\d[\d.]*)/i)?.[1];
  const month = text.match(/mtl\.?\s*:?\s*(\d[\d.]*)/i)?.[1]
    || text.match(/(\d[\d.]*)\s*(?:€|EUR)\s*(?:pro|\/)\s*Monat/i)?.[1];
  const parse = (value?: string) => {
    if (!value) return undefined;
    const amount = Number(value.replace(/\./g, '').replace(',', '.'));
    return amount > 0 && amount < 100_000 ? amount : undefined;
  };
  return { year: parse(year), month: parse(month) };
}

export function findGroundLease(lines: string[]) {
  const scoped = listingFactLines(lines);
  let evidence = '';
  let year: number | undefined;
  let month: number | undefined;
  let inCharges = false;
  for (let index = 0; index < scoped.length; index += 1) {
    const line = scoped[index];
    const match = clearMatch(line, LEASEHOLD);
    if (!match) continue;
    const window = `${line}\n${scoped[index + 1] || ''}`;
    const amounts = groundRentAmounts(window);
    if (!evidence || amounts.year || amounts.month) evidence = evidenceQuote(line, match.index);
    year = year || amounts.year;
    month = month || amounts.month;
    if (/enthalten|inklusive|in den .{0,40}(?:Hausgeld|Betriebskosten)/i.test(window)) inCharges = true;
  }
  if (!evidence) return undefined;
  return { evidence, year, month, inCharges };
}

export function findSoldAsIs(lines: string[]) {
  for (const line of listingFactLines(lines)) {
    const match = clearMatch(line, /\bIst-Zustand\b|\bas-is\b|\bas is\b/i);
    if (match) return evidenceQuote(line, match.index);
  }
  return undefined;
}

export function findTimberFrame(title: string, lines: string[]) {
  const blob = `${title}\n${listingFactLines(lines).join('\n')}`;
  return /\b(?:Holzständer(?:bau(?:weise)?)?|Holzrahmen(?:bau)?|Blockbohlen|Holzbungalow|Holzhaus|timber[- ]frame|wood[- ]frame)\b/i.test(blob);
}

export function formatRentedUntil(text: string | undefined, locale: 'en' | 'de') {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (locale === 'de') return clean;
  const end = clean.match(/^Ende\s+([A-Za-zÄÖÜäöü]+)\s+(\d{4})$/i);
  if (end) return `the end of ${MONTHS_EN[end[1].toLocaleLowerCase('de-DE')] || end[1]} ${end[2]}`;
  return clean.replace(/[A-Za-zÄÖÜäöü]+/g, word => MONTHS_EN[word.toLocaleLowerCase('de-DE')] || word);
}

export function tenancyConflictSentence(facts: Pick<Report['facts'], 'rentedUntilText' | 'availabilityDate'>, locale: 'en' | 'de') {
  const until = formatRentedUntil(facts.rentedUntilText, locale);
  const from = formatAvailabilityDate(facts.availabilityDate, locale);
  if (locale === 'de') {
    const untilBit = until ? `bis ${until} ` : '';
    const fromBit = from ? ` und ab ${from} frei` : '';
    return `Der Text sagt, die Immobilie ist ${untilBit}vermietet${fromBit}. Die Tabelle sagt „Nicht vermietet“. Das widerspricht sich.`;
  }
  const untilBit = until ? ` until ${until}` : '';
  const fromBit = from ? ` and free from ${from}` : '';
  return `The description says the property is rented${untilBit}${fromBit}. The key-facts table says it is not rented, which conflicts with that description.`;
}

export function groundLeaseSentence(facts: Pick<Report['facts'], 'groundLease' | 'groundRentYear' | 'groundRentMonth' | 'groundRentInServiceCharge'>, locale: 'en' | 'de') {
  if (!facts.groundLease) return '';
  const year = facts.groundRentYear;
  const month = facts.groundRentMonth;
  if (locale === 'de') {
    const parts = [year ? `etwa ${year.toLocaleString('de-DE')} € im Jahr` : '', month ? `${month.toLocaleString('de-DE')} € im Monat` : ''].filter(Boolean);
    const amount = parts.length
      ? ` Die Pacht beträgt ${year && month ? `${parts[0]} (${parts[1]})` : parts[0]}${facts.groundRentInServiceCharge ? ' und ist im Hausgeld enthalten' : ''}.`
      : '';
    return `Das Grundstück ist ein Pachtgrundstück.${amount}`;
  }
  const parts = [year ? `€${year.toLocaleString('en-GB')} a year` : '', month ? `€${month.toLocaleString('en-GB')} a month` : ''].filter(Boolean);
  const amount = parts.length
    ? ` Ground rent is about ${year && month ? `${parts[0]} (${parts[1]})` : parts[0]}${facts.groundRentInServiceCharge ? ' and is included in the Hausgeld' : ''}.`
    : ' Ground rent is payable on top of the purchase.';
  return `The land is a ground lease (Pachtgrundstück).${amount}`;
}

const COPY: Record<RedFlagId, { en: string; de: string }> = {
  leasehold: {
    en: 'Leasehold (Erbbaurecht): you buy the building but not the land, and pay ground rent. Ask for the remaining term, the current Erbbauzins and how it is adjusted. Banks often lend less on leasehold.',
    de: 'Erbbaurecht: Du kaufst das Gebäude, nicht das Grundstück, und zahlst Erbbauzins. Frag nach Restlaufzeit, aktuellem Erbbauzins und Anpassungsklausel. Banken finanzieren Erbbaurechte oft schlechter.',
  },
  lifeInterest: {
    en: 'The listing mentions a right of residence, usufruct or annuity sale. Someone may keep living in the property or receive payments. Ask for the exact entry in the land register.',
    de: 'Das Angebot nennt Wohnrecht, Nießbrauch oder Verrentung. Möglicherweise wohnt jemand weiter dort oder erhält Zahlungen. Lass dir den genauen Grundbucheintrag zeigen.',
  },
  specialLevy: {
    en: 'A special levy (Sonderumlage) is mentioned. Ask for the amount, the due date, whether the seller or the buyer pays, and the owners\' meeting resolution.',
    de: 'Eine Sonderumlage wird erwähnt. Frag nach Höhe, Fälligkeit, ob Verkäufer oder Käufer zahlt, und nach dem Beschluss der Eigentümerversammlung.',
  },
  maintenanceBacklog: {
    en: 'The listing mentions a maintenance backlog. Ask for the last three years of owners\' meeting minutes and the planned works.',
    de: 'Das Angebot erwähnt einen Instandhaltungsstau. Lass dir die Protokolle der letzten drei Eigentümerversammlungen und geplante Maßnahmen zeigen.',
  },
  teileigentum: {
    en: 'The unit may be registered as Teileigentum (non-residential). Residential use may not be permitted. Check the Teilungserklärung before you go further.',
    de: 'Die Einheit ist möglicherweise Teileigentum (nicht zu Wohnzwecken). Eine Wohnnutzung ist dann eventuell nicht erlaubt. Prüfe die Teilungserklärung, bevor du weitermachst.',
  },
  forcedSale: {
    en: 'This looks like a court auction. The process, viewings and payment rules differ from a normal sale. Read the valuation report and the court notice.',
    de: 'Das sieht nach einer Zwangsversteigerung aus. Ablauf, Besichtigung und Zahlung folgen anderen Regeln als ein normaler Kauf. Lies das Verkehrswertgutachten und die Bekanntmachung des Gerichts.',
  },
  rentedOccupied: {
    en: 'Sold with a tenant: you cannot simply move in. If the flat was converted into a condominium during the tenancy, notice for personal use can be barred for years (§ 577a BGB; up to 10 years in Berlin).',
    de: 'Vermietet verkauft: Selbst einziehen geht nicht ohne Weiteres. Wurde die Wohnung während des Mietverhältnisses in Eigentum umgewandelt, kann eine Eigenbedarfskündigung jahrelang ausgeschlossen sein (§ 577a BGB; in Berlin bis zu 10 Jahre).',
  },
  commissionAboveShare: {
    en: 'The buyer\'s commission is above the usual 3.57%. For flats and single-family houses, a buyer may not pay a higher share than the seller (§ 656c BGB). Ask for the seller\'s share in writing.',
    de: 'Die Käuferprovision liegt über den üblichen 3,57 %. Bei Wohnungen und Einfamilienhäusern darf der Käufer nicht mehr zahlen als der Verkäufer (§ 656c BGB). Lass dir den Verkäuferanteil schriftlich bestätigen.',
  },
  heatingAge: {
    en: 'The heating system is {years} years old. Many oil and gas boilers must be replaced after 30 years (§ 72 GEG). Ask about its condition and the replacement cost.',
    de: 'Die Heizung ist {years} Jahre alt. Viele Öl- und Gaskessel müssen nach 30 Jahren ersetzt werden (§ 72 GEG). Frag nach Zustand und Austauschkosten.',
  },
  noEnergyData: {
    en: 'No energy certificate figures are stated. If a certificate exists, its key figures must appear in property ads (§ 87 GEG). Ask for the Energieausweis.',
    de: 'Es fehlen Kennwerte aus dem Energieausweis. Liegt ein Ausweis vor, müssen die Pflichtangaben in der Anzeige stehen (§ 87 GEG). Fordere den Energieausweis an.',
  },
  noHausgeld: {
    en: 'The Hausgeld is not stated, so the monthly cost is unknown. Ask for the current Wirtschaftsplan.',
    de: 'Das Hausgeld fehlt, die Monatskosten sind daher unbekannt. Fordere den aktuellen Wirtschaftsplan an.',
  },
  basement: {
    en: 'Basement flat (Souterrain): check daylight, damp and the legal permission for residential use.',
    de: 'Souterrainwohnung: Prüfe Tageslicht, Feuchtigkeit und die Genehmigung als Wohnraum.',
  },
  socialHousing: {
    en: 'The listing mentions a WBS or rent or occupancy restrictions. Letting and rent can be restricted. Ask for the funding terms and their end date.',
    de: 'Das Angebot nennt WBS, Miet- oder Belegungsbindung. Vermietung und Miethöhe können eingeschränkt sein. Frag nach Förderbedingungen und deren Ende.',
  },
  listedBuilding: {
    en: 'Listed building: changes such as windows, insulation or the roof need approval. Special tax depreciation may apply. Ask for the conservation conditions.',
    de: 'Denkmalschutz: Änderungen an Fenstern, Dämmung oder Dach brauchen eine Genehmigung. Steuerliche Sonderabschreibungen sind möglich. Frag nach den Denkmalauflagen.',
  },
};

const SHORT: Record<RedFlagId, { en: string; de: string }> = {
  leasehold: { en: 'Leasehold', de: 'Erbbaurecht' },
  lifeInterest: { en: 'Right of residence', de: 'Wohnrecht' },
  specialLevy: { en: 'Special levy', de: 'Sonderumlage' },
  teileigentum: { en: 'Teileigentum', de: 'Teileigentum' },
  commissionAboveShare: { en: 'Commission share', de: 'Provision' },
  maintenanceBacklog: { en: 'Maintenance backlog', de: 'Instandhaltungsstau' },
  forcedSale: { en: 'Court auction', de: 'Zwangsversteigerung' },
  rentedOccupied: { en: 'Rented', de: 'Vermietet' },
  heatingAge: { en: 'Heating age', de: 'Heizungsalter' },
  noEnergyData: { en: 'No energy data', de: 'Keine Energiedaten' },
  noHausgeld: { en: 'No Hausgeld', de: 'Kein Hausgeld' },
  basement: { en: 'Basement flat', de: 'Souterrain' },
  socialHousing: { en: 'Occupancy restriction', de: 'Belegungsbindung' },
  listedBuilding: { en: 'Listed building', de: 'Denkmalschutz' },
};

const QUESTIONS: Record<string, { en: string; de: string }> = {
  leasehold: {
    en: 'What is the remaining leasehold term, the current Erbbauzins, and how is it adjusted?',
    de: 'Wie lang ist die Restlaufzeit, wie hoch ist der aktuelle Erbbauzins, und wie wird er angepasst?',
  },
  lifeInterest: {
    en: 'What is the exact land-register entry for the right of residence or usufruct?',
    de: 'Wie lautet der genaue Grundbucheintrag zu Wohnrecht oder Nießbrauch?',
  },
  specialLevy: {
    en: 'What is the Sonderumlage amount and due date, and does the seller or the buyer pay?',
    de: 'Wie hoch ist die Sonderumlage, wann ist sie fällig, und zahlt der Verkäufer oder der Käufer?',
  },
  teileigentum: {
    en: 'Does the Teilungserklärung register this unit as Teileigentum, and is residential use allowed?',
    de: 'Steht die Einheit in der Teilungserklärung als Teileigentum, und ist Wohnen erlaubt?',
  },
  commissionAboveShare: {
    en: 'What commission share does the seller pay? Please confirm it in writing.',
    de: 'Welchen Provisionsanteil zahlt der Verkäufer? Bitte schriftlich bestätigen.',
  },
};

export function redFlagSentence(report: Report, flag: RedFlag, locale: 'en' | 'de') {
  const text = COPY[flag.id][locale];
  if (flag.id !== 'heatingAge') return text;
  const year = report.facts.heatingYear;
  const years = year ? Number(report.createdAt.slice(0, 4)) - year : 0;
  return text.replace('{years}', String(years));
}

export function redFlagShortName(id: RedFlagId, locale: 'en' | 'de') {
  return SHORT[id][locale];
}

export function redFlagSummary(report: Report, locale: 'en' | 'de') {
  const flags = report.redFlags || [];
  if (!flags.length) return locale === 'de' ? 'Keine' : 'None';
  const names = flags.map(flag => redFlagShortName(flag.id, locale)).join(', ');
  return `${flags.length} · ${names}`;
}

export function highFlagQuestions(report: Report, locale: 'en' | 'de') {
  return (report.redFlags || [])
    .filter(flag => flag.severity === 'high' && QUESTIONS[flag.id])
    .map(flag => QUESTIONS[flag.id][locale]);
}

function certificateMentioned(lines: string[]) {
  return lines.some(line => /Energieausweis|energy certificate|Endenergie|Energieeffizienzklasse|energy efficiency class/i.test(line));
}

export function detectRedFlags(lines: string[], report: Pick<Report, 'propertyType' | 'facts' | 'createdAt' | 'title'>): RedFlag[] {
  const scoped = listingFactLines(lines);
  const flags: RedFlag[] = [];
  const lease = findGroundLease(scoped);
  if (lease) push(flags, 'leasehold', lease.evidence);
  for (const line of scoped) {
    const life = clearMatch(line, LIFE_INTEREST);
    if (life) { push(flags, 'lifeInterest', evidenceQuote(line, life.index)); break; }
  }
  for (let index = 0; index < scoped.length; index += 1) {
    const line = scoped[index];
    const levy = clearMatch(line, LEVY);
    if (!levy) continue;
    const window = `${line} ${scoped[index + 1] || ''}`;
    if (!LEVY_QUALIFIER.test(window)) continue;
    push(flags, 'specialLevy', evidenceQuote(line, levy.index));
    break;
  }
  for (const line of scoped) {
    const part = teileigentumLine(line);
    if (part) { push(flags, 'teileigentum', evidenceQuote(line, part.index)); break; }
  }
  if (commissionAboveUsualBuyerShare(report, `${report.title || ''} ${scoped.slice(0, 40).join(' ')}`)) {
    const line = scoped.find(item => /Käuferprovision|Maklerprovision|Courtage|External commission|Provision/i.test(item));
    push(flags, 'commissionAboveShare', line ? evidenceQuote(line) : undefined);
  }
  for (const line of scoped) {
    const backlog = clearMatch(line, BACKLOG);
    if (backlog) { push(flags, 'maintenanceBacklog', evidenceQuote(line, backlog.index)); break; }
  }
  for (const line of scoped) {
    const sale = clearMatch(line, FORCED_SALE);
    if (sale) { push(flags, 'forcedSale', evidenceQuote(line, sale.index)); break; }
  }
  if (report.facts.tenancy === 'Rented') {
    const line = scoped.find(lineSaysRented) || scoped.find(item => /\bvermietet\b/i.test(item) && !/(?:nicht|un)\s*vermietet/i.test(item));
    const sentence = line?.split(/(?<=[.!?])\s+/).find(sentenceSaysRented) || '';
    const at = line && sentence ? line.indexOf(sentence) : 0;
    push(flags, 'rentedOccupied', line ? evidenceQuote(line, Math.max(0, at)) : undefined);
  }
  const heating = heatingInstallYear(scoped);
  const asOf = Number(report.createdAt.slice(0, 4));
  const system = `${report.facts.heating || ''} ${report.facts.energySource || ''}`;
  if (heating && OIL_GAS.test(system) && asOf - heating.year >= 30) {
    push(flags, 'heatingAge', heating.evidence);
  }
  const energyKnown = Boolean(report.facts.energy && report.facts.energy !== 'not stated');
  if (!energyKnown && !report.facts.energyDemand && !report.facts.energyCertificate && !certificateMentioned(scoped)) {
    push(flags, 'noEnergyData');
  }
  if (report.propertyType === 'flat' && !report.facts.housegeld) push(flags, 'noHausgeld');
  if (report.facts.floor === 'Souterrain') {
    const line = scoped.find(item => /Souterrain/i.test(item));
    push(flags, 'basement', line ? evidenceQuote(line) : undefined);
  }
  for (const line of scoped) {
    const social = clearMatch(line, SOCIAL);
    if (social) { push(flags, 'socialHousing', evidenceQuote(line, social.index)); break; }
  }
  for (const line of scoped) {
    const listed = clearMatch(line, LISTED);
    if (listed) { push(flags, 'listedBuilding', evidenceQuote(line, listed.index)); break; }
  }
  const rank = (id: RedFlagId) => (HIGH.has(id) ? 0 : 1) * 100 + RED_FLAG_IDS.indexOf(id);
  return flags.sort((a, b) => rank(a.id) - rank(b.id));
}
