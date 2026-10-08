'use client';

import { useState, type FormEvent } from 'react';
import type { Locale } from '@/lib/i18n';
import { feedbackErrorMessage } from '@/lib/fact-feedback';
import { provenanceSentence, type FactProvenance } from '@/lib/fact-provenance';
import { factSourceCopy } from '@/lib/fact-source-copy';
import { glossListingQuote } from '@/lib/listing-gloss';
import { useTip } from './use-tip';

export function FactSource({ reportId, locale, label, provenance, reportingEnabled = false }: {
  reportId: string;
  locale: Locale;
  label: string;
  provenance: FactProvenance;
  /** False until the feedback table exists. The source quote still shows. */
  reportingEnabled?: boolean;
}) {
  const text = factSourceCopy[locale];
  const tip = useTip();
  const [formOpen, setFormOpen] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const sentence = provenanceSentence(provenance, locale);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/reports/${reportId}/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          field: provenance.field,
          reportedValue: provenance.reportedValue,
          suggestedValue: String(data.get('suggested') || ''),
          comment: String(data.get('comment') || ''),
          locale,
        }),
      });
      if (response.status === 204) {
        setThanks(true);
        setFormOpen(false);
        return;
      }
      const body = await response.json().catch(() => null) as { error?: string } | null;
      setError(body?.error || feedbackErrorMessage('sendFailed', locale));
    } catch {
      setError(feedbackErrorMessage('sendFailed', locale));
    } finally {
      setPending(false);
    }
  }

  return <span
    className="fact-source"
    ref={tip.rootRef}
    onPointerOver={tip.onPointerOver}
    onPointerLeave={tip.onPointerLeave}
    onPointerDown={tip.onPointerDown}
    onFocus={tip.onFocus}
    onBlur={tip.onBlur}
  >
    <button
      ref={(node) => { tip.triggerRef.current = node; }}
      type="button"
      className="fact-source-button"
      aria-label={text.sourceFor(label)}
      aria-expanded={tip.open}
      aria-controls={tip.id}
      onClick={(event) => {
        event.stopPropagation();
        tip.onActivate(event);
      }}
    >ⓘ</button>
    {tip.open ? <div id={tip.id} className="fact-popover" role="dialog" aria-label={text.sourceFor(label)}>
      {provenance.kind === 'stated' && provenance.quotes.length
        ? provenance.quotes.map(quote => <p key={quote}><span className="fact-popover-kicker">{text.fromListing}</span> {glossListingQuote(quote, locale)}</p>)
        : <p>{sentence}</p>}
      {reportingEnabled ? thanks ? <p className="fact-thanks" role="status">{text.thanks}</p> : formOpen ? <form className="fact-feedback" onSubmit={onSubmit}>
        <label>{text.correctValue} <span>{text.optional}</span><input name="suggested" maxLength={80} autoComplete="off" /></label>
        <label>{text.comment} <span>{text.optional}</span><textarea name="comment" maxLength={300} rows={3} /></label>
        {error ? <p className="fact-feedback-error" role="alert">{error}</p> : null}
        <button type="submit" disabled={pending}>{pending ? text.sending : text.send}</button>
      </form> : <button type="button" className="fact-wrong" onClick={() => setFormOpen(true)}>{text.wrong}</button> : null}
    </div> : null}
  </span>;
}
