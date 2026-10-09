'use client';

import { useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { marketCopy } from '@/lib/market/copy';

const REASONS = ['spam', 'scam', 'wrong', 'unavailable', 'other'] as const;

/** A quiet link that opens a two-field form. Three reports take a listing offline for review. */
export function ReportListing({ listingId, locale }: { listingId: string; locale: Locale }) {
  const text = marketCopy[locale].listing;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number] | ''>('');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [error, setError] = useState('');

  async function send() {
    if (!reason) return;
    setState('sending');
    try {
      const response = await fetch(`/api/listings/${listingId}/report`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason, note }) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || '');
      setState('sent');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '');
      setState('failed');
    }
  }

  if (state === 'sent') return <p className="listing-report is-done" role="status">{text.reportThanks}</p>;
  if (!open) return <button type="button" className="listing-report-link" onClick={() => setOpen(true)}>{text.report}</button>;
  return <form className="listing-report" onSubmit={event => { event.preventDefault(); void send(); }}>
    <fieldset>
      <legend>{text.reportTitle}</legend>
      {REASONS.map(value => <label key={value} className="listing-report-reason">
        <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
        <span>{text.reportReasons[value]}</span>
      </label>)}
    </fieldset>
    <label className="listing-report-note">
      <span>{text.reportNote}</span>
      <textarea value={note} onChange={event => setNote(event.target.value)} maxLength={500} rows={3} />
    </label>
    {state === 'failed' ? <p className="editor-verify-error" role="alert">{error || marketCopy[locale].editor.saveFailed}</p> : null}
    <div className="listing-report-actions">
      <button type="submit" className="market-button is-small" disabled={!reason || state === 'sending'}>{text.reportSend}</button>
      <button type="button" className="market-link-button" onClick={() => { setOpen(false); setState('idle'); }}>{text.reportCancel}</button>
    </div>
  </form>;
}
