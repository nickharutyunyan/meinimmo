'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { SiteNav } from './SiteNav';
import { PlanButton } from './PlanButton';
import { QuotaModal } from './QuotaModal';
import { localePath, type Locale } from '@/lib/i18n';
import { SiteFooter } from './SiteFooter';
import { requestJson } from '@/lib/client-request';
import { canOfferDayPass } from '@/lib/day-pass';

type AccountSubscription = { plan: 'pro' | 'ultra'; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean };

type AccountState = {
  user: { username: string | null; email: string | null; name: string | null; emailVerified: boolean } | null;
  access: { limitsEnabled: boolean; kind: 'free' | 'day_pass' | 'pro' | 'ultra'; limit: number; used: number; remaining: number; resetAt: string };
  subscription: AccountSubscription | null;
  googleAvailable: boolean;
  paidPlansEnabled: boolean;
  billingAvailable: boolean;
  dayPassBillingAvailable: boolean;
};

function subscriptionDetail(de: boolean, subscription: AccountSubscription) {
  const date = subscription.currentPeriodEnd
    ? new Intl.DateTimeFormat(de ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(subscription.currentPeriodEnd))
    : null;
  if (subscription.cancelAtPeriodEnd || subscription.status === 'canceled') {
    return date
      ? (de ? `Dein Abo endet am ${date}. Danach wird nichts mehr berechnet.` : `Your subscription ends on ${date}. You will not be charged again.`)
      : (de ? 'Dein Abo ist gekündigt und wird nicht noch einmal berechnet.' : 'Your subscription is cancelled and will not renew.');
  }
  if (subscription.status === 'past_due') {
    return de
      ? 'Die letzte Zahlung ist fehlgeschlagen. Im Stripe-Portal kannst du die Zahlung aktualisieren oder kündigen.'
      : 'The latest payment did not go through. You can update the payment or cancel in the Stripe portal.';
  }
  if (subscription.status === 'trialing') {
    return date ? (de ? `Testphase bis ${date}.` : `Trial until ${date}.`) : (de ? 'Testphase.' : 'Trial.');
  }
  if (subscription.status === 'active') {
    return date
      ? (de ? `Nächste Verlängerung am ${date}.` : `Next renewal on ${date}.`)
      : (de ? 'Das Abo verlängert sich monatlich.' : 'Renews monthly.');
  }
  return de
    ? `Status: ${subscription.status}. Im Stripe-Portal kannst du das Abo verwalten oder kündigen.`
    : `Status: ${subscription.status}. You can manage or cancel it in the Stripe portal.`;
}

export function AccountPage({ locale }: { locale: Locale }) {
  const de = locale === 'de';
  const [data, setData] = useState<AccountState | null>(null);
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dayPassOpen, setDayPassOpen] = useState(false);
  const [returnTo, setReturnTo] = useState('');
  const [passwordReset, setPasswordReset] = useState(false);
  const resumedCheckout = useRef(false);
  const subscriptionIsCurrent = Boolean(data?.subscription && !['canceled', 'incomplete_expired'].includes(data.subscription.status));
  const inFlight = useRef(false);
  const networkError = de ? 'Verbindung fehlgeschlagen. Bitte versuche es erneut.' : 'Connection failed. Please try again.';
  const recoveryEmailHint = de
    ? 'Hierhin schicken wir einen Link, falls du dein Passwort vergisst.'
    : 'We’ll send a secure link here if you forget your password.';
  const recoveryEmailLocked = de
    ? 'Diese E-Mail-Adresse ist noch nicht bestätigt, deshalb kannst du sie noch nicht ändern.'
    : 'This email isn’t confirmed yet, so you can’t change it.';
  const refresh = async () => {
    const { response, data: result } = await requestJson<AccountState>('/api/auth/me', { cache: 'no-store' });
    if (!response.ok) throw new Error('account_unavailable');
    setData(result);
    window.dispatchEvent(new Event('account-changed'));
  };
  const load = () => { setError(''); return refresh().catch(() => setError(de ? 'Konto konnte nicht geladen werden. Bitte versuche es erneut.' : 'The account could not be loaded. Please try again.')); };
  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { await action(); } catch { setError(networkError); }
    finally { inFlight.current = false; setBusy(false); }
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedReturn = params.get('returnTo');
    setReturnTo(requestedReturn && requestedReturn.startsWith('/') && !requestedReturn.startsWith('//') && !/[\r\n]/.test(requestedReturn) ? requestedReturn : '');
    if (params.get('mode') === 'login') setMode('login');
    setPasswordReset(params.get('passwordReset') === '1');
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!data?.user || !data.billingAvailable || resumedCheckout.current) return;
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
  }, [data?.user, data?.billingAvailable, de, locale]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    await run(async () => {
      const { response, data: result } = await requestJson<{ error?: string }>(`/api/auth/${mode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: values.get('username'), identifier: values.get('identifier'), email: values.get('email'), password: values.get('password'), name: values.get('name'), locale }) });
      if (!response.ok) { setError(result.error || networkError); return; }
      if (returnTo) { window.location.href = returnTo; return; }
      await refresh();
    });
  }

  async function logout() {
    await run(async () => {
      const { response } = await requestJson('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('logout_failed');
      await refresh();
    });
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    await run(async () => {
      const { response, data: result } = await requestJson<{ error?: string }>('/api/account', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: values.get('name'), email: values.get('email'), locale }) });
      if (!response.ok) { setError(result.error || networkError); return; }
      await refresh();
    });
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
    {!data ? <section className="account-shell">{error ? <><p className="form-error" role="alert">{error}</p><button onClick={load}>{de ? 'Erneut versuchen' : 'Try again'}</button></> : <p>{de ? 'Konto wird geladen…' : 'Loading account…'}</p>}</section> : data.user ? <section className="account-shell">
      <div className="account-heading"><p className="eyebrow">{de ? 'DEIN KONTO' : 'YOUR ACCOUNT'}</p><h1>{de ? 'Schön, dass du da bist.' : 'Good to have you here.'}</h1><p>{data.user.email || `@${data.user.username}`}</p>{passwordReset ? <div className="account-success" role="status">{de ? 'Dein Passwort wurde geändert und du bist wieder angemeldet.' : 'Your password has been changed and you are signed in again.'}</div> : null}</div>
      <div className="account-grid">
        {data.access.limitsEnabled ? <section className="account-card usage-card">
          <span>{data.access.kind === 'day_pass' ? (de ? 'TAGESPASS' : 'DAY PASS') : data.access.kind.toUpperCase()}</span>
          <strong>{data.access.used}<small> / {data.access.limit}</small></strong>
          <p>{data.access.kind === 'day_pass' ? (de ? 'Berichte mit diesem Pass erstellt' : 'reports created with this pass') : (de ? 'Berichte heute erstellt' : 'reports created today')}</p>
          <small className="usage-note">{data.access.remaining} {de ? 'übrig' : 'remaining'}</small>
          <div aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, data.access.used / data.access.limit * 100))}%` }} /></div>
        </section> : <section className="account-card usage-card"><span>{data.subscription ? data.subscription.plan.toUpperCase() : (de ? 'KOSTENLOS' : 'FREE')}</span><strong>∞</strong><p>{de ? 'Berichte sind momentan unbegrenzt.' : 'Reports are currently unlimited.'}</p><small className="usage-note">{data.subscription ? (de ? 'Das ist dein aktuelles Abo. Verwalten oder kündigen kannst du es unten.' : 'This is your current plan. Manage or cancel it below.') : (de ? 'Tageslimits sind pausiert.' : 'Daily limits are paused.')}</small></section>}
        <section className="account-card"><h2>{de ? 'Profil' : 'Profile'}</h2><form onSubmit={saveName}><label>{de ? 'Name (optional)' : 'Name (optional)'}<input name="name" defaultValue={data.user.name || ''}/></label>{data.user.username ? <label>{de ? 'E-Mail zur Wiederherstellung' : 'Recovery email'}<input name="email" type="email" autoComplete="email" defaultValue={data.user.email || ''} required={data.user.emailVerified} disabled={!data.user.emailVerified} /><small>{data.user.emailVerified ? recoveryEmailHint : recoveryEmailLocked}</small></label> : null}<button disabled={busy}>{de ? 'Speichern' : 'Save'}</button></form><button className="text-button" onClick={logout} disabled={busy}>{de ? 'Abmelden' : 'Sign out'}</button></section>
      </div>
      {data.subscription ? <section className="subscription-card">
        <div>
          <p className="eyebrow">{de ? 'DEIN ABO' : 'YOUR SUBSCRIPTION'}</p>
          <h2>{data.subscription.plan === 'ultra' ? 'Ultra' : 'Pro'}</h2>
          <p>{subscriptionDetail(de, data.subscription)}</p>
        </div>
        <button onClick={portal} disabled={busy}>{de ? 'Abo bei Stripe verwalten oder kündigen' : 'Manage or cancel in Stripe'}</button>
      </section> : null}
      {data.dayPassBillingAvailable && canOfferDayPass(data.access) ? <section className="day-pass-offer">
        <div><p className="eyebrow">{de ? 'EINMALIG · KEIN ABO' : 'ONE-OFF · NO SUBSCRIPTION'}</p><h2>{de ? '50 weitere Berichte für heute.' : '50 more reports for today.'}</h2><p>{de ? 'Einmal 5 € zahlen, 24 Stunden nutzen. Der Pass endet automatisch.' : 'Pay €5 once and use them for 24 hours. The pass ends automatically.'}</p></div>
        <button onClick={() => setDayPassOpen(true)}>{de ? 'Tagespass für 5 € kaufen' : 'Buy the €5 day pass'}</button>
      </section> : null}
      {data.billingAvailable && !subscriptionIsCurrent ? <section className="account-plans"><div><p className="eyebrow">{de ? 'MEHR BERICHTE' : 'MORE REPORTS'}</p><h2>{de ? 'Für die aktive Suche.' : 'For an active search.'}</h2><p>{de ? 'Monatlich kündbar. Dein Tageslimit wird jeden Morgen zurückgesetzt.' : 'Cancel monthly. Your daily allowance resets each morning.'}</p></div>
        <article><span>PRO</span><strong>€10<small>{de ? '/Monat' : '/month'}</small></strong><p>{de ? '10 Berichte pro Tag' : '10 reports per day'}</p>{data.access.kind === 'pro' || data.access.kind === 'ultra' ? <button onClick={portal}>{de ? 'Abo verwalten' : 'Manage subscription'}</button> : <PlanButton plan="pro" locale={locale}>{de ? 'Pro wählen' : 'Choose Pro'}</PlanButton>}</article>
        <article className="ultra"><span>ULTRA</span><strong>€20<small>{de ? '/Monat' : '/month'}</small></strong><p>{de ? '100 Berichte pro Tag' : '100 reports per day'}</p>{data.access.kind === 'pro' || data.access.kind === 'ultra' ? <button onClick={portal}>{de ? 'Abo verwalten' : 'Manage subscription'}</button> : <PlanButton plan="ultra" locale={locale}>{de ? 'Ultra wählen' : 'Choose Ultra'}</PlanButton>}</article>
      </section> : null}
      <p className="separation-note">{de ? 'Deine persönlichen Kontodaten werden in einer eigenen Datenbank gespeichert – getrennt von Immobilien-Berichten.' : 'Your personal account data is stored in its own database, separate from property reports.'}</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section> : <section className="account-shell auth-shell">
      <div className="account-heading"><p className="eyebrow">{de ? 'KONTO' : 'ACCOUNT'}</p><h1>{mode === 'signup' ? (de ? 'In einer Minute startklar.' : 'Ready in a minute.') : (de ? 'Willkommen zurück.' : 'Welcome back.')}</h1><p>{data.paidPlansEnabled ? (de ? 'Speichere deinen Zugang und schalte bei Bedarf mehr Berichte frei.' : 'Keep your access in one place and unlock more reports when you need them.') : (de ? 'Melde dich an, um Berichte deinem Konto zuzuordnen. Einen Bericht erstellen kannst du auch ohne Anmeldung.' : 'Sign in to keep reports with your account. You can create a report with no sign-up.')}</p></div>
      <div className="auth-card">
        {data.googleAvailable ? <a className="google-auth" href={`/api/auth/google/start?locale=${locale}&returnTo=${encodeURIComponent(returnTo || localePath(locale, '/account'))}`}><span>G</span>{de ? 'Mit Google weitermachen' : 'Continue with Google'}</a> : null}
        {data.googleAvailable ? <div className="auth-divider"><span>{de ? 'oder' : 'or'}</span></div> : null}
        <form className="credential-form" onSubmit={submit}>
          {mode === 'signup' ? <label>{de ? 'Name (optional)' : 'Name (optional)'}<input name="name" autoComplete="name" /></label> : null}
          {mode === 'signup' ? <><label>{de ? 'Nutzername' : 'Username'}<input name="username" autoComplete="username" required /></label><label>{de ? 'E-Mail zur Wiederherstellung' : 'Recovery email'}<input name="email" type="email" autoComplete="email" required /><small>{data.paidPlansEnabled ? (de ? 'Nur für dein Konto, Zahlungen und die Passwort-Wiederherstellung.' : 'Used only for your account, payments and password recovery.') : (de ? 'Nur für dein Konto und die Passwort-Wiederherstellung.' : 'Used only for your account and password recovery.')}</small></label></> : <label>{de ? 'Nutzername oder E-Mail' : 'Username or email'}<input name="identifier" autoComplete="username" required /></label>}
          <label>{de ? 'Passwort' : 'Password'}<input name="password" type="password" minLength={10} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required />{mode === 'signup' ? <small>{de ? 'Mindestens 10 Zeichen, mit Buchstabe und Zahl.' : 'At least 10 characters, with a letter and a number.'}</small> : null}</label>
          <button className="primary-action" disabled={busy}>{busy ? (de ? 'Einen Moment…' : 'One moment…') : mode === 'signup' ? (de ? 'Konto erstellen' : 'Create account') : (de ? 'Anmelden' : 'Sign in')}</button>
        </form>
        {mode === 'login' ? <a className="forgot-password-link" href={localePath(locale, '/account/forgot')}>{de ? 'Passwort vergessen?' : 'Forgot password?'}</a> : null}
        <button className="auth-mode" disabled={busy} onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }}>{mode === 'signup' ? (de ? 'Schon ein Konto? Anmelden' : 'Already have an account? Sign in') : (de ? 'Noch kein Konto? Erstellen' : 'New here? Create an account')}</button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      </div>
    </section>}
    <QuotaModal open={dayPassOpen} locale={locale} onClose={() => setDayPassOpen(false)} />
    <SiteFooter locale={locale} />
  </main>;
}
