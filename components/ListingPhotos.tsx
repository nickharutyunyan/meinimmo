'use client';

import { useEffect, useRef, useState } from 'react';
import { copy, type Locale } from '../lib/i18n.ts';
import { plainNumber } from '../lib/format.ts';
import { isRemoteListingSource, listingPhotoSlot, listingPhotosToShow, listingThumbnailUrl } from '../lib/listing-photos.ts';
import { nextActiveUrl } from '../lib/photo-viewer.ts';
import { PhotoViewer } from './PhotoViewer.tsx';

export function ListingPhotos({ urls, stagedIndexes = [], listingUrl, locale, renderedAt, initialFailed }: { urls?: string[]; stagedIndexes?: readonly number[]; listingUrl: string; locale: Locale; renderedAt?: number; initialFailed?: readonly string[] }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set(initialFailed));
  // Expiry follows the img src. A cached document still drops a signed src
  // whose time passes after that render, once the browser has mounted.
  const [now, setNow] = useState(() => renderedAt ?? Date.now());
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const activeRef = useRef<string | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, []);
  const photos = listingPhotosToShow(urls, failed, now, listingUrl);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  activeRef.current = activeUrl;
  const photoKey = photos.join('\n');
  useEffect(() => {
    const active = activeRef.current;
    if (!active || photosRef.current.includes(active)) return;
    const next = nextActiveUrl([active], photosRef.current, active);
    activeRef.current = next;
    setActiveUrl(next);
    if (!next) {
      const trigger = triggerRef.current;
      requestAnimationFrame(() => {
        if (trigger?.isConnected) trigger.focus();
      });
    }
  }, [photoKey]);

  function restoreFocus() {
    const trigger = triggerRef.current;
    requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  }

  function markFailed(url: string) {
    const prior = photosRef.current;
    if (!prior.includes(url)) return;
    const visible = prior.filter((item) => item !== url);
    const wasOpen = activeRef.current !== null;
    const next = nextActiveUrl(prior, visible, activeRef.current);
    photosRef.current = visible;
    activeRef.current = next;
    setFailed((current) => {
      if (current.has(url)) return current;
      const added = new Set(current);
      added.add(url);
      return added;
    });
    setActiveUrl(next);
    if (wasOpen && !next) restoreFocus();
  }

  if (!isRemoteListingSource(listingUrl) || photos.length === 0) return null;
  const text = copy[locale].report;
  const total = photos.length;
  const label = (position: number) => text.photoAlt
    .replaceAll('{n}', plainNumber(position, locale))
    .replaceAll('{total}', plainNumber(total, locale));
  const activeIndex = activeUrl ? photos.indexOf(activeUrl) : -1;
  const thumbFor = (url: string) => listingThumbnailUrl(url, listingUrl, listingPhotoSlot(urls, url));
  const stagedSlots = new Set(stagedIndexes);
  const photoIsStaged = (url: string) => stagedSlots.has(listingPhotoSlot(urls, url));

  return <section className="listing-photos" aria-labelledby="listing-photos-caption">
    <p id="listing-photos-caption" className="listing-photos-caption">{text.photosCaption}</p>
    <div className="listing-photos-strip">
      {photos.map((url, index) => {
        const staged = photoIsStaged(url);
        const name = staged ? `${label(index + 1)}. ${text.photoStaged}` : label(index + 1);
        return <button
        type="button"
        key={url}
        aria-label={name}
        onClick={(event) => {
          const img = event.currentTarget.querySelector('img');
          if (img?.complete && img.naturalWidth === 0) {
            markFailed(url);
            return;
          }
          triggerRef.current = event.currentTarget;
          activeRef.current = url;
          setActiveUrl(url);
        }}
      >
        <img
          src={thumbFor(url)}
          alt=""
          width={160}
          height={120}
          loading="lazy"
          referrerPolicy="no-referrer"
          decoding="async"
          onError={(event) => {
            const image = event.currentTarget;
            image.hidden = true;
            const frame = image.parentElement;
            if (frame) frame.hidden = true;
            markFailed(url);
          }}
        />
        {staged ? <span className="listing-photo-badge">{text.photoStaged}</span> : null}
      </button>;
      })}
    </div>
    {activeIndex >= 0 ? <PhotoViewer
      photos={photos}
      thumbs={photos.map(thumbFor)}
      index={activeIndex}
      now={now}
      listingUrl={listingUrl}
      locale={locale}
      staged={activeIndex >= 0 ? photoIsStaged(photos[activeIndex]) : false}
      onClose={() => {
        activeRef.current = null;
        setActiveUrl(null);
        restoreFocus();
      }}
      onSelect={(index) => {
        const next = photos[index] ?? null;
        activeRef.current = next;
        setActiveUrl(next);
      }}
      onFail={markFailed}
    /> : null}
  </section>;
}
