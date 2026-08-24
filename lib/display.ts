import type { Report } from './types';

export function displayAddress(address: string) {
  return address
    .replace(/\b(?:provisionsfrei|courtagefrei|von\s+privat|privatverkauf)\b/gi, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .replace(/[.;,]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function factualLocation(report: Pick<Report, 'address' | 'location' | 'source'>) {
  if (report.location && !/not stated/i.test(report.location)) return report.location;
  const evidence = `${report.address || ''} ${report.source || ''}`;
  const berlinArea = evidence.match(/\bBerlin[-_\s]+([A-ZÄÖÜ][\p{L}äöüß-]{2,})/u)?.[1];
  if (berlinArea && !/pdf|expos[eé]|wohnung/i.test(berlinArea)) return berlinArea;
  const labeled = evidence.match(/\b(?:Stadtteil|Ortsteil|Bezirk|Kiez)\s*[:_-]?\s*([A-ZÄÖÜ][\p{L}äöüß-]{2,}(?:\s+[A-ZÄÖÜ][\p{L}äöüß-]{2,})?)/u)?.[1];
  return labeled || '';
}

export function reportTitle(report: Pick<Report, 'title' | 'address' | 'location' | 'source' | 'propertyType' | 'facts'>) {
  const rooms = report.facts.rooms;
  const base = rooms && !/not stated|unknown/i.test(rooms)
    ? `${rooms.replace(',', '.')}-room ${report.propertyType}`
    : report.facts.area
      ? `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(report.facts.area)} m² ${report.propertyType}`
      : report.facts.year && !/not stated|unknown/i.test(report.facts.year)
        ? `${report.facts.year}-built ${report.propertyType}`
        : report.propertyType === 'flat' ? 'Flat' : 'House';
  const location = factualLocation(report);
  if (location) return `${base} · ${location}`;
  const savedSuffix = report.title?.split('·').slice(1).join('·').trim();
  if (savedSuffix && !/(street|address|location) not stated/i.test(savedSuffix)) return `${base} · ${savedSuffix}`;
  return base;
}
