'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { localePath, type Locale } from '@/lib/i18n';
import { requestJson } from '@/lib/client-request';
import { NavChevron } from './NavChevron';

type Identity = { username: string | null; email: string | null; name: string | null };

export function AccountNav({ locale }: { locale: Locale }) {
  const [user, setUser] = useState<Identity | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const load = () => requestJson<{ user?: Identity | null }>('/api/auth/me', { cache: 'no-store' }).then(({ response, data }) => { if (response.ok) setUser(data.user || null); }).catch(() => undefined);
    load();
    window.addEventListener('account-changed', load);
    return () => window.removeEventListener('account-changed', load);
  }, []);
  const label = user ? (user.name || user.username || user.email) : (locale === 'de' ? 'Anmelden' : 'Sign in');
  async function signOut() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { response } = await requestJson('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('logout_failed');
      window.location.href = localePath(locale);
    } catch { setError(locale === 'de' ? 'Abmelden fehlgeschlagen. Bitte erneut versuchen.' : 'Sign out failed. Please try again.'); }
    finally { setBusy(false); }
  }
  if (!user) return <Link className="account-nav" href={localePath(locale, '/account')}>{label}</Link>;
  return <details className="account-menu">
    <summary className="account-nav"><span className="account-status" aria-hidden="true"/><span className="account-label">{label || (locale === 'de' ? 'Konto' : 'Account')}</span><NavChevron /></summary>
    <div><Link href={localePath(locale, '/account')}>{locale === 'de' ? 'Konto öffnen' : 'Open account'}</Link><button type="button" onClick={signOut} disabled={busy}>{locale === 'de' ? 'Abmelden' : 'Sign out'}</button>{error ? <p role="alert">{error}</p> : null}</div>
  </details>;
}
