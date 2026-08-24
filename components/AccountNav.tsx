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
  return <Link className="account-nav" href={localePath(locale, '/account')}>{user ? <span aria-hidden="true">●</span> : null}{label || (locale === 'de' ? 'Konto' : 'Account')}</Link>;
}
