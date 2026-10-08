'use client';

import { useEffect, useState } from 'react';
import { SiteFooter } from './SiteFooter';
import { SiteNav } from './SiteNav';
import type { Locale } from '@/lib/i18n';
import { GlossaryText } from './GlossaryText';
import { termsSections } from '@/lib/terms-copy';

export function TermsPage({ locale }: { locale: Locale }) {
  const de = locale === 'de';
  const [paidPlansOffered, setPaidPlansOffered] = useState(false);
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() as Promise<{ paidPlansEnabled?: boolean }> : null)
      .then((data) => setPaidPlansOffered(Boolean(data?.paidPlansEnabled)))
      .catch(() => setPaidPlansOffered(false));
  }, []);
  const sections = termsSections(locale, paidPlansOffered);
  return <main className="terms-page" lang={locale}>
    <SiteNav locale={locale} />
    <article>
      <p className="eyebrow">{de ? 'KURZ & VERSTÄNDLICH' : 'PLAIN-LANGUAGE TERMS'}</p>
      <h1>{de ? 'Nutzungsbedingungen' : 'Terms of use'}</h1>
      <p className="terms-intro">{de ? 'Die wichtigsten Regeln ohne unnötiges Kleingedrucktes.' : 'The basic rules, without unnecessary legal fog.'}</p>
      {sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p><GlossaryText locale={locale}>{body}</GlossaryText></p></section>)}
    </article>
    <SiteFooter locale={locale} />
  </main>;
}
