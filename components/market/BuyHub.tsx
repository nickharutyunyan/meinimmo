'use client';

import Link from 'next/link';
import { localePath, type Locale } from '@/lib/i18n';
import type { ListingSummary } from '@/lib/market/types';
import { marketCopy } from '@/lib/market/copy';
import { MARKET_CITIES, MARKET_SLUGS } from '@/lib/market/cities';
import { priceShort } from '@/lib/market/format';
import { ListingCard } from './ListingCard';
import { useMarketListings } from './useMarketListings';
import { CityPostcard } from '../Illustrations';

/** The hub body. The page around it is static; listings load from /api/market. */
export function BuyHub({ locale }: { locale: Locale }) {
  const text = marketCopy[locale];
  const { listings: loaded } = useMarketListings(locale);
  const loading = loaded === null;
  const listings = loaded || [];
  const cities = MARKET_SLUGS.map(slug => {
    const own = listings.filter(listing => listing.market === slug);
    const prices = own.map(listing => listing.price).filter(price => price > 0);
    return { slug, count: own.length, from: prices.length ? Math.min(...prices) : 0 };
  });
  const elsewhere = listings.filter(listing => !listing.market);
  // Alternate cities so the newest strip is not one city's latest import.
  const queues = MARKET_SLUGS.map(slug => listings.filter(listing => listing.market === slug));
  const newest: ListingSummary[] = [];
  for (let round = 0; newest.length < 8 && queues.some(queue => queue.length > round); round += 1) {
    for (const queue of queues) if (queue[round] && newest.length < 8) newest.push(queue[round]);
  }

  return <main className="market-hub">
      <header className="market-hero">
        <p className="market-eyebrow">{text.hub.eyebrow}</p>
        <h1>{text.hub.title} <em>{text.hub.emphasis}</em></h1>
        <p className="market-lede">{text.hub.lede}</p>
      </header>

      <section aria-labelledby="market-cities">
        <h2 id="market-cities" className="market-section-label">{text.hub.cities}</h2>
        <div className="market-city-grid">
          {cities.map(city => <Link key={city.slug} href={localePath(locale, `/buy/${city.slug}`)} className="market-city-tile">
            <CityPostcard city={city.slug} />
            <div className="market-city-meta">
              <h3>{MARKET_CITIES[city.slug].name[locale]}</h3>
              <p>{loading ? '\u00a0' : <>{text.hub.homes(city.count)}{city.from ? <> · {text.hub.from} {priceShort(city.from, locale)}</> : null}</>}</p>
            </div>
            <span className="market-city-arrow" aria-hidden="true">→</span>
          </Link>)}
        </div>
      </section>

      <section className="market-sell-band">
        <div>
          <h2>{text.hub.sellTitle}</h2>
          <p>{text.hub.sellText}</p>
        </div>
        <Link className="market-button is-light" href={localePath(locale, '/sell')}>{text.hub.sellCta}</Link>
      </section>

      {loading ? <section aria-hidden="true">
        <h2 className="market-section-label">{text.hub.newest}</h2>
        <div className="market-grid is-wide">{Array.from({ length: 4 }, (_, index) => <div key={index} className="market-card is-skeleton"><div className="market-card-media" /><div className="market-card-body"><p className="market-card-facts">&nbsp;</p></div></div>)}</div>
      </section> : null}

      {newest.length ? <section aria-labelledby="market-newest">
        <h2 id="market-newest" className="market-section-label">{text.hub.newest}</h2>
        <div className="market-grid is-wide">
          {newest.map((listing, position) => <ListingCard key={listing.id} listing={listing} locale={locale} priority={position < 4} />)}
        </div>
      </section> : null}

      {elsewhere.length ? <section aria-labelledby="market-elsewhere">
        <h2 id="market-elsewhere" className="market-section-label">{text.hub.elsewhere}</h2>
        <div className="market-grid is-wide">
          {elsewhere.slice(0, 12).map(listing => <ListingCard key={listing.id} listing={listing} locale={locale} />)}
        </div>
      </section> : null}
  </main>;
}
