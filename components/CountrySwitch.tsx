'use client';
import { countries, type CountryCode } from '@/lib/countries';
import { NavChevron } from './NavChevron';

export function CountrySwitch({ country = 'DE', locale = 'en' }: { country?: CountryCode; locale?: 'en' | 'de' }) {
  const label = (code: CountryCode) => locale === 'de' && code === 'DE' ? 'Deutschland' : countries[code].name;
  return <label className="country-switch"><span className="sr-only">Property country</span>
    <span className="country-switch-value" aria-hidden="true">{label(country)}</span>
    <select aria-label="Property country" value={country} onChange={event => {
      const selected = event.target.value as CountryCode;
      window.location.href = selected === 'DE' && locale === 'de' ? '/de' : countries[selected].path;
    }}>{(Object.keys(countries) as CountryCode[]).map(code => <option value={code} key={code}>{label(code)}</option>)}</select><NavChevron />
  </label>;
}
