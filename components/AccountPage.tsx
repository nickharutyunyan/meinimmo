'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { SiteNav } from './SiteNav';
import { PlanButton } from './PlanButton';
import { QuotaModal } from './QuotaModal';
import { localePath, type Locale } from '@/lib/i18n';
import { SiteFooter } from './SiteFooter';
import { canOfferDayPass } from '@/lib/day-pass';

type AccountState = {
  user: { username: string | null; email: string | null; name: string | null } | null;
  access: { kind: 'free' | 'day_pass' | 'pro' | 'ultra'; limit: number; used: number; remaining: number; resetAt: string };
  googleAvailable: boolean;
  billingAvailable: boolean;
};

export function AccountPage({ locale }: { locale: Locale }) {
  const de = locale === 'de';
  const [data, setData] = useState<AccountState | null>(null);
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dayPassOpen, setDayPassOpen] = useState(false);
  const [returnTo, setReturnTo] = useState('');
  const resumedCheckout = useRef(false);
  const refresh = () => fetch('/api/auth/me', { cache: 'no-store' }).then(async (response) => await response.json() as AccountState).then(setData);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedReturn = params.get('returnTo');
    setReturnTo(requestedReturn && requestedReturn.startsWith('/') && !requestedReturn.startsWith('//') && !/[\r\n]/.test(requestedReturn) ? requestedReturn : '');
    if (params.get('mode') === 'login') setMode('login');
    const load = () => refresh().catch(() => setError(de ? 'Konto konnte nicht geladen werden.' : 'The account could not be loaded.'));
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!data?.user || resumedCheckout.current) return;
    const plan = new URLSearchParams(window.location.search).get('plan');
    if (plan !== 'pro' && plan !== 'ultra') return;
    resumedCheckout.current = true;
    setBusy(true);
    fetch('/api/billing/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan, locale }) })
      .then(async response => ({ response, result: await response.json() as { url?: string; error?: string } }))
      .then(({ response, result }) => {
        if (response.ok && result.url) { window.location.href = result.url; return; }
        throw new Error(result.error || 'checkout_failed');
      })
      .catch(() => { setError(de ? 'Das Abo konnte gerade nicht geöffnet werden.' : 'The subscription checkout could not be opened.'); setBusy(false); });
  }, [data?.user, de, locale]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const values = new FormData(event.currentTarget);
    const response = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: values.get('username'), password: values.get('password'), name: values.get('name'), locale }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setError(result.error || (de ? 'Das hat nicht geklappt.' : 'That did not work.')); setBusy(false); return; }
    if (returnTo) { window.location.href = returnTo; return; }
    await refresh(); setBusy(false);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    await refresh();
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const values = new FormData(event.currentTarget);
    const response = await fetch('/api/account', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: values.get('name') }) });
    if (response.ok) await refresh();
    setBusy(false);
  }

  async function portal() {
    setBusy(true);
    const response = await fetch('/api/billing/portal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ locale }) });
    const result = await response.json() as { url?: string; error?: string };
    if (result.url) { location.href = result.url; return; }
    setError(result.error || (de ? 'Zahlungsportal gerade nicht verfügbar.' : 'Billing portal is not available right now.')); setBusy(false);
  }

  return <main className="account-page" lang={locale}>
    <SiteNav locale={locale} />
    {!data ? <section className="account-shell"><p>{de ? 'Konto wird geladen…' : 'Loading account…'}</p></section> : data.user ? <section className="account-shell">
      <div className="account-heading"><p className="eyebrow">{de ? 'DEIN KONTO' : 'YOUR ACCOUNT'}</p><h1>{de ? 'Schön, dass du da bist.' : 'Good to have you here.'}</h1><p>{data.user.email || `@${data.user.username}`}</p></div>
      <div className="account-grid">
        <section className="account-card usage-card">
          <span>{data.access.kind === 'day_pass' ? (de ? 'TAGESPASS' : 'DAY PASS') : data.access.kind.toUpperCase()}</span>
          <strong>{data.access.used}<small> / {data.access.limit}</small></strong>
          <p>{data.access.kind === 'day_pass' ? (de ? 'Berichte mit diesem Pass erstellt' : 'reports created with this pass') : (de ? 'Berichte heute erstellt' : 'reports created today')}</p>
          <small className="usage-note">{data.access.remaining} {de ? 'übrig' : 'remaining'}</small>
          <div aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, data.access.used / data.access.limit * 100))}%` }} /></div>
        </section>
        <section className="account-card"><h2>{de ? 'Profil' : 'Profile'}</h2><form onSubmit={saveName}><label>{de ? 'Name (optional)' : 'Name (optional)'}<input name="name" defaultValue={data.user.name || ''}/></label><button disabled={busy}>{de ? 'Speichern' : 'Save'}</button></form><button className="text-button" onClick={logout}>{de ? 'Abmelden' : 'Sign out'}</button></section>
      </div>
      {canOfferDayPass(data.access) ? <section className="day-pass-offer">
        <div><p className="eyebrow">{de ? 'EINMALIG · KEIN ABO' : 'ONE-OFF · NO SUBSCRIPTION'}</p><h2>{de ? '50 weitere Berichte für heute.' : '50 more reports for today.'}</h2><p>{de ? 'Einmal 5 € zahlen, 24 Stunden nutzen. Der Pass endet automatisch.' : 'Pay €5 once and use them for 24 hours. The pass ends automatically.'}</p></div>
        <button onClick={() => setDayPassOpen(true)}>{de ? 'Tagespass für 5 € kaufen' : 'Buy the €5 day pass'}</button>
      </section> : null}
      <section className="account-plans"><div><p className="eyebrow">{de ? 'MEHR BERICHTE' : 'MORE REPORTS'}</p><h2>{de ? 'Für die aktive Suche.' : 'For an active search.'}</h2><p>{de ? 'Monatlich kündbar. Dein Tageslimit wird jeden Morgen zurückgesetzt.' : 'Cancel monthly. Your daily allowance resets each morning.'}</p></div>
        <article><span>PRO</span><strong>€10<small>{de ? '/Monat' : '/month'}</small></strong><p>{de ? '10 Berichte pro Tag' : '10 reports per day'}</p>{data.access.kind === 'pro' || data.access.kind === 'ultra' ? <button onClick={portal}>{de ? 'Abo verwalten' : 'Manage subscription'}</button> : <PlanButton plan="pro" locale={locale}>{de ? 'Pro wählen' : 'Choose Pro'}</PlanButton>}</article>
        <article className="ultra"><span>ULTRA</span><strong>€20<small>{de ? '/Monat' : '/month'}</small></strong><p>{de ? '100 Berichte pro Tag' : '100 reports per day'}</p>{data.access.kind === 'pro' || data.access.kind === 'ultra' ? <button onClick={portal}>{de ? 'Abo verwalten' : 'Manage subscription'}</button> : <PlanButton plan="ultra" locale={locale}>{de ? 'Ultra wählen' : 'Choose Ultra'}</PlanButton>}</article>
      </section>
      <p className="separation-note">{de ? 'Deine persönlichen Kontodaten werden in einer eigenen Datenbank gespeichert – getrennt von Immobilien-Berichten.' : 'Your personal account data is stored in its own database, separate from property reports.'}</p>
      {error ? <p className="form-error">{error}</p> : null}
    </section> : <section className="account-shell auth-shell">
      <div className="account-heading"><p className="eyebrow">{de ? 'KONTO' : 'ACCOUNT'}</p><h1>{mode === 'signup' ? (de ? 'In einer Minute startklar.' : 'Ready in a minute.') : (de ? 'Willkommen zurück.' : 'Welcome back.')}</h1><p>{de ? 'Speichere deinen Zugang und schalte bei Bedarf mehr Berichte frei.' : 'Keep your access in one place and unlock more reports when you need them.'}</p></div>
      <div className="auth-card">
        {data.googleAvailable ? <a className="google-auth" href={`/api/auth/google/start?locale=${locale}&returnTo=${encodeURIComponent(returnTo || localePath(locale, '/account'))}`}><span>G</span>{de ? 'Mit Google weitermachen' : 'Continue with Google'}</a> : null}
        {data.googleAvailable ? <div className="auth-divider"><span>{de ? 'oder' : 'or'}</span></div> : null}
        <form className="credential-form" onSubmit={submit}>
          {mode === 'signup' ? <label>{de ? 'Name (optional)' : 'Name (optional)'}<input name="name" autoComplete="name" /></label> : null}
          <label>{de ? 'Nutzername' : 'Username'}<input name="username" autoComplete="username" required /></label>
          <label>{de ? 'Passwort' : 'Password'}<input name="password" type="password" minLength={10} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required />{mode === 'signup' ? <small>{de ? 'Mindestens 10 Zeichen, mit Buchstabe und Zahl.' : 'At least 10 characters, with a letter and a number.'}</small> : null}</label>
          <button className="primary-action" disabled={busy}>{busy ? (de ? 'Einen Moment…' : 'One moment…') : mode === 'signup' ? (de ? 'Konto erstellen' : 'Create account') : (de ? 'Anmelden' : 'Sign in')}</button>
        </form>
        <button className="auth-mode" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }}>{mode === 'signup' ? (de ? 'Schon ein Konto? Anmelden' : 'Already have an account? Sign in') : (de ? 'Noch kein Konto? Erstellen' : 'New here? Create an account')}</button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      </div>
    </section>}
    <QuotaModal open={dayPassOpen} locale={locale} onClose={() => setDayPassOpen(false)} />
    <SiteFooter locale={locale} />
  </main>;
}
