import type { Report } from './types';

export function displayAddress(address: string) {
  return address
    .replace(/^\s*(?:(?:provisionsfrei|courtagefrei|von\s+privat|privatverkauf)[\s·,:-]*)+/i, '')
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
  const base = `${report.facts.rooms}-room ${report.propertyType}`;
  const savedSuffix = report.title?.split('·').slice(1).join('·').trim();
  if (savedSuffix && !/(street|address|location) not stated/i.test(savedSuffix)) return `${base} · ${savedSuffix}`;
  const location = factualLocation(report);
  return location ? `${base} · ${location}` : base;
}
