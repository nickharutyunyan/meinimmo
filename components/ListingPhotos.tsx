'use client';

import { useEffect, useRef, useState } from 'react';
import { copy, type Locale } from '../lib/i18n.ts';
import { plainNumber } from '../lib/format.ts';
import { displayableListingPhotos, isRemoteListingSource, listingPhotosToShow } from '../lib/listing-photos.ts';
import { listingPhotoSrc, nextActiveUrl, nextPhotoAttempt } from '../lib/photo-viewer.ts';
import { PhotoViewer } from './PhotoViewer.tsx';

export function ListingPhotos({ urls, listingUrl, locale }: { urls?: string[]; listingUrl: string; locale: Locale }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  // The cached document is rendered once. Expiry is applied after mount so a
  // stored page does not keep an image whose `exp` has since passed.
  const [now, setNow] = useState<number | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const activeRef = useRef<string | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, []);
  const photos = now === null
    ? displayableListingPhotos(urls).filter((url) => !failed.has(url))
    : listingPhotosToShow(urls, failed, now);
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

  return <section className="listing-photos" aria-labelledby="listing-photos-caption">
    <p id="listing-photos-caption" className="listing-photos-caption">{text.photosCaption}</p>
    <div className="listing-photos-strip">
      {photos.map((url, index) => <button
        type="button"
        key={url}
        aria-label={label(index + 1)}
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
          src={listingPhotoSrc(url, 'thumb')}
          alt=""
          width={160}
          height={120}
          loading="lazy"
          referrerPolicy="no-referrer"
          decoding="async"
          onError={(event) => {
            const img = event.currentTarget;
            const next = nextPhotoAttempt(url, img.src);
            if (next && img.dataset.photoFallback !== '1') {
              img.dataset.photoFallback = '1';
              img.src = next;
              return;
            }
            markFailed(url);
          }}
        />
      </button>)}
    </div>
    {activeIndex >= 0 ? <PhotoViewer
      photos={photos}
      index={activeIndex}
      listingUrl={listingUrl}
      locale={locale}
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
