import Link from 'next/link';
import { Brand } from './Brand';
import { LanguageSwitch } from './LanguageSwitch';
import { copy, localePath, type Locale } from '@/lib/i18n';

export function SiteNav({ locale, landing = false }: { locale: Locale; landing?: boolean }) {
  const text = copy[locale].nav;
  const home = localePath(locale);
  return <nav className="site-nav">
    <Brand locale={locale} />
    <div className="nav-note">{text.note} <span>{text.country}</span></div>
    <div className="nav-links">
      <Link href={landing ? '#how' : `${home}#how`}>{text.approach}</Link>
      <Link href={localePath(locale, '/guide')}>{text.guide}</Link>
      <Link href={landing ? '#faq' : `${home}#faq`}>{text.faq}</Link>
      <LanguageSwitch locale={locale} />
    </div>
  </nav>;
}
