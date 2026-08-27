'use client';

import { FormEvent, useState } from 'react';
import { localePath, type Locale } from '@/lib/i18n';
import { SiteFooter } from './SiteFooter';
import { SiteNav } from './SiteNav';

export function ForgotPasswordPage({ locale }: { locale: Locale }) {
  const de = locale === 'de';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    const values = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/password/forgot', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: values.get('identifier'), locale }),
    });
    const result = await response.json() as { error?: string; message?: string };
    if (!response.ok) setError(result.error || (de ? 'Das hat gerade nicht geklappt.' : 'That did not work right now.'));
    else setMessage(result.message || '');
    setBusy(false);
  }

  return <main className="account-page" lang={locale}>
    <SiteNav locale={locale} />
    <section className="account-shell auth-shell recovery-shell">
      <div className="account-heading"><p className="eyebrow">{de ? 'PASSWORT VERGESSEN' : 'FORGOT PASSWORD'}</p><h1>{de ? 'Wir schicken dir einen sicheren Link.' : 'We’ll send you a secure link.'}</h1><p>{de ? 'Gib deinen Nutzernamen oder die E-Mail-Adresse ein, die du für die Wiederherstellung hinterlegt hast.' : 'Enter your username or the recovery email saved on your account.'}</p></div>
      <div className="auth-card">
        {message ? <div className="recovery-success" role="status"><strong>{de ? 'Schau in dein Postfach.' : 'Check your inbox.'}</strong><p>{message}</p></div> : <form className="credential-form" onSubmit={submit}>
          <label>{de ? 'Nutzername oder E-Mail' : 'Username or recovery email'}<input name="identifier" autoComplete="username" required autoFocus /></label>
          <button className="primary-action" disabled={busy}>{busy ? (de ? 'Wird gesendet…' : 'Sending…') : (de ? 'Link senden' : 'Send reset link')}</button>
        </form>}
        <a className="auth-back-link" href={`${localePath(locale, '/account')}?mode=login`}>{de ? 'Zurück zur Anmeldung' : 'Back to sign in'}</a>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </div>
    </section>
    <SiteFooter locale={locale} />
  </main>;
}
