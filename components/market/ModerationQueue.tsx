'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Listing } from '@/lib/market/types';
import { displayDescription, displayTitle, photoSrc } from '@/lib/market/validate';
import { marketCopy } from '@/lib/market/copy';
import { areaLabel, priceLabel, pricePerSqmLabel } from '@/lib/market/format';

type Item = { listing: Listing; reports: Array<{ reason: string; note: string | null; createdAt: string }> };

const STATE_LABEL: Record<string, string> = { pending: 'Held at publish', hidden: 'Taken down after reports', none: 'Live, reported', approved: 'Approved, reported', rejected: 'Rejected' };

/** The moderators' queue. English only: it is an internal tool. */
export function ModerationQueue() {
  const flags = marketCopy.en.editor.flags;
  const reasons = marketCopy.en.listing.reportReasons;
  const [items, setItems] = useState<Item[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch('/api/moderation/listings', { cache: 'no-store' });
    if (!response.ok) { setDenied(true); return; }
    setItems((await response.json() as { items: Item[] }).items);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function decide(id: string, decision: 'approve' | 'reject' | 'hide') {
    setBusy(id);
    await fetch(`/api/moderation/listings/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decision, note: notes[id] || '' }) });
    setBusy(null);
    await load();
  }

  if (denied) return <main className="editor-empty"><p>This page is for moderators. Sign in with a moderator account.</p><Link className="market-button" href="/account">Sign in</Link></main>;
  if (!items) return <main className="editor-empty is-loading"><span className="market-spinner" aria-hidden="true" /></main>;

  return <main className="moderation">
    <header className="market-hero">
      <p className="market-eyebrow">Moderation</p>
      <h1>{items.length ? `${items.length} to look at` : 'Nothing waiting'}</h1>
      <p className="market-lede">Held listings stay offline until approved. Hidden ones were taken down by three buyer reports. Approving or rejecting closes the reports.</p>
    </header>
    <div className="moderation-list">
      {items.map(({ listing, reports }) => {
        const state = listing.moderation?.state || 'none';
        const cover = listing.photos[0];
        return <article key={listing.id} className={`moderation-item is-${state}`}>
          <div className="moderation-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {cover ? <img src={photoSrc(listing.id, cover, 'thumb')} alt="" referrerPolicy="no-referrer" /> : <span>No photo</span>}
            <small>{listing.photos.length} photos</small>
          </div>
          <div className="moderation-body">
            <p className="market-eyebrow">{STATE_LABEL[state] || state} · {listing.origin} · {listing.address.city || 'no city'}</p>
            <h2>{displayTitle(listing, 'en')}</h2>
            <p className="moderation-facts">{[priceLabel(listing.facts.price, 'en'), areaLabel(listing.facts.area || listing.facts.plotArea, 'en'), pricePerSqmLabel(listing.facts.price, listing.facts.area, 'en'), [listing.address.street, listing.address.postalCode].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</p>
            <p className="moderation-contact">{listing.contact.name || 'No name'} · {listing.contact.email || 'no email'}{listing.verifiedEmail === listing.contact.email ? ' ✓ verified' : ' (unverified)'}{listing.contact.phone ? ` · ${listing.contact.phone}` : ''}</p>
            {listing.moderation?.flags.length ? <ul className="moderation-flags">{listing.moderation.flags.map(flag => <li key={flag}>{flags[flag]}</li>)}</ul> : null}
            <details>
              <summary>Description</summary>
              <p className="moderation-text">{displayDescription(listing, 'en')}</p>
            </details>
            {reports.length ? <div className="moderation-reports">
              <h3>{reports.length} {reports.length === 1 ? 'report' : 'reports'}</h3>
              <ul>{reports.map(report => <li key={report.createdAt}><b>{reasons[report.reason as keyof typeof reasons] || report.reason}</b>{report.note ? ` — ${report.note}` : ''} <small>{report.createdAt.slice(0, 16).replace('T', ' ')}</small></li>)}</ul>
            </div> : null}
            <label className="editor-input">
              <span>Note to the seller (shown when rejected)</span>
              <input className="ed-field" value={notes[listing.id] || ''} onChange={event => setNotes({ ...notes, [listing.id]: event.target.value })} maxLength={500} />
            </label>
            <div className="moderation-actions">
              <button type="button" className="market-button is-small" disabled={busy === listing.id} onClick={() => decide(listing.id, 'approve')}>Approve</button>
              <button type="button" className="market-button is-small is-quiet" disabled={busy === listing.id} onClick={() => decide(listing.id, 'reject')}>Reject</button>
              {state !== 'hidden' ? <button type="button" className="market-link-button" disabled={busy === listing.id} onClick={() => decide(listing.id, 'hide')}>Hide for now</button> : null}
            </div>
          </div>
        </article>;
      })}
    </div>
  </main>;
}
