'use client';

import { usePathname } from 'next/navigation';
import type { Locale } from '@/lib/i18n';
import { NavChevron } from './NavChevron';

export function LanguageSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const switchTo = (next: Locale) => {
    if (next === locale) return;
    const englishPath = pathname.replace(/^\/de(?=\/|$)/, '') || '/';
    window.location.href = next === 'de' ? (englishPath === '/' ? '/de' : `/de${englishPath}`) : englishPath;
  };

  return <label className="language-switch">
    <span className="sr-only">{locale === 'de' ? 'Sprache' : 'Language'}</span>
    <select value={locale} onChange={(event) => switchTo(event.target.value as Locale)} aria-label={locale === 'de' ? 'Sprache wählen' : 'Choose language'}>
      <option value="en">EN</option>
      <option value="de">DE</option>
    </select>
    <NavChevron />
  </label>;
}
