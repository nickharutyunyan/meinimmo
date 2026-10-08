'use client';

import { useEffect, useState } from 'react';
import { copy, type Locale } from '../lib/i18n.ts';
import { isRemoteListingSource, listingPhotoHref, listingPhotoSlot, listingPhotosToShow, listingThumbnailUrl } from '../lib/listing-photos.ts';

export function ListingPhotos({ urls, listingUrl, locale, renderedAt, initialFailed }: { urls?: string[]; listingUrl: string; locale: Locale; renderedAt?: number; initialFailed?: readonly string[] }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set(initialFailed));
  // Expiry follows the img src. A cached document still drops a signed src
  // whose time passes after that render, once the browser has mounted.
  const [now, setNow] = useState(() => renderedAt ?? Date.now());
  useEffect(() => {
    setNow(Date.now());
  }, []);
  const photos = listingPhotosToShow(urls, failed, now, listingUrl);
  if (!isRemoteListingSource(listingUrl) || photos.length === 0) return null;
  const caption = copy[locale].report.photosCaption;
  const total = photos.length;

  return <section className="listing-photos" aria-labelledby="listing-photos-caption">
    <p id="listing-photos-caption" className="listing-photos-caption">{caption}</p>
    <div className="listing-photos-strip">
      {photos.map((url, index) => {
        const slot = listingPhotoSlot(urls, url);
        const src = listingThumbnailUrl(url, listingUrl, slot);
        const href = listingPhotoHref(listingUrl, src, now);
        const label = copy[locale].report.photoLink.replaceAll('{n}', String(index + 1)).replaceAll('{total}', String(total));
        const image = <img
          src={src}
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
            setFailed((current) => {
              if (current.has(url)) return current;
              const next = new Set(current);
              next.add(url);
              return next;
            });
          }}
        />;
        if (!href) return <span key={url}>{image}</span>;
        return <a key={url} href={href} target="_blank" rel="noreferrer" aria-label={label}>{image}</a>;
      })}
    </div>
  </section>;
}
