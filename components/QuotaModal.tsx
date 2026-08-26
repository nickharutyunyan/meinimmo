'use client';

import { FormEvent, useEffect, useState } from 'react';
import { localePath, type Locale } from '@/lib/i18n';
import { canOfferDayPass, type DayPassAccess } from '@/lib/day-pass';

type User = { username: string | null; email: string | null; name: string | null };

export function QuotaModal({ open, locale, onClose }: { open: boolean; locale: Locale; onClose: () => void }) {
  const de = locale === 'de';
  const [user, setUser] = useState<User | null>(null);
  const [google, setGoogle] = useState(false);
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    if (!open) {
      setEligible(false);
      return;
    }
    setEligible(false);
    fetch('/api/auth/me', { cache: 'no-store' }).then(async (response) => await response.json() as { user?: User | null; googleAvailable?: boolean; access?: DayPassAccess }).then((data) => {
      if (!canOfferDayPass(data.access)) {
        onClose();
        return;
      }
      setEligible(true);
      setUser(data.user || null);
      setGoogle(Boolean(data.googleAvailable));
    }).catch(onClose);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, onClose]);

  async function buyPass() {
    setBusy(true);
    setError('');
    const response = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan: 'day_pass', locale }) });
    const data = await response.json() as { url?: string; error?: string };
    if (response.ok && data.url) { location.href = data.url; return; }
    setError(data.error || (de ? 'Die Zahlung ist gerade nicht verfügbar.' : 'Payment is not available right now.'));
    setBusy(false);
  }

  async function credentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const values = new FormData(event.currentTarget);
    const response = await fetch(`/api/auth/${mode}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: values.get('username'), password: values.get('password'), name: values.get('name'), locale }),
    });
    const data = await response.json() as { user?: User; error?: string };
    if (!response.ok || !data.user) {
      setError(data.error || (de ? 'Das hat nicht geklappt.' : 'That did not work.'));
      setBusy(false);
      return;
    }
    setUser(data.user);
    await buyPass();
  }

  if (!open || !eligible) return null;
  const returnTo = `${localePath(locale)}?daypass=1`;
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="quota-modal" role="dialog" aria-modal="true" aria-labelledby="quota-title">
      <button className="modal-close" onClick={onClose} aria-label={de ? 'Schließen' : 'Close'}>×</button>
      <p className="eyebrow">{de ? 'HEUTE WEITERMACHEN' : 'KEEP SEARCHING TODAY'}</p>
      <h2 id="quota-title">{de ? '50 Berichte. Ein Tag. 5 €.' : '50 reports. One day. €5.'}</h2>
      <p className="quota-lead">{de ? 'Einmal zahlen, 24 Stunden nutzen. Kein Abo, keine automatische Verlängerung.' : 'One payment, 24 hours of access. No subscription and no automatic renewal.'}</p>
      {user ? <div className="day-pass-checkout">
        <div><span>{de ? 'TAGESPASS' : 'ONE-DAY PASS'}</span><strong>€5</strong></div>
        <ul><li>{de ? '50 neue Immobilien-Berichte' : '50 new property reports'}</li><li>{de ? 'Gültig für 24 Stunden' : 'Valid for 24 hours'}</li><li>{de ? 'Endet automatisch' : 'Ends automatically'}</li></ul>
        <button className="primary-action" disabled={busy} onClick={buyPass}>{busy ? (de ? 'Weiter…' : 'Opening…') : (de ? 'Tagespass für 5 € kaufen' : 'Buy the €5 day pass')}</button>
      </div> : <>
        <p className="account-reason">{de ? 'Für den Pass brauchst du ein Konto, damit deine 50 Berichte sicher bei dir bleiben.' : 'Create an account so your 50 reports stay safely attached to you.'}</p>
        {google ? <a className="google-auth" href={`/api/auth/google/start?locale=${locale}&returnTo=${encodeURIComponent(returnTo)}`}><span>G</span>{de ? 'Mit Google weitermachen' : 'Continue with Google'}</a> : null}
        {google ? <div className="auth-divider"><span>{de ? 'oder' : 'or'}</span></div> : null}
        <form className="credential-form" onSubmit={credentials}>
          {mode === 'signup' ? <label>{de ? 'Name (optional)' : 'Name (optional)'}<input name="name" autoComplete="name" /></label> : null}
          <label>{de ? 'Nutzername' : 'Username'}<input name="username" autoComplete="username" minLength={3} required /></label>
          <label>{de ? 'Passwort' : 'Password'}<input name="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={10} required /><small>{mode === 'signup' ? (de ? 'Mindestens 10 Zeichen, mit Buchstabe und Zahl.' : 'At least 10 characters, with a letter and a number.') : ''}</small></label>
          <button className="primary-action" disabled={busy}>{busy ? (de ? 'Einen Moment…' : 'One moment…') : mode === 'signup' ? (de ? 'Konto erstellen & weiter' : 'Create account & continue') : (de ? 'Anmelden & weiter' : 'Sign in & continue')}</button>
        </form>
        <button className="auth-mode" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }}>{mode === 'signup' ? (de ? 'Schon ein Konto? Anmelden' : 'Already have an account? Sign in') : (de ? 'Noch kein Konto? Erstellen' : 'New here? Create an account')}</button>
      </>}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <p className="privacy-note">{de ? 'Kontodaten und Immobilien-Berichte liegen getrennt voneinander.' : 'Account data and property reports are stored separately.'}</p>
    </section>
  </div>;
}
