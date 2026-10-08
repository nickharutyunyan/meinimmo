'use client';

import { useState } from 'react';
import { copy, type Locale } from '../lib/i18n.ts';
import { isRemoteListingSource, listingPhotosToShow } from '../lib/listing-photos.ts';

export function ListingPhotos({ urls, listingUrl, locale }: { urls?: string[]; listingUrl: string; locale: Locale }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const photos = listingPhotosToShow(urls, failed);
  if (!isRemoteListingSource(listingUrl) || photos.length === 0) return null;
  const caption = copy[locale].report.photosCaption;

  return <section className="listing-photos" aria-labelledby="listing-photos-caption">
    <p id="listing-photos-caption" className="listing-photos-caption">{caption}</p>
    <div className="listing-photos-strip">
      {photos.map((url) => <a key={url} href={listingUrl} target="_blank" rel="noreferrer">
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
