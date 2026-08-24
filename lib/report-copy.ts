import type { Locale } from './i18n';
import type { Report } from './types';

const UNKNOWN = /not stated|unknown/i;
const stated = (value?: string) => Boolean(value && !UNKNOWN.test(value));

export function localizedSummary(report: Report, locale: Locale) {
  if (locale === 'en') return report.summary;
  const { facts } = report;
  const type = report.propertyType === 'flat' ? 'Wohnung' : 'Haus';
  const roomPrefix = stated(facts.rooms) ? `${facts.rooms.replace('.', ',')}-Zimmer-` : '';
  const place = report.location ? ` in ${report.location}` : facts.city ? ` in ${facts.city}` : '';
  const space = facts.area
    ? ` hat ${facts.area.toLocaleString('de-DE', { maximumFractionDigits: 1 })} m² Wohnfläche${facts.usableArea ? ` und ${facts.usableArea.toLocaleString('de-DE', { maximumFractionDigits: 1 })} m² Nutzfläche` : ''}`
    : ' hat keine klar bestätigte Wohnfläche';
  const price = facts.price ? ` Der Kaufpreis liegt bei ${facts.price.toLocaleString('de-DE')} €${facts.area ? ` (${Math.round(facts.price / facts.area).toLocaleString('de-DE')} €/m²)` : ''}.` : '';
  const building = [
    stated(facts.year) ? `Baujahr ${facts.year}` : '',
    stated(facts.condition) ? `Zustand laut Angebot: ${facts.condition}` : '',
    stated(facts.energy) ? `Energieklasse ${facts.energy}` : '',
    facts.energySource ? `Energieträger ${facts.energySource}` : '',
  ].filter(Boolean).join(', ');
  const first = `Diese ${roomPrefix}${type}${place}${space}.${price}${building ? ` Dazu kommen ${building}.` : ''}`;
  const occupancy = facts.tenancy === 'Rented'
    ? `Die Immobilie wird vermietet verkauft${facts.advertisedYield ? `; angegeben sind ${facts.advertisedYield.toLocaleString('de-DE', { maximumFractionDigits: 2 })} % Rendite` : ''}. Lass dir Nettokaltmiete, Mietvertrag und Renditerechnung zeigen.`
    : 'Kläre vor einer Zusage, ob die Immobilie frei übergeben wird und ob Rechte Dritter bestehen.';
  const costs = facts.housegeld ? ` Das Hausgeld liegt laut Angebot bei ${facts.housegeld.toLocaleString('de-DE')} € im Monat. Wichtig ist die Trennung zwischen umlagefähigem und eigenem Anteil.` : '';
  return `${first}\n\n${occupancy}${costs}`;
}

export function localizedConsiderations(report: Report, locale: Locale) {
  if (locale === 'en') return report.considerations;
  const { facts } = report;
  const items: string[] = [];
  if (facts.tenancy === 'Rented') items.push(`Rechne die${facts.advertisedYield ? ` angegebenen ${facts.advertisedYield.toLocaleString('de-DE')} %` : ''} Rendite mit Mietvertrag, jährlicher Nettokaltmiete, Zahlungshistorie und nicht umlagefähigen Kosten selbst nach.`);
  if (facts.housegeld) items.push(`Lass dir die ${facts.housegeld.toLocaleString('de-DE')} € Hausgeld pro Monat, die WEG-Rücklage, geplante Arbeiten und mögliche Sonderumlagen genau aufschlüsseln.`);
  if (!stated(facts.floor)) items.push('Die genaue Etage fehlt. Kläre Lage im Gebäude, barrierefreien Zugang, Aufzug, Straßen- oder Hofseite und mögliche Geräusche.');
  if (stated(facts.energy)) items.push(`Prüfe den ${facts.energyCertificate || 'Energieausweis'}, echte Jahresverbräuche und den Tarif für ${facts.energySource || facts.heating}, statt dich nur auf Klasse ${facts.energy} zu verlassen.`);
  if (facts.features?.some((feature) => /terrasse|garten/i.test(feature))) items.push('Prüfe, ob Terrasse und Garten rechtlich in der Teilungserklärung stehen und wer für die Pflege zuständig ist.');
  if (!items.length) items.push('Fordere das vollständige Exposé, den Energieausweis, WEG-Unterlagen und eine klare Aufstellung der laufenden Kosten an.');
  return items.slice(0, 4);
}

export function localizedWarnings(report: Report, locale: Locale) {
  if (locale === 'en') return report.qualityWarnings || [];
  return (report.qualityWarnings || []).map((warning) => {
    if (/exact street address/i.test(warning)) return 'Die genaue Straßenadresse steht nicht im Angebot.';
    if (/exact floor/i.test(warning)) return 'Die genaue Etage steht nicht im Angebot.';
    if (/buyer costs are estimated/i.test(warning)) return 'Die Kaufnebenkosten sind geschätzt, weil das Angebot keine vollständige Summe nennt.';
    if (/rented but no verified yield/i.test(warning)) return 'Die Immobilie ist vermietet, aber es wurde keine verlässliche Renditeangabe gefunden.';
    return warning;
  });
}

export function offerQuestionsFor(report: Report, locale: Locale = 'en') {
  const { facts } = report;
  const questions: string[] = [];
  if (locale === 'de') {
    if (facts.tenancy === 'Rented') {
      questions.push(`Bitte schickt mir den unterschriebenen Mietvertrag, die aktuelle Jahresnettokaltmiete, Angaben zur Kaution und die Zahlungshistorie${facts.features?.some((feature) => /möbliert|furnished/i.test(feature)) ? ' sowie das unterschriebene Inventarverzeichnis' : ''}. Wie ergibt sich daraus die${facts.advertisedYield ? ` angegebene Rendite von ${facts.advertisedYield.toLocaleString('de-DE')} %` : ' Rendite'}?`);
    } else {
      questions.push('Wie genau ist der aktuelle Nutzungs- und Übergabestatus? Gibt es Mietverträge, Wohnrechte oder andere Rechte Dritter?');
    }
    if (facts.housegeld) questions.push(`Bitte schlüsselt die ${facts.housegeld.toLocaleString('de-DE')} € Hausgeld pro Monat in umlagefähige und eigene Kosten auf und schickt WEG-Rücklage, Wirtschaftsplan, die letzten drei Protokolle und geplante Sonderumlagen mit.`);
    else if (report.propertyType === 'flat') questions.push('Bitte schickt die aktuelle Hausgeld-Aufteilung, WEG-Rücklage, den Wirtschaftsplan, die letzten drei Versammlungsprotokolle und Infos zu geplanten Sonderumlagen.');
    if (!stated(facts.floor)) {
      const outsideRights = facts.features?.filter((feature) => /terrasse|garten/i.test(feature)).join(' und ');
      questions.push(`In welcher Etage und an welcher Stelle im Gebäude liegt die Wohnung genau? Wie ist der barrierefreie Weg, und ${outsideRights ? `sind ${outsideRights} in der Teilungserklärung festgehalten` : 'gibt es einen Aufzug und Angaben zum Schallschutz'}?`);
    } else questions.push(`Wie sind in der ${facts.floor} Lärm, direktes Sonnenlicht und Zugang zu verschiedenen Tageszeiten?`);
    if (stated(facts.energy)) questions.push(`Bitte schickt den vollständigen ${facts.energyCertificate || 'Energieausweis'}, die letzten drei Energieabrechnungen und Angaben zu Tarif und Zähler für ${facts.energySource || facts.heating}.`);
    else questions.push('Bitte schickt den gültigen Energieausweis, die letzten drei Energieabrechnungen und Angaben zu Heizung, Tarif und geplanten Modernisierungen.');
    if (questions.length < 4) questions.push('Gibt es Baulasten, Dienstbarkeiten, bekannte Mängel, Versicherungsschäden, offene Genehmigungen oder laufende Rechtsstreitigkeiten?');
    return questions.slice(0, 4);
  }

  if (facts.tenancy === 'Rented') {
    questions.push(`Please provide the signed lease, current annual net cold rent, tenant deposit, payment history${facts.features?.some((feature) => /möbliert|furnished/i.test(feature)) ? ' and the signed furnishings inventory' : ''}; how does this support the advertised ${facts.advertisedYield ? `${facts.advertisedYield.toLocaleString('en-GB')}% return` : 'return'}?`);
  } else questions.push('What is the exact occupancy and handover status, and are any leases, occupancy rights or other third-party rights registered or agreed?');
  if (facts.housegeld) questions.push(`Please itemize the €${facts.housegeld.toLocaleString('de-DE')} monthly Hausgeld into recoverable and owner-only costs, and provide the current WEG reserve, Wirtschaftsplan, three latest meeting minutes and any planned Sonderumlagen.`);
  else if (report.propertyType === 'flat') questions.push('Please provide the current Hausgeld breakdown, WEG reserve, Wirtschaftsplan, three latest meeting minutes and details of planned Sonderumlagen.');
  if (!stated(facts.floor)) {
    const outsideRights = facts.features?.filter((feature) => /terrasse|garten/i.test(feature)).join(' and ');
    questions.push(`Which exact floor and building position is the unit on, what is the barrier-free route, and ${outsideRights ? `are the ${outsideRights} rights recorded in the Teilungserklärung` : 'is there lift access and documented sound insulation'}?`);
  } else questions.push(`For the ${facts.floor} position, what are the measured noise, direct-light and access conditions at different times of day?`);
  if (stated(facts.energy)) questions.push(`Please provide the complete ${facts.energyCertificate || 'energy certificate'}, the last three annual energy bills and the current ${facts.energySource || facts.heating} tariff and metering arrangement${facts.tenancy === 'Rented' ? ', including which heating costs are recoverable from the tenant' : ''}.`);
  else questions.push('Please provide the valid Energieausweis, the last three annual energy bills and details of the heating system, tariff and planned upgrades.');
  if (questions.length < 4) questions.push('Are there any easements, building permits, defects, insurance claims or pending legal disputes that are not disclosed in the Exposé?');
  return questions.slice(0, 4);
}
