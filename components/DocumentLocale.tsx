'use client';

import { useEffect } from 'react';
import type { Locale } from '@/lib/i18n';

export function DocumentLocale({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    return () => { document.documentElement.lang = 'en'; };
  }, [locale]);
  return null;
}
