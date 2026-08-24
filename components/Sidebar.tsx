'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { canonicalSource, reportTitle } from '@/lib/display';
import type { Report } from '@/lib/types';
import { copy, localePath, type Locale } from '@/lib/i18n';
import { Brand } from './Brand';

export function Sidebar({ locale }: { locale: Locale }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [access, setAccess] = useState<{ kind: string; remaining: number } | null>(null);
  const text = copy[locale].sidebar;

  useEffect(() => {
    const load = async () => {
      const historyIds = JSON.parse(localStorage.getItem('habitat-history') || '[]') as string[];
      const pinIds = JSON.parse(localStorage.getItem('habitat-pins') || '[]') as string[];
      const [all, account] = await Promise.all([
        fetch('/api/reports').then(response => response.json()) as Promise<Report[]>,
        fetch('/api/auth/me').then(response => response.json()) as Promise<{ access?: { kind: string; remaining: number } }>,
      ]);
      const visible = all.filter(item => historyIds.includes(item.id));
      const unique = new Map<string, Report>();
      [...visible].reverse().forEach((item) => unique.set(/^https?:/i.test(item.source) ? canonicalSource(item.source) : item.id, item));
      const deduplicated = [...unique.values()];
      const uniqueIds = deduplicated.map((item) => item.id);
      if (uniqueIds.length !== historyIds.length) localStorage.setItem('habitat-history', JSON.stringify(uniqueIds));
      setReports(deduplicated);
      setPinned(pinIds.filter((id) => uniqueIds.includes(id)));
      setAccess(account.access || null);
    };
    load();
    window.addEventListener('habitat-history-changed', load);
    return () => window.removeEventListener('habitat-history-changed', load);
  }, []);

  const ordered = useMemo(() => [...reports].sort((a, b) => {
    const pinDifference = Number(pinned.includes(b.id)) - Number(pinned.includes(a.id));
    return pinDifference || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }), [reports, pinned]);
  const dayPassEligible = access?.kind === 'free' && access.remaining === 0;

  const toggleSelect = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : current.length === 2 ? current : [...current, id]);
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
    setSelected(current => current.filter(value => value !== id));
    window.dispatchEvent(new Event('habitat-history-changed'));
  };
  const compare = async () => {
    const response = await fetch('/api/comparisons', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reportIds: selected }) });
    const result = await response.json() as { id?: string };
    if (response.ok && result.id) location.href = localePath(locale, `/c/${result.id}`);
  };

  return <aside className={collapsed ? 'sidebar collapsed' : 'sidebar'}>
    <header><Brand className="side-logo" locale={locale}/><button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? text.expand : text.collapse} title={collapsed ? text.expand : text.collapse}><span>‹</span></button></header>
    <div className="actions"><Link href={localePath(locale)} className="new">＋ <span>{text.newAssessment}</span></Link><Link href={dayPassEligible ? `${localePath(locale)}?daypass=1` : localePath(locale, '/account')} className={dayPassEligible ? 'upgrade ready' : 'upgrade'}>✦ <span>{dayPassEligible ? text.dayPass : text.upgrade}</span></Link></div>
    <p className="quota">{text.quota}</p><p className="side-label">{text.yours}</p>
    <div className="history">{ordered.length ? ordered.map(item => <div className={pinned.includes(item.id) ? 'history-row pinned' : 'history-row'} key={item.id}>
      <input aria-label={`${text.select} ${reportTitle(item, locale)}`} type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)}/>
      <Link href={localePath(locale, `/r/${item.id}`)}>{reportTitle(item, locale)}<small>{new Date(item.createdAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB')}</small></Link>
      <div className="history-controls">
        <button className="pin" title={pinned.includes(item.id) ? text.unpin : text.pin} aria-label={pinned.includes(item.id) ? text.unpin : text.pin} aria-pressed={pinned.includes(item.id)} onClick={() => togglePin(item.id)}>{pinned.includes(item.id) ? '●' : '○'}</button>
        <button className="remove" title={text.remove} aria-label={`${text.removeAssessment}: ${reportTitle(item, locale)}`} onClick={() => removeFromHistory(item.id)}>×</button>
      </div>
    </div>) : <p className="empty">{text.empty}</p>}</div>
    <button className="compare" onClick={compare} disabled={selected.length !== 2}>{text.compare} <b>{selected.length}/2</b></button>
  </aside>;
}
