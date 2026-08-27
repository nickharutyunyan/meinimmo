'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { canonicalSource, reportTitle } from '@/lib/display';
import type { Report } from '@/lib/types';
import { copy, localePath, type Locale } from '@/lib/i18n';
import { Brand } from './Brand';
import { canOfferDayPass } from '@/lib/day-pass';

export function Sidebar({ locale }: { locale: Locale }) {
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
    load();
    window.addEventListener('habitat-history-changed', load);
    window.addEventListener('focus', load);
    return () => {
      window.removeEventListener('habitat-history-changed', load);
      window.removeEventListener('focus', load);
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
    const response = await fetch('/api/comparisons', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reportIds: selected }) });
    const result = await response.json() as { id?: string };
    if (response.ok && result.id) location.href = localePath(locale, `/c/${result.id}`);
  };

  return <aside className={collapsed ? 'sidebar collapsed' : 'sidebar'}>
    <header><Brand className="side-logo" locale={locale}/><button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? text.expand : text.collapse} title={collapsed ? text.expand : text.collapse}><span>‹</span></button></header>
    <div className={limitsEnabled ? 'actions' : 'actions single'}><Link href={localePath(locale)} className="new">＋ <span>{text.newAssessment}</span></Link>{limitsEnabled ? <Link href={dayPassEligible ? `${localePath(locale)}?daypass=1` : localePath(locale, '/account')} className={dayPassEligible ? 'upgrade ready' : 'upgrade'}>✦ <span>{dayPassEligible ? text.dayPass : text.upgrade}</span></Link> : null}</div>
    {limitsEnabled ? <div className="quota" aria-live="polite">
      <span>{accessLabel}</span>
      <strong>{access ? access.used : '—'}<small> / {access ? access.limit : '—'}</small></strong>
      <p>{access ? `${access.remaining} ${text.remaining} · ${planLabel}` : text.loadingUsage}</p>
    </div> : null}<p className="side-label">{text.yours}</p>
    <div className="history">{ordered.length ? ordered.map(item => <div className={`history-row${pinned.includes(item.id) ? ' pinned' : ''}${selected.includes(item.id) ? ' selected' : ''}`} key={item.id}>
      <input aria-label={`${text.select} ${reportTitle(item, locale)}`} type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)}/>
      <Link href={localePath(locale, `/r/${item.id}`)} onClick={() => toggleSelect(item.id)}>{reportTitle(item, locale)}<small>{new Date(item.createdAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB')}</small></Link>
      <div className="history-controls">
        <button className="pin" title={pinned.includes(item.id) ? text.unpin : text.pin} aria-label={pinned.includes(item.id) ? text.unpin : text.pin} aria-pressed={pinned.includes(item.id)} onClick={() => togglePin(item.id)}>{pinned.includes(item.id) ? '★' : '☆'}</button>
        <button className="remove" title={text.remove} aria-label={`${text.removeAssessment}: ${reportTitle(item, locale)}`} onClick={() => removeFromHistory(item.id)}>×</button>
      </div>
    </div>) : <p className="empty">{text.empty}</p>}</div>
    <button className="compare" onClick={compare} disabled={selected.length !== 2}>{text.compare} <b>{selected.length}/2</b></button>
  </aside>;
}
