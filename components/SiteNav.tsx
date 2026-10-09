import Link from 'next/link';
import { Brand } from './Brand';
import { LanguageSwitch } from './LanguageSwitch';
import { AccountNav } from './AccountNav';
import { copy, localePath, type Locale } from '@/lib/i18n';
import { CountrySwitch } from './CountrySwitch';
import { countries, type CountryCode } from '@/lib/countries';

export function SiteNav({ locale, landing = false, country = 'DE' }: { locale: Locale; landing?: boolean; country?: CountryCode }) {
  const text = copy[locale].nav;
  const home = country === 'DE' ? localePath(locale) : countries[country].path;
  return <nav className="site-nav">
    <Brand locale={locale} href={home} />
    <div className="nav-note country-note"><span className="country-descriptor">{text.note}</span><CountrySwitch country={country} locale={locale}/></div>
    <div className="nav-links">
      {country === 'DE' && <Link href={localePath(locale, '/buy')}>{locale === 'de' ? 'Kaufen' : 'Buy'}</Link>}
      {country === 'DE' && <Link href={localePath(locale, '/sell')}>{locale === 'de' ? 'Verkaufen' : 'Sell'}</Link>}
      <Link href={landing ? '#how' : `${home}#how`}>{text.approach}</Link>
      {country === 'DE' && <Link href={localePath(locale, '/guide')}>{text.guide}</Link>}
      <Link href={landing ? '#faq' : `${home}#faq`}>{text.faq}</Link>
      <AccountNav locale={locale} />
      {country === 'DE' ? <LanguageSwitch locale={locale} /> : <span className="market-language" title="This country preview is currently in English">EN</span>}
    </div>
  </nav>;
}
