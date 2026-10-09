import Link from 'next/link';
import { localePath, type Locale } from '@/lib/i18n';
import type { ListingSummary } from '@/lib/market/types';
import { marketCopy } from '@/lib/market/copy';
import { MARKET_CITIES, MARKET_SLUGS } from '@/lib/market/cities';
import { priceShort } from '@/lib/market/format';
import { ListingCard } from './ListingCard';
import { MarketNav } from './MarketNav';
import { SiteFooter } from '../SiteFooter';

export function BuyHub({ locale, listings }: { locale: Locale; listings: ListingSummary[] }) {
  const text = marketCopy[locale];
  const cities = MARKET_SLUGS.map(slug => {
    const own = listings.filter(listing => listing.market === slug);
    const covers = own.filter(listing => listing.photos.length).slice(0, 3).map(listing => listing.photos[0]);
    const prices = own.map(listing => listing.price).filter(price => price > 0);
    return { slug, count: own.length, covers, from: prices.length ? Math.min(...prices) : 0 };
  });
  const elsewhere = listings.filter(listing => !listing.market);
  // Alternate cities so the newest strip is not one city's latest import.
  const queues = MARKET_SLUGS.map(slug => listings.filter(listing => listing.market === slug));
  const newest: ListingSummary[] = [];
  for (let round = 0; newest.length < 8 && queues.some(queue => queue.length > round); round += 1) {
    for (const queue of queues) if (queue[round] && newest.length < 8) newest.push(queue[round]);
  }

  return <div className="market-page">
    <MarketNav locale={locale} />
    <main className="market-hub">
      <header className="market-hero">
        <p className="market-eyebrow">{text.hub.eyebrow}</p>
        <h1>{text.hub.title} <em>{text.hub.emphasis}</em></h1>
        <p className="market-lede">{text.hub.lede}</p>
      </header>

      <section aria-labelledby="market-cities">
        <h2 id="market-cities" className="market-section-label">{text.hub.cities}</h2>
        <div className="market-city-grid">
          {cities.map(city => <Link key={city.slug} href={localePath(locale, `/buy/${city.slug}`)} className="market-city-tile">
            <div className={`market-city-collage is-${Math.min(city.covers.length, 3)}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {city.covers.map(url => <img key={url} src={url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />)}
            </div>
            <div className="market-city-meta">
              <h3>{MARKET_CITIES[city.slug].name[locale]}</h3>
              <p>{text.hub.homes(city.count)}{city.from ? <> · {text.hub.from} {priceShort(city.from, locale)}</> : null}</p>
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
    </main>
    <SiteFooter locale={locale} />
  </div>;
}
