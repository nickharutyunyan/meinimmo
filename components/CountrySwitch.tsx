'use client';
import { countries, type CountryCode } from '@/lib/countries';
import { NavChevron } from './NavChevron';

export function CountrySwitch({ country = 'DE', locale = 'en' }: { country?: CountryCode; locale?: 'en' | 'de' }) {
  return <label className="country-switch"><span className="sr-only">Property country</span>
    <select aria-label="Property country" value={country} onChange={event => {
      const selected = event.target.value as CountryCode;
      window.location.href = selected === 'DE' && locale === 'de' ? '/de' : countries[selected].path;
    }}>{Object.entries(countries).map(([code, value]) => <option value={code} key={code}>{locale === 'de' && code === 'DE' ? 'Deutschland' : value.name}</option>)}</select><NavChevron />
  </label>;
}
