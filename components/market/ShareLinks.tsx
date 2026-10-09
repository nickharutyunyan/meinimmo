'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { marketCopy } from '@/lib/market/copy';
import { shareTargets } from '@/lib/market/share';

const ICONS: Record<string, string> = {
  whatsapp: 'M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.2 20.8l4.5-1.2A8.8 8.8 0 1 0 12 3.2Zm4.6 12.3c-.2.6-1.1 1.1-1.6 1.1-.4.1-.9.1-1.5-.1a13 13 0 0 1-1.4-.5 10.6 10.6 0 0 1-4-3.6c-.3-.4-.9-1.3-.9-2.4s.6-1.7.8-1.9c.2-.2.5-.3.6-.3h.5c.1 0 .4 0 .6.4l.8 1.9c.1.1.1.3 0 .5l-.3.4-.3.4c-.1.1-.2.3-.1.5.2.3.7 1.1 1.5 1.8 1 .9 1.8 1.1 2.1 1.3.2.1.4.1.5-.1l.7-.9c.2-.2.3-.2.5-.1l1.9.9c.2.1.4.2.4.3.1.1.1.6-.1 1.2Z',
  telegram: 'M20.6 4.3 3.9 10.7c-1.1.5-1.1 1.1-.2 1.4l4.3 1.3 1.6 5c.2.6.4.8.8.8.4 0 .6-.2.9-.5l2-2 4.3 3.2c.8.4 1.4.2 1.6-.8l2.8-13.4c.3-1.2-.4-1.7-1.4-1.4Zm-3.3 3.6-7.5 6.8-.3 3.1-1.4-4.6 9.2-5.3Z',
  email: 'M3.5 6.5h17v11h-17zm0 0 8.5 6.5 8.5-6.5',
  facebook: 'M13.4 20.5v-7.3h2.5l.4-2.9h-2.9V8.5c0-.8.2-1.4 1.4-1.4h1.5V4.5a20 20 0 0 0-2.2-.1c-2.2 0-3.7 1.3-3.7 3.8v2.1H8v2.9h2.4v7.3Z',
  x: 'M4 4h4.3l3.9 5.4L16.9 4H19l-5.8 6.7L20 20h-4.3l-4.2-5.8L6.3 20H4.2l6.3-7.2Z',
  linkedin: 'M6.5 9h-3v11h3Zm-1.5-1.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM20.5 20v-6c0-3-1.6-4.4-3.8-4.4a3.3 3.3 0 0 0-3 1.6V9h-3v11h3v-5.6c0-1.5.3-2.9 2.1-2.9s1.8 1.7 1.8 3V20Z',
};

export function ShareLinks({ url, title, locale, compact = false }: { url: string; title: string; locale: Locale; compact?: boolean }) {
  const text = marketCopy[locale];
  const [copied, setCopied] = useState(false);
  const [native, setNative] = useState(false);
  const [absolute, setAbsolute] = useState(url);
  useEffect(() => {
    setAbsolute(new URL(url, window.location.origin).toString());
    setNative(typeof navigator.share === 'function');
  }, [url]);
  const targets = shareTargets(absolute, text.share.text(title));

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(absolute);
    } catch {
      const field = document.createElement('textarea');
      field.value = absolute;
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return <div className={`market-share${compact ? ' is-compact' : ''}`}>
    <div className="market-share-link">
      <input readOnly value={absolute} aria-label={text.share.title} onFocus={event => event.currentTarget.select()} />
      <button type="button" className="market-button is-small" onClick={copyLink}>{copied ? text.listing.copied : text.listing.copyLink}</button>
    </div>
    <div className="market-share-targets">
      {targets.map(target => <a key={target.id} href={target.href} target="_blank" rel="noreferrer" className={`market-share-target is-${target.id}`} aria-label={text.share[target.id]}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[target.id]} fill={target.id === 'email' ? 'none' : 'currentColor'} stroke={target.id === 'email' ? 'currentColor' : 'none'} strokeWidth="1.7" strokeLinejoin="round" /></svg>
        {compact ? null : <span>{text.share[target.id]}</span>}
      </a>)}
      {native ? <button type="button" className="market-share-target is-more" onClick={() => navigator.share({ title, url: absolute }).catch(() => undefined)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4m0 0L8 8m4-4 4 4M5 12v7h14v-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {compact ? null : <span>{text.share.more}</span>}
      </button> : null}
    </div>
  </div>;
}
