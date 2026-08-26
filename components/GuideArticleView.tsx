import Link from 'next/link';
import { SiteNav } from './SiteNav';
import { AdSlot } from './AdSlot';
import type { GuideArticle } from '../lib/guide';
import { guideCopy } from '../lib/guide';
import { localePath, type Locale } from '../lib/i18n';
import { SiteFooter } from './SiteFooter';
import { GlossaryText } from './GlossaryText';

function osmEmbed(lat: number, lon: number) {
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.015}%2C${lat - 0.009}%2C${lon + 0.015}%2C${lat + 0.009}&layer=mapnik&marker=${lat}%2C${lon}`;
}

function googleMapsUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function sourceLabel(label: string, locale: Locale) {
  if (locale === 'en') return label;
  const translations: Record<string, string> = {
    'Destatis house-price index': 'Destatis: Häuserpreisindex',
    'City of Erfurt: rail connections': 'Stadt Erfurt: Bahnverbindungen',
    'City of Erfurt: ICE City development': 'Stadt Erfurt: Entwicklung ICE City',
    'Deutsche Bahn: ICE Sprinter network': 'Deutsche Bahn: ICE-Sprinter-Netz',
    'Zughafen Erfurt': 'Zughafen Erfurt',
    'Franz Mehlhose Erfurt': 'Franz Mehlhose Erfurt',
    'Berlin: Prenzlauer Berg family neighborhoods': 'Berlin: Familienkieze in Prenzlauer Berg',
    'Friedenau district profile': 'Bezirksprofil Friedenau',
    'Seepark playground reopening': 'Wiedereröffnung Spielplatz Seepark',
    'Berlin school directory: Seepark primary school': 'Berliner Schulverzeichnis: Seepark-Grundschule',
    'Lula am Markt': 'Lula am Markt',
    'Café TreBo': 'Café TreBo',
    'Berlin: Kantstraße neighborhood walk': 'Berlin: Kiezspaziergang Kantstraße',
    'Berlin: Kantstraße food scene': 'Berlin: Gastroszene Kantstraße',
    'Schwarzes Café': 'Schwarzes Café',
    'Munich Kunstareal': 'Münchner Kunstareal',
    'Türkentor': 'Türkentor',
    'Café Puck': 'Café Puck',
    'Hamburg: Sternschanze portrait': 'Hamburg: Porträt Sternschanze',
    'Rote Flora': 'Rote Flora',
    'elbgold Schanze': 'elbgold Schanze',
    'Blattgold': 'Blattgold',
    'Cologne Tourism: Körnerstraße': 'KölnTourismus: Körnerstraße',
    'Van Dyck Ehrenfeld': 'Van Dyck Ehrenfeld',
    'Café Sehnsucht': 'Café Sehnsucht',
    'Frankfurt Tourism: Braubachstraße': 'Frankfurt Tourismus: Braubachstraße',
    'IIMORI Pâtisserie': 'IIMORI Pâtisserie',
    'MUSEUM MMK visitor information': 'MUSEUM MMK: Besuchsinformationen',
  };
  return translations[label] || label;
}

export default function GuideArticleView({ article, locale }: { article: GuideArticle; locale: Locale }) {
  const copy = guideCopy(article, locale);
  const de = locale === 'de';
  const articleUrl = `https://reviewahouse.com${localePath(locale, `/guide/${article.slug}`)}`;
  const structuredData = {
    '@context': 'https://schema.org', '@type': 'Article', headline: copy.title, description: copy.dek,
    datePublished: article.published, dateModified: article.published, inLanguage: locale, mainEntityOfPage: articleUrl,
    author: { '@type': 'Organization', name: 'Review a House', url: 'https://reviewahouse.com' },
    publisher: { '@type': 'Organization', name: 'Review a House', url: 'https://reviewahouse.com' },
  };
  return <main className="guide-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <SiteNav locale={locale} />
    <article className="guide-article">
      <div className="guide-back"><Link href={localePath(locale, '/guide')}>← {de ? 'Alle Guides' : 'All guides'}</Link></div>
      <header>
        <p className="eyebrow">{copy.kicker}</p>
        <h1>{copy.title}</h1>
        <p className="guide-dek">{copy.dek}</p>
        <div className="guide-byline"><span>{de ? 'Von Review a House' : 'By Review a House'}</span><span>{copy.readTime}</span><time dateTime={article.published}>{de ? '24. August 2026' : '24 August 2026'}</time></div>
      </header>
      <figure className={`guide-hero-placeholder guide-accent-${article.accent}`}>
        <span>{de ? 'PLATZ FÜR DEIN FOTO' : 'PLACE FOR YOUR PHOTOGRAPH'}</span>
        <figcaption>{copy.photoLabel}</figcaption>
      </figure>
      <div className="guide-body">
        {copy.sections.map((section, index) => <section key={section.heading}>
          <span className="guide-section-number">{String(index + 1).padStart(2, '0')}</span>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph}><GlossaryText locale={locale}>{paragraph}</GlossaryText></p>)}
          {section.googleMaps && !section.map && <a className="guide-street-link" href={googleMapsUrl(section.googleMaps.query)} target="_blank" rel="noreferrer">
            <span aria-hidden="true">⌖</span> {section.googleMaps.label} <b aria-hidden="true">↗</b>
          </a>}
          {section.stops && <div className="guide-stop-list" aria-label={de ? 'Empfohlene Stopps' : 'Recommended stops'}>
            {section.stops.map((place) => <a href={googleMapsUrl(place.query || place.name)} target="_blank" rel="noreferrer" key={place.name}>
              <strong>{place.name} <span aria-hidden="true">↗</span></strong><small><GlossaryText locale={locale}>{place.detail}</GlossaryText></small>
            </a>)}
          </div>}
          {section.map && <div className="guide-map-block">
            <div className="guide-map-frame"><iframe title={section.map.label} loading="lazy" src={osmEmbed(section.map.lat, section.map.lon)} /></div>
            <div className="guide-map-notes">
              <p className="eyebrow">{de ? 'ORTE AUF DER KARTE' : 'PLACES ON THE MAP'}</p>
              <h3>{section.map.label}</h3>
              {section.map.places.map((place) => <div key={place.name}><a className="guide-place-link" href={googleMapsUrl(place.query || `${place.name}, ${section.map!.query}`)} target="_blank" rel="noreferrer">{place.name} <span aria-hidden="true">↗</span></a><p><GlossaryText locale={locale}>{place.detail}</GlossaryText></p></div>)}
              <div className="guide-map-links">
                <a href={googleMapsUrl(section.googleMaps?.query || section.map.query)} target="_blank" rel="noreferrer">{section.googleMaps?.label || (de ? 'In Google Maps öffnen' : 'Open in Google Maps')} <span aria-hidden="true">↗</span></a>
                <a href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(section.map.query)}`} target="_blank" rel="noreferrer">{de ? 'OpenStreetMap öffnen' : 'OpenStreetMap'} <span aria-hidden="true">↗</span></a>
              </div>
            </div>
          </div>}
          {index === 0 && <AdSlot locale={locale} kind="finance" />}
        </section>)}
      </div>
      <footer className="guide-sources">
        <p className="eyebrow">{de ? 'QUELLEN & WEITERLESEN' : 'SOURCES & FURTHER READING'}</p>
        <p>{de
          ? 'Wir verlinken die Stellen, auf denen die überprüfbaren Angaben basieren. Preise, Fahrpläne und Angebote können sich ändern — vor einer Kaufentscheidung bitte noch einmal aktuell prüfen.'
          : 'These are the pages behind the checkable claims. Prices, timetables and local services change; verify the current position before making a buying decision.'}</p>
        <ul>{copy.sources.map((source) => <li key={source.href}><a href={source.href} target="_blank" rel="noreferrer">{sourceLabel(source.label, locale)} ↗</a></li>)}</ul>
      </footer>
    </article>
    <SiteFooter locale={locale} />
  </main>;
}
