'use client';

import { useState } from 'react';
import { localePath, type Locale } from '@/lib/i18n';

export function PlanButton({ plan, locale, children }: { plan: 'pro' | 'ultra'; locale: Locale; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function checkout() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan, locale }) });
      const data = await response.json() as { url?: string; code?: string; error?: string };
      if (response.status === 401 || data.code === 'auth_required') {
        location.href = `${localePath(locale, '/account')}?plan=${plan}`;
        return;
      }
      if (!response.ok || !data.url) throw new Error(data.error || 'checkout_failed');
      location.href = data.url;
    } catch {
      setError(locale === 'de' ? 'Gerade nicht verfügbar.' : 'Not available right now.');
      setBusy(false);
    }
  }
  return <><button onClick={checkout} disabled={busy}>{busy ? (locale === 'de' ? 'Weiter…' : 'Opening…') : children}</button>{error ? <small className="billing-error">{error}</small> : null}</>;
}
