'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { localePath, type Locale } from '@/lib/i18n';
import type { Listing, ListingPhoto } from '@/lib/market/types';
import type { ListingPatch, ReadinessItem } from '@/lib/market/validate';
import { displayDescription, displayTitle, listingSummary, photoSrc } from '@/lib/market/validate';
import { marketCopy } from '@/lib/market/copy';
import { MARKET_CITIES } from '@/lib/market/cities';
import { FEATURE_KEYS, featureLabel } from '@/lib/market/features';
import { CONDITION_OPTIONS, areaLabel, conditionLabel, floorLabel, pricePerSqmLabel, priceLabel, roomsLabel, typeLabel } from '@/lib/market/format';
import { ListingGallery } from './ListingGallery';
import { ShareLinks } from './ShareLinks';
import { AreaField, NumberField, TextField } from './EditFields';
import { PhotoManager } from './PhotoManager';
import { scoreTone } from './ListingCard';
import { ReportListing } from './ReportListing';

const MarketMap = dynamic(() => import('./MarketMap').then(module => module.MarketMap), {
  ssr: false,
  loading: () => <div className="market-map is-loading" />,
});

export type EditorHooks = {
  patch: (patch: ListingPatch) => void;
  addPhotos: (files: File[]) => void;
  removePhoto: (photo: ListingPhoto) => void;
  reorderPhotos: (keys: string[]) => void;
  uploading: string | null;
  missing: ReadinessItem[];
  sidebar: ReactNode;
};

const ENERGY = ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function Fact({ label, children, missing = false, wide = false }: { label: string; children: ReactNode; missing?: boolean; wide?: boolean }) {
  return <div className={`listing-fact${missing ? ' is-missing' : ''}${wide ? ' is-wide' : ''}`}>
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>;
}

export function ListingView({ listing, locale, edit }: { listing: Listing; locale: Locale; edit?: EditorHooks }) {
  const text = marketCopy[locale];
  const facts = listing.facts;
  const title = displayTitle(listing, locale);
  const description = displayDescription(listing, locale);
  const city = listing.market ? MARKET_CITIES[listing.market].name[locale] : listing.address.city;
  const place = [listing.address.district, city].filter((value, index, all) => value && all.indexOf(value) === index).join(', ');
  const addressLine = [listing.address.street, [listing.address.postalCode, listing.address.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const photos = listing.photos.map(photo => photoSrc(listing.id, photo, 'full'));
  const thumbs = listing.photos.map(photo => photoSrc(listing.id, photo, 'thumb'));
  const pageUrl = localePath(locale, `/l/${listing.id}`);
  const isLand = listing.propertyType === 'land';
  const sizeValue = isLand ? facts.plotArea : facts.area;
  const missing = new Set(edit?.missing || []);
  const set = (factsPatch: Record<string, unknown>) => edit?.patch({ facts: factsPatch });
  const setAddress = (addressPatch: Record<string, unknown>) => edit?.patch({ address: addressPatch });

  const keyFacts = [
    { key: 'price', label: text.listing.price, show: true, value: priceLabel(facts.price, locale), editor: <NumberField value={facts.price || null} locale={locale} label={text.listing.price} suffix="€" onCommit={value => set({ price: value ?? 0 })} id="field-price" /> },
    { key: 'sqm', label: text.listing.perSqm, show: !isLand && !edit, value: pricePerSqmLabel(facts.price, facts.area, locale) },
    { key: 'size', label: isLand ? text.listing.plot : text.listing.area, show: true, value: areaLabel(sizeValue, locale), editor: <NumberField value={sizeValue || null} locale={locale} digits={1} label={isLand ? text.listing.plot : text.listing.area} suffix="m²" onCommit={value => set(isLand ? { plotArea: value } : { area: value ?? 0 })} id="field-size" /> },
    { key: 'rooms', label: text.listing.rooms, show: !isLand, value: roomsLabel(facts.rooms, locale).replace(/ rooms?$| Zi\.$/, ''), editor: <NumberField value={facts.rooms} locale={locale} digits={1} label={text.listing.rooms} onCommit={value => set({ rooms: value })} /> },
    { key: 'floor', label: text.listing.floor, show: listing.propertyType === 'flat', value: floorLabel(facts.floor, locale), editor: <TextField value={facts.floor} label={text.listing.floor} placeholder={locale === 'de' ? '3. OG' : '3rd floor'} maxLength={30} onCommit={value => set({ floor: value })} /> },
    { key: 'plot', label: text.listing.plot, show: listing.propertyType === 'house', value: areaLabel(facts.plotArea, locale), editor: <NumberField value={facts.plotArea} locale={locale} label={text.listing.plot} suffix="m²" onCommit={value => set({ plotArea: value })} /> },
  ].filter(item => item.show && (edit ? true : item.value));

  const overlay = <div className="listing-overlay">
    <p className="listing-overlay-price">{priceLabel(facts.price, locale) || '—'}</p>
    <p className="listing-overlay-facts">{[areaLabel(sizeValue, locale), !isLand && roomsLabel(facts.rooms, locale), listing.propertyType === 'flat' && floorLabel(facts.floor, locale)].filter(Boolean).join(' · ')}</p>
    {addressLine || place ? <p className="listing-overlay-place">{listing.address.street || place}{listing.address.street && place ? ` · ${place}` : ''}</p> : null}
  </div>;

  const hasDetails = Boolean(facts.year || facts.condition || facts.energyClass || facts.heating || facts.housegeld || facts.availableFrom);
  const features = edit ? FEATURE_KEYS : facts.features;
  const summary = listingSummary(listing, locale);

  return <div className={`listing-page${edit ? ' is-editing' : ''}`}>
    {edit ? <PhotoManager listing={listing} locale={locale} onAdd={edit.addPhotos} onRemove={edit.removePhoto} onReorder={edit.reorderPhotos} uploading={edit.uploading} missing={missing.has('photos')} />
      : <ListingGallery photos={photos} thumbs={thumbs} locale={locale} overlay={overlay} sourceUrl={listing.sourceUrl || pageUrl} />}

    <div className="listing-layout">
      <article className="listing-main">
        <header className="listing-head">
          <p className="market-eyebrow">
            {edit ? <span className="listing-type-switch" role="radiogroup" aria-label={text.editor.typeLabel}>
              {(['flat', 'house', 'land'] as const).map(type => <button key={type} type="button" role="radio" aria-checked={listing.propertyType === type} className={listing.propertyType === type ? 'is-on' : ''} onClick={() => edit.patch({ propertyType: type })}>{typeLabel(type, locale)}</button>)}
            </span> : <>{typeLabel(listing.propertyType, locale)}{place ? ` · ${place}` : ''}</>}
          </p>
          {edit ? <div className={`listing-title-edit${missing.has('title') ? ' is-missing' : ''}`}>
            <AreaField className="listing-title" value={title} label={text.editor.addTitle} placeholder={text.editor.addTitle} maxLength={120} onCommit={value => edit.patch({ title: value.replace(/\n+/g, ' ') })} id="field-title" />
            {listing.autoTitle ? <p className="ed-hint">{text.editor.autoText}</p> : <button type="button" className="ed-reset" onClick={() => edit.patch({ title: '' })}>{text.editor.resetText}</button>}
          </div> : <h1 className="listing-title">{title}</h1>}
          {!edit && addressLine ? <p className="listing-address">{addressLine}</p> : null}
        </header>

        <dl className="listing-keyfacts">
          {keyFacts.map(item => <Fact key={item.key} label={item.label} missing={(item.key === 'price' && missing.has('price')) || (item.key === 'size' && missing.has('size'))}>
            {edit && item.editor ? item.editor : item.value || '—'}
          </Fact>)}
        </dl>

        <section className="listing-section">
          <h2>{text.listing.about}</h2>
          {edit ? <div className="listing-description-edit">
            <AreaField className="listing-description" value={description} label={text.listing.about} placeholder={text.editor.addDescription} onCommit={value => edit.patch({ description: value })} />
            {listing.autoDescription ? <p className="ed-hint">{text.editor.autoText}</p> : <button type="button" className="ed-reset" onClick={() => edit.patch({ description: '' })}>{text.editor.resetText}</button>}
          </div> : <div className="listing-description">{description.split(/\n{2,}/).map(paragraph => <p key={paragraph.slice(0, 40)}>{paragraph}</p>)}</div>}
        </section>

        {hasDetails || edit ? <section className="listing-section">
          <dl className="listing-details">
            {!isLand ? <Fact label={text.listing.year}>{edit ? <TextField value={facts.year} label={text.listing.year} placeholder="1912" maxLength={4} onCommit={value => set({ year: value })} /> : facts.year || '—'}</Fact> : null}
            {!isLand ? <Fact label={text.listing.condition}>{edit ? <select className="ed-field" value={facts.condition.toLowerCase()} aria-label={text.listing.condition} onChange={event => set({ condition: event.target.value })}>
              <option value="">—</option>
              {CONDITION_OPTIONS.map(option => <option key={option} value={option}>{conditionLabel(option, locale)}</option>)}
              {facts.condition && !CONDITION_OPTIONS.includes(facts.condition.toLowerCase()) ? <option value={facts.condition.toLowerCase()}>{facts.condition}</option> : null}
            </select> : conditionLabel(facts.condition, locale) || '—'}</Fact> : null}
            {!isLand ? <Fact label={text.listing.energy}>{edit ? <select className="ed-field" value={facts.energyClass} aria-label={text.listing.energy} onChange={event => set({ energyClass: event.target.value })}>
              <option value="">—</option>
              {ENERGY.map(option => <option key={option} value={option}>{option}</option>)}
            </select> : facts.energyClass ? <span className={`listing-energy is-${facts.energyClass.replace('+', 'plus').toLowerCase()}`}>{facts.energyClass}</span> : '—'}</Fact> : null}
            {!isLand ? <Fact label={text.listing.heating}>{edit ? <TextField value={facts.heating} label={text.listing.heating} placeholder={locale === 'de' ? 'Gas-Zentralheizung' : 'Gas central heating'} onCommit={value => set({ heating: value })} /> : facts.heating || '—'}</Fact> : null}
            {listing.propertyType === 'flat' ? <Fact label={text.listing.housegeld}>{edit ? <NumberField value={facts.housegeld} locale={locale} label={text.listing.housegeld} suffix={`€ ${text.listing.perMonth}`} onCommit={value => set({ housegeld: value })} /> : facts.housegeld ? `${priceLabel(facts.housegeld, locale)} ${text.listing.perMonth}` : '—'}</Fact> : null}
            <Fact label={text.listing.available}>{edit ? <TextField value={facts.availableFrom} label={text.listing.available} placeholder={locale === 'de' ? 'sofort' : 'now'} onCommit={value => set({ availableFrom: value })} /> : facts.availableFrom || '—'}</Fact>
          </dl>
        </section> : null}

        {features.length ? <section className="listing-section">
          <h2>{text.listing.features}</h2>
          <ul className="listing-features">
            {features.map(key => {
              const on = facts.features.includes(key);
              return <li key={key}>{edit
                ? <button type="button" className={`listing-feature${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => set({ features: on ? facts.features.filter(value => value !== key) : [...facts.features, key] })}>{featureLabel(key, locale)}</button>
                : <span className="listing-feature is-on">{featureLabel(key, locale)}</span>}</li>;
            })}
          </ul>
        </section> : null}

        <section className="listing-section">
          <h2>{text.listing.location}</h2>
          {edit ? <div className={`listing-address-edit${missing.has('location') ? ' is-missing' : ''}`}>
            <label className="is-street"><span>{text.editor.street}</span><TextField value={listing.address.street} label={text.editor.street} maxLength={120} onCommit={value => setAddress({ street: value })} id="field-location" /></label>
            <label><span>{text.editor.postalCode}</span><TextField value={listing.address.postalCode} label={text.editor.postalCode} maxLength={5} placeholder="10405" onCommit={value => setAddress({ postalCode: value })} /></label>
            <label><span>{text.editor.city}</span><TextField value={listing.address.city} label={text.editor.city} placeholder="Berlin" onCommit={value => setAddress({ city: value })} /></label>
            <label><span>{text.editor.district}</span><TextField value={listing.address.district} label={text.editor.district} placeholder={locale === 'de' ? 'z. B. Altstadt' : 'e.g. Old Town'} onCommit={value => setAddress({ district: value })} /></label>
            <label className="ed-toggle is-wide">
              <input type="checkbox" checked={listing.address.showExactAddress} onChange={event => setAddress({ showExactAddress: event.target.checked })} />
              <span><b>{text.editor.showExact}</b><small>{text.editor.showExactHint}</small></span>
            </label>
          </div> : <>
            {listing.geo ? <div className="listing-map"><MarketMap listings={[summary]} locale={locale} center={[listing.geo.lat, listing.geo.lon]} zoom={15} activeId={listing.id} single /></div> : null}
            <p className="listing-location-note">{addressLine || place}{listing.geo?.precision === 'postcode' || !listing.address.showExactAddress ? <><br /><small>{text.listing.approximate}</small></> : null}</p>
          </>}
        </section>
      </article>

      <aside className="listing-side">
        {edit ? edit.sidebar : <ListingSidebar listing={listing} locale={locale} title={title} pageUrl={pageUrl} />}
      </aside>
    </div>
  </div>;
}

function ListingSidebar({ listing, locale, title, pageUrl }: { listing: Listing; locale: Locale; title: string; pageUrl: string }) {
  const text = marketCopy[locale];
  const facts = listing.facts;
  const absolute = `https://reviewahouse.com${pageUrl}`;
  const mail = `mailto:${listing.contact.email}?subject=${encodeURIComponent(text.listing.emailSubject(title))}&body=${encodeURIComponent(text.listing.emailBody(absolute))}`;
  const city = listing.market ? MARKET_CITIES[listing.market] : null;
  return <div className="listing-side-stack">
    <section className="listing-card is-price">
      <p className="listing-side-price">{priceLabel(facts.price, locale)}</p>
      {listing.propertyType !== 'land' && facts.area ? <p className="listing-side-sqm">{pricePerSqmLabel(facts.price, facts.area, locale)}</p> : null}
      <h2 className="listing-side-label">{text.listing.contact}</h2>
      {listing.origin === 'imported' && listing.sourceUrl ? <>
        <a className="market-button is-block" href={listing.sourceUrl} target="_blank" rel="noreferrer">{text.listing.viaPortal(listing.sourceName || 'portal')} ↗</a>
        <p className="listing-side-note">{text.listing.importedNote(listing.sourceName || 'portal')}</p>
      </> : <>
        {listing.contact.name ? <p className="listing-seller">{listing.contact.name} · <span>{text.card.privateSeller}</span></p> : null}
        <div className="listing-contact-actions">
          {listing.contact.email ? <a className="market-button is-block" href={mail}>{text.listing.email}</a> : null}
          {listing.contact.phone ? <a className="market-button is-block is-quiet" href={`tel:${listing.contact.phone.replace(/[^\d+]/g, '')}`}>{text.listing.call} · {listing.contact.phone}</a> : null}
        </div>
      </>}
    </section>

    <section className="listing-card is-review">
      <h2 className="listing-side-label">{text.listing.reviewTitle}</h2>
      {listing.reportId ? <>
        {typeof listing.score === 'number' ? <p className={`listing-score is-${scoreTone(listing.score)}`}><b>{listing.score.toFixed(1).replace('.', locale === 'de' ? ',' : '.')}</b><span>{text.listing.out}</span></p> : null}
        <p className="listing-side-note">{text.listing.reviewText}</p>
        <Link className="market-button is-block is-quiet" href={localePath(locale, `/r/${listing.reportId}`)}>{text.listing.reviewOpen} <span className="market-free">{text.listing.reviewFree}</span></Link>
      </> : <p className="listing-side-note">{text.listing.reviewPending}</p>}
    </section>

    <section className="listing-card">
      <h2 className="listing-side-label">{text.listing.share}</h2>
      <ShareLinks url={pageUrl} title={title} locale={locale} compact />
    </section>

    {city ? <Link className="listing-back" href={localePath(locale, `/buy/${city.slug}`)}>← {text.listing.backToCity(city.name[locale])}</Link> : null}
    {listing.status === 'published' ? <ReportListing listingId={listing.id} locale={locale} /> : null}
  </div>;
}
