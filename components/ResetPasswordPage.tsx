'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { localePath, type Locale } from '@/lib/i18n';
import { SiteFooter } from './SiteFooter';
import { SiteNav } from './SiteNav';

export function ResetPasswordPage({ locale }: { locale: Locale }) {
  const de = locale === 'de';
  const capturedToken = useRef('');
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const value = capturedToken.current || new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
    capturedToken.current = /^[A-Za-z0-9_-]{40,100}$/.test(value) ? value : '';
    setToken(capturedToken.current);
    window.history.replaceState({}, '', window.location.pathname);
    setReady(true);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const values = new FormData(event.currentTarget);
    const password = String(values.get('password') || '');
    const confirmation = String(values.get('confirmation') || '');
    if (password !== confirmation) { setError(de ? 'Die Passwörter stimmen nicht überein.' : 'The passwords do not match.'); setBusy(false); return; }
    const response = await fetch('/api/auth/password/reset', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, password, locale }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setError(result.error || (de ? 'Das Passwort konnte nicht geändert werden.' : 'The password could not be changed.')); setBusy(false); return; }
    window.location.href = `${localePath(locale, '/account')}?passwordReset=1`;
  }

  const invalid = ready && !token;
  return <main className="account-page" lang={locale}>
    <SiteNav locale={locale} />
    <section className="account-shell auth-shell recovery-shell">
      <div className="account-heading"><p className="eyebrow">{de ? 'NEUES PASSWORT' : 'NEW PASSWORD'}</p><h1>{de ? 'Wähle ein neues Passwort.' : 'Choose a new password.'}</h1><p>{de ? 'Danach bist du direkt wieder angemeldet. Alle alten Sitzungen werden sicher beendet.' : 'You’ll be signed in again immediately. All older sessions will be securely closed.'}</p></div>
      <div className="auth-card">
        {!ready ? <p>{de ? 'Link wird geprüft…' : 'Checking link…'}</p> : invalid ? <div className="recovery-success"><strong>{de ? 'Dieser Link funktioniert nicht mehr.' : 'This link no longer works.'}</strong><p>{de ? 'Er ist möglicherweise abgelaufen oder wurde schon benutzt.' : 'It may have expired or already been used.'}</p><a className="primary-action recovery-action" href={localePath(locale, '/account/forgot')}>{de ? 'Neuen Link anfordern' : 'Request a new link'}</a></div> : <form className="credential-form" onSubmit={submit}>
          <label>{de ? 'Neues Passwort' : 'New password'}<input name="password" type="password" autoComplete="new-password" minLength={10} required autoFocus /><small>{de ? 'Mindestens 10 Zeichen, mit Buchstabe und Zahl.' : 'At least 10 characters, with a letter and a number.'}</small></label>
          <label>{de ? 'Passwort wiederholen' : 'Confirm password'}<input name="confirmation" type="password" autoComplete="new-password" minLength={10} required /></label>
          <button className="primary-action" disabled={busy}>{busy ? (de ? 'Wird gespeichert…' : 'Saving…') : (de ? 'Passwort speichern' : 'Save new password')}</button>
        </form>}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </div>
    </section>
    <SiteFooter locale={locale} />
  </main>;
}
