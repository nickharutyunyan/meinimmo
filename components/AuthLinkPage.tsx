'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { SiteNav } from './SiteNav';
import { SiteFooter } from './SiteFooter';
import { requestJson } from '@/lib/client-request';
import { localePath, type Locale } from '@/lib/i18n';
import { continueAsButton, continueButton, continueHeading, linkExpiredMessage, signingInAs } from '@/lib/identity/copy';
import { takeLinkFragment, type HeldLinkFragment } from '@/lib/identity/fragment';

let heldFragment: HeldLinkFragment | null = null;

function currentLinkToken() {
  if (typeof window === 'undefined') return '';
  const taken = takeLinkFragment(window.location, heldFragment);
  heldFragment = taken.held;
  if (taken.url) window.history.replaceState({}, '', taken.url);
  return taken.token;
}

export function AuthLinkPage({ locale }: { locale: Locale }) {
  const de = locale === 'de';
  const tokenRef = useRef('');
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [nonceMatches, setNonceMatches] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    const value = currentLinkToken();
    tokenRef.current = value;
    setToken(value);
    if (!tokenRef.current) {
      setError(linkExpiredMessage(locale));
      setReady(true);
      return;
    }
    if (started.current) return;
    started.current = true;
    requestJson<{ ok: boolean; email?: string; nonceMatches?: boolean }>('/api/auth/email/inspect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: tokenRef.current }),
    }).then(({ response, data }) => {
      if (!response.ok || !data.ok || !data.email) setError(linkExpiredMessage(locale));
      else {
        setEmail(data.email);
        setNonceMatches(Boolean(data.nonceMatches));
      }
      setReady(true);
    }).catch(() => {
      setError(de ? 'Die Verbindung ist fehlgeschlagen. Bitte versuche es erneut.' : 'The connection failed. Please try again.');
      setReady(true);
    });
  }, [de, locale]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !token) return;
    setBusy(true);
    setError('');
    try {
      const { response, data } = await requestJson<{ ok?: boolean; error?: string; redirect?: string }>('/api/auth/email/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, locale }),
      });
      if (!response.ok || !data.ok || !data.redirect) {
        setError(data.error || linkExpiredMessage(locale));
        setBusy(false);
        return;
      }
      window.location.href = data.redirect;
    } catch {
      setError(de ? 'Die Verbindung ist fehlgeschlagen. Bitte versuche es erneut.' : 'The connection failed. Please try again.');
      setBusy(false);
    }
  }

  const label = email && !nonceMatches ? continueAsButton(email, locale) : continueButton(locale);

  return <main className="account-page" lang={locale}>
    <SiteNav locale={locale} />
    <section className="account-shell auth-shell">
      <div className="account-heading"><p className="eyebrow">{de ? 'KONTO' : 'ACCOUNT'}</p><h1>{continueHeading(locale)}</h1></div>
      {!ready ? <p>{de ? 'Link wird geprüft…' : 'Checking the link…'}</p> : email ? <form className="credential-form" method="post" action="/api/auth/email/verify" onSubmit={submit}>
        <p>{signingInAs(email, locale)}</p>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="locale" value={locale} />
        <button className="primary-action" disabled={busy}>{busy ? (de ? 'Einen Moment…' : 'One moment…') : label}</button>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </form> : <div>
        <p className="form-error" role="alert">{error}</p>
        <a href={localePath(locale, '/account')}>{de ? 'Neuen Link anfordern' : 'Request a new link'}</a>
      </div>}
    </section>
    <SiteFooter locale={locale} />
  </main>;
}
