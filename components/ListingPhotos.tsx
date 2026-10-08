'use client';

import { useEffect, useState } from 'react';
import { copy, type Locale } from '../lib/i18n.ts';
import { displayableListingPhotos, isRemoteListingSource, listingPhotosToShow } from '../lib/listing-photos.ts';

export function ListingPhotos({ urls, listingUrl, locale }: { urls?: string[]; listingUrl: string; locale: Locale }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  // The cached document is rendered once. Expiry is applied after mount so a
  // stored page does not keep an image whose `exp` has since passed.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, []);
  const photos = now === null
    ? displayableListingPhotos(urls).filter((url) => !failed.has(url))
    : listingPhotosToShow(urls, failed, now);
  if (!isRemoteListingSource(listingUrl) || photos.length === 0) return null;
  const caption = copy[locale].report.photosCaption;
  const total = photos.length;

  return <section className="listing-photos" aria-labelledby="listing-photos-caption">
    <p id="listing-photos-caption" className="listing-photos-caption">{caption}</p>
    <div className="listing-photos-strip">
      {photos.map((url, index) => <a key={url} href={listingUrl} target="_blank" rel="noreferrer" aria-label={copy[locale].report.photoLink.replaceAll('{n}', String(index + 1)).replaceAll('{total}', String(total))}>
        <img
          src={url}
          alt=""
          width={160}
          height={120}
          loading="lazy"
          referrerPolicy="no-referrer"
          decoding="async"
          onError={() => setFailed((current) => {
            if (current.has(url)) return current;
            const next = new Set(current);
            next.add(url);
            return next;
          })}
        />
      </a>)}
    </div>
  </section>;
}
