import Link from 'next/link';

export function HomeMark({ decorative = true }: { decorative?: boolean }) {
  return <svg className="home-mark" viewBox="0 0 32 32" role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : 'Good Homes'}>
    <rect x="1" y="1" width="30" height="30" rx="9" fill="currentColor" />
    <path d="M7.2 15.2 16 7.8l8.8 7.4v8.1a1.9 1.9 0 0 1-1.9 1.9H9.1a1.9 1.9 0 0 1-1.9-1.9v-8.1Z" fill="var(--lime)" />
    <path d="M20.9 8.8v-2h2.7v4.3" fill="none" stroke="var(--lime)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 21.8s-3.7-2.1-3.7-4.6c0-1.3.9-2.2 2.1-2.2.8 0 1.3.4 1.6 1 .3-.6.8-1 1.6-1 1.2 0 2.1.9 2.1 2.2 0 2.5-3.7 4.6-3.7 4.6Z" fill="currentColor" />
  </svg>;
}

export function Brand({ className = '' }: { className?: string }) {
  return <Link href="/" className={`brand-mark ${className}`.trim()} aria-label="Good Homes home">
    <HomeMark />
    <span className="brand-word">Good Homes</span>
  </Link>;
}
