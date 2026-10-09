import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Locale } from '@/lib/i18n';
import { socialMetadata } from '@/lib/page-meta';
import { marketCopy } from '@/lib/market/copy';
import { MARKET_CITIES, isMarketSlug } from '@/lib/market/cities';
import { getListing } from '@/lib/market/store';
import { MARKET_SLUGS } from '@/lib/market/cities';

export const cityParams = () => MARKET_SLUGS.map(city => ({ city }));
import { displayDescription, displayTitle, publicListing } from '@/lib/market/validate';
import { priceLabel } from '@/lib/market/format';
import { BuyHub } from './BuyHub';
import { CitySearch } from './CitySearch';
import { ListingView } from './ListingView';
import { MarketNav } from './MarketNav';
import { SellStart } from './SellStart';
import { ListingEditor } from './ListingEditor';
import { RoadmapPage } from './RoadmapPage';
import { SiteFooter } from '../SiteFooter';
import Link from 'next/link';
import { localePath } from '@/lib/i18n';
import { StreetScene } from '../Illustrations';

const prefix = (locale: Locale) => locale === 'de' ? '/de' : '';

function alternates(path: string, locale: Locale): Metadata['alternates'] {
  return { canonical: `${prefix(locale)}${path}`, languages: { en: path, de: `/de${path}` } };
}

export function buyMetadata(locale: Locale): Metadata {
  const text = marketCopy[locale];
  return { ...socialMetadata(locale, `${text.hub.eyebrow} | Review a House`, text.hub.lede, `${prefix(locale)}/buy`), alternates: alternates('/buy', locale) };
}

/** Static: the listings load in the browser, so the page costs no server rendering. */
export function BuyHubPage({ locale }: { locale: Locale }) {
  return <div className="market-page">
    <MarketNav locale={locale} />
    <BuyHub locale={locale} />
    <SiteFooter locale={locale} />
  </div>;
}

export async function cityMetadata(locale: Locale, slug: string): Promise<Metadata> {
  if (!isMarketSlug(slug)) return {};
  const text = marketCopy[locale];
  const name = MARKET_CITIES[slug].name[locale];
  return { ...socialMetadata(locale, `${text.search.title(name)} | Review a House`, text.hub.lede, `${prefix(locale)}/buy/${slug}`), alternates: alternates(`/buy/${slug}`, locale) };
}

export function CityPage({ locale, slug }: { locale: Locale; slug: string }) {
  if (!isMarketSlug(slug)) notFound();
  const city = MARKET_CITIES[slug];
  return <div className="market-page is-app">
    <MarketNav locale={locale} current={slug} />
    <CitySearch city={slug} locale={locale} cityName={city.name[locale]} center={city.center} zoom={city.zoom} />
  </div>;
}

async function publishedListing(id: string) {
  const listing = await getListing(id).catch(() => undefined);
  return listing && listing.status === 'published' ? listing : undefined;
}

export async function listingMetadata(locale: Locale, id: string): Promise<Metadata> {
  const listing = await publishedListing(id);
  if (!listing) return { robots: { index: false } };
  const title = `${displayTitle(listing, locale)} · ${priceLabel(listing.facts.price, locale)} | Review a House`;
  const description = displayDescription(listing, locale).replace(/\s+/g, ' ');
  const meta = socialMetadata(locale, title, description, `${prefix(locale)}/l/${id}`);
  const cover = listing.photos[0];
  const image = cover ? (cover.kind === 'remote' ? cover.url : `/api/listings/${id}/photos/${cover.id}`) : undefined;
  return {
    ...meta,
    alternates: alternates(`/l/${id}`, locale),
    openGraph: { ...meta.openGraph, ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { ...meta.twitter, card: image ? 'summary_large_image' : 'summary' },
  };
}

export async function ListingPage({ locale, id }: { locale: Locale; id: string }) {
  const listing = await publishedListing(id);
  const text = marketCopy[locale];
  if (!listing) {
    return <div className="market-page">
      <MarketNav locale={locale} />
      <main className="editor-empty is-illustrated">
        <StreetScene className="empty-street" />
        <p>{text.listing.unavailable}</p>
        <Link className="market-button" href={localePath(locale, '/buy')}>{text.hub.eyebrow}</Link>
      </main>
      <SiteFooter locale={locale} />
    </div>;
  }
  return <div className="market-page">
    <MarketNav locale={locale} current={listing.market || undefined} />
    <ListingView listing={publicListing(listing)} locale={locale} />
    <SiteFooter locale={locale} />
  </div>;
}

export function sellMetadata(locale: Locale): Metadata {
  const text = marketCopy[locale];
  return { ...socialMetadata(locale, `${text.sell.title} ${text.sell.emphasis} | Review a House`, text.sell.lede, `${prefix(locale)}/sell`), alternates: alternates('/sell', locale) };
}

export function SellPage({ locale }: { locale: Locale }) {
  return <div className="market-page">
    <MarketNav locale={locale} current="sell" />
    <SellStart locale={locale} />
    <SiteFooter locale={locale} />
  </div>;
}

export const editorMetadata: Metadata = { title: 'Edit listing | Review a House', robots: { index: false, follow: false } };

export async function EditorPage({ locale, id }: { locale: Locale; id: string }) {
  if (!/^[0-9a-f]{12}$/.test(id)) notFound();
  return <div className="market-page">
    <MarketNav locale={locale} current="sell" />
    <ListingEditor id={id} locale={locale} />
  </div>;
}

export function roadmapMetadata(locale: Locale): Metadata {
  const text = marketCopy[locale];
  return { ...socialMetadata(locale, `${text.roadmap.title} | Review a House`, text.roadmap.lede, `${prefix(locale)}/roadmap`), alternates: alternates('/roadmap', locale) };
}

export { RoadmapPage };
