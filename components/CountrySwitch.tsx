'use client';
import { countries, countryLabel, countrySwitchLabel, type CountryCode } from '@/lib/countries';
import { NavChevron } from './NavChevron';

export function CountrySwitch({ country = 'DE', locale = 'en' }: { country?: CountryCode; locale?: 'en' | 'de' }) {
  const legend = countrySwitchLabel(locale);
  return <label className="country-switch"><span className="sr-only">{legend}</span>
    <span className="country-switch-value" aria-hidden="true">{countryLabel(country, locale)}</span>
    <select aria-label={legend} value={country} onChange={event => {
      const selected = event.target.value as CountryCode;
      window.location.href = selected === 'DE' && locale === 'de' ? '/de' : countries[selected].path;
    }}>{(Object.keys(countries) as CountryCode[]).map(code => <option value={code} key={code}>{countryLabel(code, locale)}</option>)}</select><NavChevron />
  </label>;
}
