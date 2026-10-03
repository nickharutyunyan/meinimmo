export type CountryCode = 'DE' | 'AM' | 'US' | 'CA';
export const countries = {
  DE: { name: 'Germany', path: '/', currency: 'EUR', ready: true },
  AM: { name: 'Armenia', path: '/am', currency: 'AMD', ready: true },
  US: { name: 'United States', path: '/us', currency: 'USD', ready: false },
  CA: { name: 'Canada', path: '/ca', currency: 'CAD', ready: false },
} as const;

export const amd = (value: number) => `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(value)} AMD`;
export const mapsLink = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, Armenia`)}`;

export function monthlyPayment(principal: number, annualRate: number, years: number) {
  if (![principal, annualRate, years].every(Number.isFinite) || principal < 0 || annualRate < 0 || years <= 0) return 0;
  const months = years * 12;
  const rate = annualRate / 1200;
  return rate === 0 ? principal / months : principal * rate / (1 - Math.pow(1 + rate, -months));
}
