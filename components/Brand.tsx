import Link from 'next/link';
import { localePath, type Locale } from '@/lib/i18n';
import { BrandHouse } from './Illustrations';

export function HomeMark({ decorative = true }: { decorative?: boolean }) {
  return <span className="home-mark-wrap" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : 'Review a House'}><BrandHouse /></span>;
}

export function Brand({ className = '', locale = 'en', href }: { className?: string; locale?: Locale; href?: string }) {
  return <Link href={href || localePath(locale)} className={`brand-mark ${className}`.trim()} aria-label={locale === 'de' ? 'Review a House Startseite' : 'Review a House home'}>
    <HomeMark />
    <span className="brand-word">Review a House</span>
  </Link>;
}
