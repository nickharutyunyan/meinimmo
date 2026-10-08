'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useRef } from 'react';
import { canonicalSource, reportTitle } from '@/lib/display';
import type { Report } from '@/lib/types';
import { copy, localePath, type Locale } from '@/lib/i18n';
import { Brand } from './Brand';
import { canOfferDayPass } from '@/lib/day-pass';

export function Sidebar({ locale, homeHref }: { locale: Locale; homeHref?: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [comparing, setComparing] = useState(false);
  const drawer = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawer.current?.querySelector<HTMLButtonElement>('.mobile-sidebar-close')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMobileOpen(false); return; }
      if (event.key !== 'Tab') return;
      const controls = [...(drawer.current?.querySelectorAll<HTMLElement>('a,button,input') || [])].filter(e => e.getClientRects().length && !(e as HTMLButtonElement).disabled);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const resize = () => { if (window.innerWidth > 800) setMobileOpen(false); };
    window.addEventListener('keydown', key); window.addEventListener('resize', resize);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', key); window.removeEventListener('resize', resize); opener.current?.focus(); };
  }, [mobileOpen]);
  const [comparisonError, setComparisonError] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [access, setAccess] = useState<{ limitsEnabled: boolean; kind: 'free' | 'day_pass' | 'pro' | 'ultra'; limit: number; used: number; remaining: number; resetAt: string } | null>(null);
  const text = copy[locale].sidebar;

  useEffect(() => {
    const load = async () => {
      const historyIds = JSON.parse(localStorage.getItem('habitat-history') || '[]') as string[];
      const pinIds = JSON.parse(localStorage.getItem('habitat-pins') || '[]') as string[];
      const reportQuery = historyIds.length ? `?ids=${encodeURIComponent(historyIds.slice(-30).join(','))}` : '';
      const [all, account] = await Promise.all([
        fetch(`/api/reports${reportQuery}`).then(response => response.json()) as Promise<Report[]>,
        fetch('/api/auth/me', { cache: 'no-store' }).then(response => response.json()) as Promise<{ access?: { limitsEnabled: boolean; kind: 'free' | 'day_pass' | 'pro' | 'ultra'; limit: number; used: number; remaining: number; resetAt: string } }>,
      ]);
      const visible = all.filter(item => historyIds.includes(item.id));
      const unique = new Map<string, Report>();
      [...visible].reverse().forEach((item) => unique.set(/^https?:/i.test(item.source) ? canonicalSource(item.source) : item.id, item));
      const deduplicated = [...unique.values()];
      const uniqueIds = deduplicated.map((item) => item.id);
      const selectedIds = JSON.parse(localStorage.getItem('habitat-compare-selection') || '[]') as string[];
      if (uniqueIds.length !== historyIds.length) localStorage.setItem('habitat-history', JSON.stringify(uniqueIds));
      setReports(deduplicated);
      setPinned(pinIds.filter((id) => uniqueIds.includes(id)));
      setSelected(selectedIds.filter((id) => uniqueIds.includes(id)).slice(0, 2));
      setAccess(account.access || null);
    };
    void load().catch(() => setComparisonError(locale === 'de' ? 'Berichte konnten nicht geladen werden. Lade die Seite erneut.' : 'Reports could not be loaded. Refresh to retry.'));
    const reload = () => { void load().catch(() => undefined); };
    window.addEventListener('habitat-history-changed', reload);
    window.addEventListener('focus', reload);
    return () => {
      window.removeEventListener('habitat-history-changed', reload);
      window.removeEventListener('focus', reload);
    };
  }, []);

  const ordered = useMemo(() => [...reports].sort((a, b) => {
    const pinDifference = Number(pinned.includes(b.id)) - Number(pinned.includes(a.id));
    return pinDifference || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }), [reports, pinned]);
  const dayPassEligible = canOfferDayPass(access);
  const limitsEnabled = access?.limitsEnabled === true;
  const accessLabel = access?.kind === 'day_pass'
    ? text.passUsage
    : text.todayUsage;
  const planLabel = access?.kind === 'day_pass'
    ? text.dayPassName
    : access?.kind === 'pro'
      ? 'Pro'
      : access?.kind === 'ultra'
        ? 'Ultra'
        : text.freePlan;

  const toggleSelect = (id: string) => setSelected(current => {
    const next = current.includes(id)
      ? current.filter(value => value !== id)
      : current.length === 2 ? current : [...current, id];
    localStorage.setItem('habitat-compare-selection', JSON.stringify(next));
    return next;
  });
  const togglePin = (id: string) => setPinned(current => {
    const next = current.includes(id) ? current.filter(value => value !== id) : [...current, id];
    localStorage.setItem('habitat-pins', JSON.stringify(next));
    return next;
  });
  const removeFromHistory = (id: string) => {
    const historyIds = JSON.parse(localStorage.getItem('habitat-history') || '[]') as string[];
    const nextHistory = historyIds.filter(value => value !== id);
    const nextPins = pinned.filter(value => value !== id);
    localStorage.setItem('habitat-history', JSON.stringify(nextHistory));
    localStorage.setItem('habitat-pins', JSON.stringify(nextPins));
    setReports(current => current.filter(item => item.id !== id));
    setPinned(nextPins);
    setSelected(current => {
      const next = current.filter(value => value !== id);
      localStorage.setItem('habitat-compare-selection', JSON.stringify(next));
      return next;
    });
    window.dispatchEvent(new Event('habitat-history-changed'));
  };
  const compare = async () => {
    if (comparing || selected.length !== 2) return;
    setComparing(true); setComparisonError('');
    try {
      const response = await fetch('/api/comparisons', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reportIds: selected }), signal: AbortSignal.timeout(20000) });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || 'Comparison failed.');
      location.href = localePath(locale, `/c/${result.id}`);
    } catch { setComparisonError(locale === 'de' ? 'Vergleich fehlgeschlagen. Versuche es erneut.' : 'Comparison failed. Please try again.'); }
    finally { setComparing(false); }
  };

  return <><nav className="mobile-report-nav" aria-label={locale === 'de' ? 'Berichte' : 'Reports'}><button ref={opener} aria-expanded={mobileOpen} aria-controls="report-shortlist" onClick={() => { setCollapsed(false); setMobileOpen(true); }}>{locale === 'de' ? '☰ Meine Berichte' : '☰ My reports'}</button><Link href={homeHref || localePath(locale)}>＋ {text.newAssessment}</Link></nav>
    {mobileOpen ? <button className="sidebar-backdrop" aria-label={locale === 'de' ? 'Berichte schließen' : 'Close reports'} onClick={() => setMobileOpen(false)} tabIndex={-1}/> : null}
    <aside ref={drawer} id="report-shortlist" role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen || undefined} aria-label={locale === 'de' ? 'Meine Berichte' : 'My reports'} className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>

    <header><button className="mobile-sidebar-close" onClick={() => setMobileOpen(false)} aria-label={locale === 'de' ? 'Berichte schließen' : 'Close reports'}>×</button><Brand className="side-logo" locale={locale} href={homeHref}/><button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? text.expand : text.collapse} title={collapsed ? text.expand : text.collapse}><span aria-hidden="true"><svg viewBox="0 0 20 20"><path className="arrow-head" d="M9 5 4 10l5 5"/><path className="arrow-tail" d="M5 10h11"/></svg></span></button></header>
    <div className={limitsEnabled ? 'actions' : 'actions single'}><Link href={homeHref || localePath(locale)} className="new">＋ <span>{text.newAssessment}</span></Link>{limitsEnabled ? <Link href={dayPassEligible ? `${localePath(locale)}?daypass=1` : localePath(locale, '/account')} className={dayPassEligible ? 'upgrade ready' : 'upgrade'}>✦ <span>{dayPassEligible ? text.dayPass : text.upgrade}</span></Link> : null}</div>
    {limitsEnabled ? <div className="quota" aria-live="polite">
      <span>{accessLabel}</span>
      <strong>{access ? access.used : '—'}<small> / {access ? access.limit : '—'}</small></strong>
      <p>{access ? `${access.remaining} ${text.remaining} · ${planLabel}` : text.loadingUsage}</p>
    </div> : null}<p className="side-label">{text.yours}</p>
    <div className="history">{ordered.length ? ordered.map(item => <div className={`history-row${pinned.includes(item.id) ? ' pinned' : ''}${selected.includes(item.id) ? ' selected' : ''}`} key={item.id}>
      <input aria-label={`${text.select} ${reportTitle(item, locale)}`} type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)}/>
      <Link href={localePath(locale, `/r/${item.id}`)} onClick={() => setMobileOpen(false)}>{reportTitle(item, locale)}<small>{new Date(item.createdAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB')}</small></Link>
      <div className="history-controls">
        <button className="pin" title={pinned.includes(item.id) ? text.unpin : text.pin} aria-label={pinned.includes(item.id) ? text.unpin : text.pin} aria-pressed={pinned.includes(item.id)} onClick={() => togglePin(item.id)}>{pinned.includes(item.id) ? '★' : '☆'}</button>
        <button className="remove" title={text.remove} aria-label={`${text.removeAssessment}: ${reportTitle(item, locale)}`} onClick={() => removeFromHistory(item.id)}>×</button>
      </div>
    </div>) : <p className="empty">{text.empty}</p>}</div>
    {comparisonError && <p className="error" role="alert">{comparisonError}</p>}<button className="compare" onClick={compare} disabled={selected.length !== 2 || comparing}>{text.compare} <b>{selected.length}/2</b></button>
  </aside></>;
}
