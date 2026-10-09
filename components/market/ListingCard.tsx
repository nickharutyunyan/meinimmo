'use client';

import Link from 'next/link';
import { useRef, useState, type UIEvent } from 'react';
import { localePath, type Locale } from '@/lib/i18n';
import type { ListingSummary } from '@/lib/market/types';
import { marketCopy } from '@/lib/market/copy';
import { areaLabel, floorLabel, pricePerSqmLabel, priceLabel, roomsLabel, typeLabel } from '@/lib/market/format';

export function scoreTone(score: number) {
  return score >= 7 ? 'good' : score >= 5.5 ? 'fair' : 'low';
}

export function ListingCard({
  listing,
  locale,
  active = false,
  selected = false,
  onHover,
  onToggleCompare,
  priority = false,
}: {
  listing: ListingSummary;
  locale: Locale;
  active?: boolean;
  selected?: boolean;
  onHover?: (id: string | null) => void;
  onToggleCompare?: (listing: ListingSummary) => void;
  priority?: boolean;
}) {
  const text = marketCopy[locale];
  const href = localePath(locale, `/l/${listing.id}`);
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const photos = listing.photos.filter(url => !failed.has(url));
  const size = listing.propertyType === 'land' ? areaLabel(listing.plotArea, locale) : areaLabel(listing.area, locale);
  const facts = [
    size,
    listing.propertyType !== 'land' && roomsLabel(listing.rooms, locale),
    listing.propertyType === 'flat' && floorLabel(listing.floor, locale),
    listing.propertyType === 'house' && listing.plotArea ? `${areaLabel(listing.plotArea, locale)} ${locale === 'de' ? 'Grund' : 'plot'}` : '',
  ].filter(Boolean) as string[];
  const place = [listing.district, listing.city].filter((value, position, all) => value && all.indexOf(value) === position).join(', ');

  const go = (delta: number) => {
    const node = strip.current;
    if (!node || photos.length < 2) return;
    const next = (index + delta + photos.length) % photos.length;
    node.scrollTo({ left: next * node.clientWidth, behavior: Math.abs(next - index) > 1 ? 'auto' : 'smooth' });
  };
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    const next = Math.round(node.scrollLeft / Math.max(node.clientWidth, 1));
    if (next !== index) setIndex(next);
  };

  return <article
    className={`market-card${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}`}
    onMouseEnter={() => onHover?.(listing.id)}
    onMouseLeave={() => onHover?.(null)}
    data-listing={listing.id}
  >
    <div className="market-card-media">
      {photos.length ? <div className="market-card-strip" ref={strip} onScroll={onScroll}>
        {photos.map((url, position) => <Link key={url} href={href} className="market-card-slide" tabIndex={-1} aria-hidden="true">
          {/* Listing photos come from many hosts and are already sized, so a plain img is right here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            loading={priority && position === 0 ? 'eager' : 'lazy'}
            decoding="async"
            referrerPolicy="no-referrer"
            draggable={false}
            onError={() => setFailed(previous => new Set(previous).add(url))}
          />
        </Link>)}
      </div> : <Link href={href} className="market-card-empty" tabIndex={-1} aria-hidden="true"><span>{typeLabel(listing.propertyType, locale)}</span></Link>}

      <div className="market-card-shade" aria-hidden="true" />
      <div className="market-card-overlay">
        <p className="market-card-price">{priceLabel(listing.price, locale)}</p>
        {listing.propertyType !== 'land' && listing.area > 0 ? <p className="market-card-sqm">{pricePerSqmLabel(listing.price, listing.area, locale)}</p> : null}
        {place ? <p className="market-card-place">{place}</p> : null}
      </div>

      {typeof listing.score === 'number' ? <span className={`market-score is-${scoreTone(listing.score)}`} title={text.card.reviewScore}>
        <b>{listing.score.toFixed(1).replace('.', locale === 'de' ? ',' : '.')}</b><span>{text.card.review}</span>
      </span> : null}

      {onToggleCompare ? <button
        type="button"
        className={`market-compare-toggle${selected ? ' is-on' : ''}`}
        aria-pressed={selected}
        onClick={() => onToggleCompare(listing)}
        title={selected ? text.card.comparing : text.card.compare}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">{selected
          ? <path d="m5 10.5 3.2 3L15 6.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M10 4.5v11M4.5 10h11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}</svg>
        <span>{selected ? text.card.comparing : text.card.compare}</span>
      </button> : null}

      {photos.length > 1 ? <>
        <button type="button" className="market-card-arrow is-prev" onClick={() => go(-1)} aria-label={text.card.previous}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        <button type="button" className="market-card-arrow is-next" onClick={() => go(1)} aria-label={text.card.next}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        <div className="market-card-dots" aria-label={text.card.photo(index + 1, photos.length)}>
          {photos.slice(0, 8).map((url, position) => <i key={url} className={position === index ? 'is-on' : ''} />)}
        </div>
      </> : null}
    </div>

    <div className="market-card-body">
      <p className="market-card-facts">{facts.map(fact => <span key={fact}>{fact}</span>)}</p>
      <h3 className="market-card-title"><Link href={href}>{listing.title}</Link></h3>
    </div>
  </article>;
}
