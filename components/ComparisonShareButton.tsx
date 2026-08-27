'use client';

import { useState } from 'react';
import type { Locale } from '@/lib/i18n';

export function ComparisonShareButton({ locale }: { locale: Locale }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      const input = document.createElement('textarea');
      input.value = window.location.href;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  const label = copied ? (locale === 'de' ? 'Link kopiert' : 'Link copied') : (locale === 'de' ? 'Vergleich teilen' : 'Share comparison');
  return <button className="comparison-share-button" type="button" onClick={copy}><span aria-hidden="true">{copied ? '✓' : '↗'}</span>{label}</button>;
}
