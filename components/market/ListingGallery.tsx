'use client';

import { useEffect, useRef, useState, type ReactNode, type UIEvent } from 'react';
import type { Locale } from '@/lib/i18n';
import { marketCopy } from '@/lib/market/copy';
import { PhotoViewer } from '../PhotoViewer';

/**
 * The photo stage: one large photo with the price and address laid over it,
 * swipe or arrow keys to move, thumbnails below, and a full-screen viewer on click.
 */
export function ListingGallery({ photos, thumbs, locale, overlay, sourceUrl }: {
  photos: string[];
  thumbs: string[];
  locale: Locale;
  overlay: ReactNode;
  sourceUrl: string;
}) {
  const text = marketCopy[locale];
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [now] = useState(() => Date.now());
  const visible = photos.map((url, position) => ({ url, thumb: thumbs[position] || url })).filter(photo => !failed.has(photo.url));

  const show = (next: number, smooth = true) => {
    const node = strip.current;
    if (!node || !visible.length) return;
    const target = (next + visible.length) % visible.length;
    node.scrollTo({ left: target * node.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
    setIndex(target);
  };
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    const next = Math.round(node.scrollLeft / Math.max(node.clientWidth, 1));
    if (next !== index) setIndex(next);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (viewer !== null || (event.target as HTMLElement)?.closest('input, textarea, select, [contenteditable]')) return;
      if (event.key === 'ArrowRight') show(index + 1);
      if (event.key === 'ArrowLeft') show(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!visible.length) return <div className="listing-stage is-empty"><div className="listing-stage-overlay">{overlay}</div></div>;

  return <section className="listing-gallery" aria-label={text.listing.gallery}>
    <div className="listing-stage">
      <div className="listing-stage-strip" ref={strip} onScroll={onScroll}>
        {visible.map((photo, position) => <button key={photo.url} type="button" className="listing-stage-slide" onClick={() => setViewer(position)} aria-label={`${text.listing.gallery} · ${text.card.photo(position + 1, visible.length)}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="" loading={position < 2 ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" draggable={false} onError={() => setFailed(previous => new Set(previous).add(photo.url))} />
        </button>)}
      </div>
      <div className="listing-stage-shade" aria-hidden="true" />
      <div className="listing-stage-overlay">{overlay}</div>
      <span className="listing-stage-count">{index + 1} / {visible.length}</span>
      {visible.length > 1 ? <>
        <button type="button" className="listing-stage-arrow is-prev" onClick={() => show(index - 1)} aria-label={text.card.previous}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        <button type="button" className="listing-stage-arrow is-next" onClick={() => show(index + 1)} aria-label={text.card.next}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      </> : null}
    </div>
    {visible.length > 1 ? <div className="listing-thumbs" role="tablist" aria-label={text.listing.gallery}>
      {visible.map((photo, position) => <button
        key={photo.url}
        type="button"
        role="tab"
        aria-selected={position === index}
        className={position === index ? 'is-on' : ''}
        onClick={() => show(position, Math.abs(position - index) < 2)}
        aria-label={text.card.photo(position + 1, visible.length)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      </button>)}
    </div> : null}
    {viewer !== null ? <PhotoViewer
      photos={visible.map(photo => photo.url)}
      thumbs={visible.map(photo => photo.thumb)}
      index={viewer}
      now={now}
      listingUrl={sourceUrl}
      locale={locale}
      onClose={() => { show(viewer, false); setViewer(null); }}
      onSelect={setViewer}
      onFail={url => setFailed(previous => new Set(previous).add(url))}
    /> : null}
  </section>;
}
