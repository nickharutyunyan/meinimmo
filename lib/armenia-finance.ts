import type { FxRates } from './armenia-parser';

export const CBA_FX_URL = 'https://www.cba.am/en/exchange-rates-retrieval';
export const AM_MORTGAGE_URL = 'https://acba.am/en/individual/loan/161';
export type ArmeniaRate = { rate: number; checkedAt: string; sourceUrl: string; sourceName: string; stale: boolean };

export function parseCbaExchangeRates(xml: string): FxRates {
  const date = xml.match(/<CurrentDate>(\d{4}-\d{2}-\d{2})/)?.[1];
  const rates: Record<string, number> = { AMD: 1 };
  for (const match of xml.matchAll(/<ExchangeRate>([\s\S]*?)<\/ExchangeRate>/g)) {
    const iso = match[1].match(/<ISO>([A-Z]{3})<\/ISO>/)?.[1];
    const rate = Number(match[1].match(/<Rate>([\d.]+)<\/Rate>/)?.[1]);
    const amount = Number(match[1].match(/<Amount>([\d.]+)<\/Amount>/)?.[1]);
    if (iso && rate > 0 && amount > 0) rates[iso] = rate / amount;
  }
  if (!date || !rates.USD || !rates.EUR) throw new Error('Invalid CBA exchange-rate response.');
  return { date, rates, sourceUrl: CBA_FX_URL };
}

export function parseAcbaMortgageRate(html: string) {
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  // An explicitly labelled lender example, NOT a national average or CBA policy rate.
  const rate = Number(text.match(/Loan interest calculation example:[\s\S]{0,350}?Loan interest rate\s*[–—-]\s*(\d+(?:\.\d+)?)%\s*\(floating\)/i)?.[1]);
  if (rate < 3 || rate > 30 || !Number.isFinite(rate)) throw new Error('Mortgage source format changed.');
  return rate;
}
