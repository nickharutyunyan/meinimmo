import Link from 'next/link';
import { localePath, type Locale } from '@/lib/i18n';

export function SiteFooter({ locale }: { locale: Locale }) {
  const de = locale === 'de';
  const build = process.env.NEXT_PUBLIC_BUILD_SHA;
  return <footer className="site-footer">
    <span>© 2026 Nick Harutyunyan{build ? <span className="build-tag">{build}</span> : null}</span>
    <nav aria-label={de ? 'Fußzeile' : 'Footer'}>
      <Link href={localePath(locale, '/buy')}>{de ? 'Kaufen' : 'Buy'}</Link>
      <Link href={localePath(locale, '/sell')}>{de ? 'Verkaufen' : 'Sell'}</Link>
      <Link href={localePath(locale, '/roadmap')}>Roadmap</Link>
      <Link href={localePath(locale, '/method')}>{de ? 'So prüfen wir' : 'How we review'}</Link>
      <Link href={localePath(locale, '/terms')}>{de ? 'Nutzungsbedingungen' : 'Terms'}</Link>
      <Link href={localePath(locale, '/account')}>{de ? 'Konto' : 'Account'}</Link>
    </nav>
  </footer>;
}
