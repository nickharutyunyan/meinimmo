import Link from 'next/link';
import { localePath, type Locale } from '@/lib/i18n';
import { BrandHouse, NightStreet } from './Illustrations';

export function SiteFooter({ locale }: { locale: Locale }) {
  const de = locale === 'de';
  const build = process.env.NEXT_PUBLIC_BUILD_SHA;
  return <footer className="site-footer">
    <NightStreet />
    <div className="site-footer-inner">
      <div className="site-footer-brand">
        <Link href={localePath(locale)} className="site-footer-mark"><BrandHouse /><span>Review a House</span></Link>
        <p>{de ? 'Für alle, die in Deutschland ein Zuhause suchen, finden und kaufen. Ruhig, ehrlich, mit Quellen.' : 'For everyone looking for, finding and buying a home in Germany. Calm, honest and sourced.'}</p>
      </div>
      <nav aria-label={de ? 'Entdecken' : 'Explore'}>
        <h2>{de ? 'Entdecken' : 'Explore'}</h2>
        <Link href={localePath(locale, '/buy')}>{de ? 'Immobilien kaufen' : 'Homes for sale'}</Link>
        <Link href={localePath(locale, '/sell')}>{de ? 'Privat verkaufen' : 'Sell privately'}</Link>
        <Link href={localePath(locale)}>{de ? 'Angebot prüfen' : 'Review a listing'}</Link>
        <Link href={localePath(locale, '/guide')}>Guide</Link>
      </nav>
      <nav aria-label={de ? 'Über uns' : 'About'}>
        <h2>{de ? 'Über uns' : 'About'}</h2>
        <Link href={localePath(locale, '/method')}>{de ? 'So prüfen wir' : 'How we review'}</Link>
        <Link href={localePath(locale, '/roadmap')}>Roadmap</Link>
        <Link href={localePath(locale, '/terms')}>{de ? 'Nutzungsbedingungen' : 'Terms'}</Link>
        <Link href={localePath(locale, '/account')}>{de ? 'Konto' : 'Account'}</Link>
      </nav>
    </div>
    <p className="site-footer-legal">© 2026 Nick Harutyunyan{build ? <span className="build-tag">{build}</span> : null}</p>
  </footer>;
}
