export const FMH_MORTGAGE_RATE_SOURCE_URL = 'https://index.fmh.de/fmh/';
export const FMH_MORTGAGE_RATE_SOURCE_NAME = 'FMH Index';

export type MortgageRateSnapshot = {
  rate: number;
  observedAt: string;
  fetchedAt: string;
  sourceName: typeof FMH_MORTGAGE_RATE_SOURCE_NAME;
  sourceUrl: typeof FMH_MORTGAGE_RATE_SOURCE_URL;
  fixationYears: 10;
  stale: boolean;
};

function isoObservationDate(dateText: string, now: Date) {
  const match = dateText.match(/^(\d{1,2})\.(\d{1,2})\.$/);
  if (!match) return;
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return;

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let year = now.getUTCFullYear();
  let candidate = Date.UTC(year, month - 1, day);
  if (candidate - today > 45 * 24 * 60 * 60 * 1_000) {
    year -= 1;
    candidate = Date.UTC(year, month - 1, day);
  }
  const date = new Date(candidate);
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) return;
  return date.toISOString().slice(0, 10);
}

export function parseFmhMortgageRate(html: string, now = new Date()) {
  const table = html.match(/<tr[^>]+id=["']ucDailyDetailBG10_trHeader["'][^>]*>[\s\S]*?<\/table>/i)?.[0];
  if (!table) throw new Error('The FMH 10-year mortgage-rate table was not found.');

  const text = table
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const observedAt = isoObservationDate(text.match(/Baugeld\s+Eff\.zins\s+10\s+J\.\s+(\d{1,2}\.\d{1,2}\.)/i)?.[1] || '', now);
  const rawRate = text.match(/FMH-IndeX\s+(\d{1,2}[,.]\d{1,2})/i)?.[1];
  const rate = rawRate ? Number(rawRate.replace(',', '.')) : Number.NaN;

  if (!observedAt || !Number.isFinite(rate) || rate < 1 || rate > 12) {
    throw new Error('The FMH 10-year mortgage rate could not be validated.');
  }
  return { rate, observedAt };
}
