import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { parseCbaExchangeRates, parseAcbaMortgageRate, AM_MORTGAGE_URL, type ArmeniaRate } from './armenia-finance';
import type { FxRates } from './armenia-parser';

export async function armeniaFx(): Promise<FxRates> {
  const response = await fetch('https://api.cba.am/exchangerates.asmx', {
    method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'http://www.cba.am/ExchangeRatesLatest' },
    body: '<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ExchangeRatesLatest xmlns="http://www.cba.am/" /></soap:Body></soap:Envelope>',
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error('CBA unavailable');
  const data = parseCbaExchangeRates(await response.text());
  // Weekends/holidays are expected, but never silently use a very old quote.
  if (Date.now() - Date.parse(data.date) > 7 * 86400000 || Date.parse(data.date) > Date.now() + 86400000) throw new Error('CBA rate is out of date');
  return data;
}

export async function armeniaMortgageRate(): Promise<ArmeniaRate | null> {
  const key = 'Acba AMD mortgage example';
  let stored: { rate: number; fetched_at: string } | null = null;
  const { env } = await getCloudflareContext({ async: true });
  try { stored = await env.DB.prepare('SELECT rate, fetched_at FROM mortgage_rate_snapshots WHERE source = ?1').bind(key).first(); } catch { /* cache is optional */ }
  const snapshot = (rate: number, checkedAt: string, stale: boolean): ArmeniaRate => ({ rate, checkedAt, stale, sourceName: key, sourceUrl: AM_MORTGAGE_URL });
  if (stored && Date.now() - Date.parse(stored.fetched_at) < 86400000) return snapshot(stored.rate, stored.fetched_at, false);
  try {
    const response = await fetch(AM_MORTGAGE_URL, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error('Lender source unavailable');
    const rate = parseAcbaMortgageRate(await response.text());
    const now = new Date().toISOString();
    try { await env.DB.prepare('INSERT INTO mortgage_rate_snapshots (source,rate,observed_at,fetched_at) VALUES (?1,?2,?3,?3) ON CONFLICT(source) DO UPDATE SET rate=excluded.rate,observed_at=excluded.observed_at,fetched_at=excluded.fetched_at').bind(key, rate, now).run(); } catch { /* A cache write failure must not discard a verified live quote. */ }
    return snapshot(rate, now, false);
  } catch (error) {
    console.warn('Armenia mortgage refresh unavailable', { reason: error instanceof Error ? error.message : 'Unknown failure' });
    // Independently checked against Acba's published example on this date.
    // This dated fallback is never presented as a fresh or market-average rate.
    const fallback = stored || { rate: 13.5, fetched_at: '2026-09-22T12:00:00.000Z' };
    return Date.now() - Date.parse(fallback.fetched_at) < 30 * 86400000 ? snapshot(fallback.rate, fallback.fetched_at, true) : null;
  }
}
