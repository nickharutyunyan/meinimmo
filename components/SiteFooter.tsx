import Link from 'next/link';
import { localePath, type Locale } from '@/lib/i18n';

export function SiteFooter({ locale }: { locale: Locale }) {
  const de = locale === 'de';
  return <footer className="site-footer">
    <span>© 2026 Nick Harutyunyan</span>
    <nav aria-label={de ? 'Rechtliches' : 'Legal'}>
      <Link href={localePath(locale, '/terms')}>{de ? 'Nutzungsbedingungen' : 'Terms'}</Link>
      <Link href={localePath(locale, '/account')}>{de ? 'Konto' : 'Account'}</Link>
    </nav>
  </footer>;
}
