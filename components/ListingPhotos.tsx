'use client';

import { useEffect, useState } from 'react';
import { copy, type Locale } from '../lib/i18n.ts';
import { displayableListingPhotos, isRemoteListingSource, listingPhotosToShow, listingThumbnailUrl } from '../lib/listing-photos.ts';

export function ListingPhotos({ urls, listingUrl, locale, renderedAt }: { urls?: string[]; listingUrl: string; locale: Locale; renderedAt?: number }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  // Expiry is decided on the server. A cached document still drops a link
  // whose `exp` passes after that render, once the browser has mounted.
  const [now, setNow] = useState(() => renderedAt ?? Date.now());
  useEffect(() => {
    setNow(Date.now());
  }, []);
  const photos = listingPhotosToShow(urls, failed, now);
  if (!isRemoteListingSource(listingUrl) || photos.length === 0) return null;
  const caption = copy[locale].report.photosCaption;
  const total = photos.length;
  const order = displayableListingPhotos(urls);

  return <section className="listing-photos" aria-labelledby="listing-photos-caption">
    <p id="listing-photos-caption" className="listing-photos-caption">{caption}</p>
    <div className="listing-photos-strip">
      {photos.map((url, index) => <a key={url} href={listingUrl} target="_blank" rel="noreferrer" aria-label={copy[locale].report.photoLink.replaceAll('{n}', String(index + 1)).replaceAll('{total}', String(total))}>
        <img
          src={listingThumbnailUrl(url, listingUrl, Math.max(0, order.indexOf(url)))}
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
