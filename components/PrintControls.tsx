'use client';

import { useEffect } from 'react';
import type { Locale } from '@/lib/i18n';

export function PrintControls({ returnUrl, locale, autoPrint }: { returnUrl: string; locale: Locale; autoPrint: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    let timer: ReturnType<typeof setTimeout>;
    document.fonts.ready.then(() => { timer = setTimeout(() => window.print(), 250); });
    return () => clearTimeout(timer);
  }, [autoPrint]);

  return <nav className="print-controls" aria-label={locale === 'de' ? 'Druckoptionen' : 'Print options'}>
    <a href={returnUrl}>{locale === 'de' ? '← Zurück zum Bericht' : '← Back to report'}</a>
    <button onClick={() => window.print()}>{locale === 'de' ? 'Als PDF speichern / drucken' : 'Save as PDF / Print'}</button>
  </nav>;
}
