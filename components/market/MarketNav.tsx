import Link from 'next/link';
import { Brand } from '../Brand';
import { AccountNav } from '../AccountNav';
import { LanguageSwitch } from '../LanguageSwitch';
import { localePath, type Locale } from '@/lib/i18n';
import { marketCopy } from '@/lib/market/copy';
import { MARKET_CITIES, MARKET_SLUGS } from '@/lib/market/cities';

/** The compact bar for the market pages: cities up front, selling one tap away. */
export function MarketNav({ locale, current }: { locale: Locale; current?: string }) {
  const text = marketCopy[locale];
  return <nav className="market-nav">
    <Brand locale={locale} href={localePath(locale, '/buy')} />
    <div className="market-nav-cities">
      {MARKET_SLUGS.map(slug => <Link
        key={slug}
        href={localePath(locale, `/buy/${slug}`)}
        aria-current={current === slug ? 'page' : undefined}
      >{MARKET_CITIES[slug].name[locale]}</Link>)}
    </div>
    <div className="market-nav-actions">
      <Link className="market-nav-review" href={localePath(locale)}>{text.nav.review}</Link>
      <Link className="market-nav-sell" href={localePath(locale, '/sell')} aria-current={current === 'sell' ? 'page' : undefined}>{text.nav.sell}</Link>
      <AccountNav locale={locale} />
      <LanguageSwitch locale={locale} />
    </div>
  </nav>;
}
