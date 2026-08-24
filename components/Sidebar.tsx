'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { reportTitle } from '@/lib/display';
import type { Report } from '@/lib/types';

export function Sidebar() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const load = async () => {
      const historyIds = JSON.parse(localStorage.getItem('habitat-history') || '[]') as string[];
      const pinIds = JSON.parse(localStorage.getItem('habitat-pins') || '[]') as string[];
      const all = await fetch('/api/reports').then(response => response.json()) as Report[];
      setReports(all.filter(item => historyIds.includes(item.id)));
      setPinned(pinIds);
    };
    load();
    window.addEventListener('habitat-history-changed', load);
    return () => window.removeEventListener('habitat-history-changed', load);
  }, []);

  const ordered = useMemo(() => [...reports].sort((a, b) => {
    const pinDifference = Number(pinned.includes(b.id)) - Number(pinned.includes(a.id));
    return pinDifference || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }), [reports, pinned]);

  const toggleSelect = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : current.length === 2 ? current : [...current, id]);
  const togglePin = (id: string) => setPinned(current => {
    const next = current.includes(id) ? current.filter(value => value !== id) : [...current, id];
    localStorage.setItem('habitat-pins', JSON.stringify(next));
    return next;
  });
  const compare = async () => {
    const response = await fetch('/api/comparisons', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reportIds: selected }) });
    const result = await response.json() as { id?: string };
    if (response.ok && result.id) location.href = `/c/${result.id}`;
  };

  return <aside className={collapsed ? 'sidebar collapsed' : 'sidebar'}>
    <header><Link href="/" className="side-logo">h <span>habitat</span></Link><button onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>‹</button></header>
    <div className="actions"><Link href="/" className="new">＋ <span>New assessment</span></Link><button className="upgrade" disabled={reports.length < 2}>✦ <span>Upgrade</span></button></div>
    <p className="quota">2 free assessments daily</p><p className="side-label">YOUR ASSESSMENTS</p>
    <div className="history">{ordered.length ? ordered.map(item => <div className={pinned.includes(item.id) ? 'history-row pinned' : 'history-row'} key={item.id}>
      <input aria-label={`Select ${reportTitle(item)}`} type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)}/>
      <Link href={`/r/${item.id}`}>{reportTitle(item)}<small>{new Date(item.createdAt).toLocaleDateString('de-DE')}</small></Link>
      <button className="pin" aria-label={pinned.includes(item.id) ? 'Unpin assessment' : 'Pin assessment'} aria-pressed={pinned.includes(item.id)} onClick={() => togglePin(item.id)}>{pinned.includes(item.id) ? '●' : '○'}</button>
    </div>) : <p className="empty">Your saved assessments will appear here.</p>}</div>
    <button className="compare" onClick={compare} disabled={selected.length !== 2}>Compare selected <b>{selected.length}/2</b></button>
  </aside>;
}
