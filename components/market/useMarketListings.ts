'use client';

import { useEffect, useState } from 'react';
import type { ListingSummary } from '@/lib/market/types';

/** Loads published listings after the static page shell is on screen. */
export function useMarketListings(locale: 'en' | 'de', city?: string) {
  const [listings, setListings] = useState<ListingSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    const query = new URLSearchParams({ locale, ...(city ? { city } : {}) });
    fetch(`/api/market?${query}`)
      .then(response => response.ok ? response.json() as Promise<{ listings: ListingSummary[] }> : Promise.reject(new Error('market')))
      .then(body => { if (live) setListings(body.listings); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [locale, city]);
  return { listings, failed };
}
