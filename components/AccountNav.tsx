'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { localePath, type Locale } from '@/lib/i18n';

type Identity = { username: string | null; email: string | null; name: string | null };

export function AccountNav({ locale }: { locale: Locale }) {
  const [user, setUser] = useState<Identity | null | undefined>(undefined);
  useEffect(() => {
    fetch('/api/auth/me').then(async (response) => await response.json() as { user?: Identity | null }).then((data) => setUser(data.user || null)).catch(() => setUser(null));
  }, []);
  const label = user ? (user.name || user.username || user.email) : (locale === 'de' ? 'Anmelden' : 'Sign in');
  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = localePath(locale);
  }
  if (!user) return <Link className="account-nav" href={localePath(locale, '/account')}>{label}</Link>;
  return <details className="account-menu">
    <summary className="account-nav"><span aria-hidden="true">●</span>{label || (locale === 'de' ? 'Konto' : 'Account')}<b aria-hidden="true">⌄</b></summary>
    <div><Link href={localePath(locale, '/account')}>{locale === 'de' ? 'Konto öffnen' : 'Open account'}</Link><button type="button" onClick={signOut}>{locale === 'de' ? 'Abmelden' : 'Sign out'}</button></div>
  </details>;
}
