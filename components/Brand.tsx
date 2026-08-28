import Link from 'next/link';
import { localePath, type Locale } from '@/lib/i18n';

export function HomeMark({ decorative = true }: { decorative?: boolean }) {
  return <svg className="home-mark" viewBox="0 0 32 32" role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : 'Review a House'}>
    <path className="home-mark-field" d="M15 4.7a1.6 1.6 0 0 1 2 0l10 8.1c.65.53 1 1.22 1 2.05v9.7a2.75 2.75 0 0 1-2.75 2.75H6.75A2.75 2.75 0 0 1 4 24.55v-9.7c0-.83.35-1.52 1-2.05Z" fill="currentColor" />
    <path className="home-mark-check" d="m10.3 17.2 4.1 3.9 8.2-8.65" fill="none" stroke="var(--lime)" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

export function Brand({ className = '', locale = 'en' }: { className?: string; locale?: Locale }) {
  return <Link href={localePath(locale)} className={`brand-mark ${className}`.trim()} aria-label={locale === 'de' ? 'Review a House Startseite' : 'Review a House home'}>
    <HomeMark />
    <span className="brand-word">Review a House</span>
  </Link>;
}
