import Link from 'next/link';
import { localePath, type Locale } from '@/lib/i18n';
import { marketCopy } from '@/lib/market/copy';
import { MarketNav } from './MarketNav';
import { SiteFooter } from '../SiteFooter';

type Item = { title: string; text: string; href?: string };

const ROADMAP: Record<Locale, { now: Item[]; next: Item[]; later: Item[] }> = {
  en: {
    now: [
      { title: 'Search Berlin, Munich and Cologne', text: 'List and map side by side, filters that stay in the link, two homes compared at a time.', href: '/buy' },
      { title: 'Independent review on every listing', text: 'Price check against official sales data, location, energy and running costs. Free on listings here; external links count towards the daily report allowance.' },
      { title: 'Sell privately in minutes', text: 'Photos and documents in, a clean listing out, edited on the page and shared with one link.', href: '/sell' },
      { title: 'Direct contact', text: 'Buyers write or call the seller directly. No middleman and no fee.' },
    ],
    next: [
      { title: 'Messages between buyers and sellers', text: 'An inbox on the site, so sellers do not have to publish an email address or phone number.' },
      { title: 'Seller accounts', text: 'Every listing in one place, signed in with the email link, without keeping private edit links.' },
      { title: 'Saved searches and alerts', text: 'A short email when a new home matches your filters.' },
      { title: 'Viewing slots', text: 'Sellers offer times; buyers book one without back-and-forth.' },
      { title: 'Promoted listings', text: 'Optional featured placement in a city list. The only paid part for sellers.' },
      { title: 'More cities', text: 'Hamburg, Frankfurt, Düsseldorf and Leipzig next, once official price data is in place.' },
    ],
    later: [
      { title: 'Offer and negotiation support', text: 'A clear offer letter, the documents to request, and a checklist up to the notary.' },
      { title: 'Financing', text: 'Live rates, affordability, and a link to brokers who compare banks.' },
      { title: 'Due diligence', text: 'WEG minutes, Teilungserklärung and energy certificate read for the questions that matter.' },
      { title: 'Notary and handover', text: 'Contract draft review, deadlines, and the handover protocol.' },
      { title: 'Renovation planning', text: 'Rough costs per room, subsidies (KfW, BAFA), and vetted trades.' },
    ],
  },
  de: {
    now: [
      { title: 'Suche in Berlin, München und Köln', text: 'Liste und Karte nebeneinander, Filter im Link, zwei Angebote im direkten Vergleich.', href: '/buy' },
      { title: 'Unabhängige Prüfung bei jedem Inserat', text: 'Preisvergleich mit amtlichen Kaufpreisen, Lage, Energie und laufende Kosten. Für Inserate hier kostenlos; externe Links zählen zum täglichen Berichtskontingent.' },
      { title: 'Privat verkaufen in Minuten', text: 'Fotos und Unterlagen rein, ein klares Inserat raus, direkt auf der Seite bearbeitet und mit einem Link geteilt.', href: '/sell' },
      { title: 'Direkter Kontakt', text: 'Käufer schreiben oder rufen den Verkäufer direkt an. Ohne Vermittler und ohne Gebühr.' },
    ],
    next: [
      { title: 'Nachrichten zwischen Käufern und Verkäufern', text: 'Ein Postfach auf der Seite, damit Verkäufer weder E-Mail noch Telefonnummer veröffentlichen müssen.' },
      { title: 'Verkäuferkonto', text: 'Alle Inserate an einem Ort, Anmeldung per E-Mail-Link, ohne private Bearbeitungslinks.' },
      { title: 'Gespeicherte Suchen', text: 'Eine kurze E-Mail, wenn ein neues Angebot zu deinen Filtern passt.' },
      { title: 'Besichtigungstermine', text: 'Verkäufer bieten Zeiten an, Käufer buchen ohne Hin und Her.' },
      { title: 'Hervorgehobene Inserate', text: 'Optional eine hervorgehobene Platzierung in der Stadtliste. Der einzige kostenpflichtige Teil für Verkäufer.' },
      { title: 'Weitere Städte', text: 'Hamburg, Frankfurt, Düsseldorf und Leipzig als Nächstes, sobald amtliche Preisdaten vorliegen.' },
    ],
    later: [
      { title: 'Angebot und Verhandlung', text: 'Ein klares Kaufangebot, die anzufordernden Unterlagen und eine Checkliste bis zum Notar.' },
      { title: 'Finanzierung', text: 'Aktuelle Zinsen, Leistbarkeit und ein Weg zu Vermittlern, die Banken vergleichen.' },
      { title: 'Unterlagen prüfen', text: 'WEG-Protokolle, Teilungserklärung und Energieausweis auf die wichtigen Fragen gelesen.' },
      { title: 'Notar und Übergabe', text: 'Vertragsentwurf, Fristen und Übergabeprotokoll.' },
      { title: 'Renovierung planen', text: 'Grobe Kosten pro Raum, Förderungen (KfW, BAFA) und geprüfte Handwerker.' },
    ],
  },
};

export function RoadmapPage({ locale }: { locale: Locale }) {
  const text = marketCopy[locale];
  const plan = ROADMAP[locale];
  const column = (label: string, items: Item[], tone: string) => <section className={`roadmap-column is-${tone}`}>
    <h2>{label}</h2>
    <ul>{items.map(item => <li key={item.title}>
      <h3>{item.href ? <Link href={localePath(locale, item.href)}>{item.title}</Link> : item.title}</h3>
      <p>{item.text}</p>
    </li>)}</ul>
  </section>;
  return <div className="market-page">
    <MarketNav locale={locale} />
    <main className="roadmap">
      <header className="market-hero">
        <p className="market-eyebrow">Roadmap</p>
        <h1>{text.roadmap.title}</h1>
        <p className="market-lede">{text.roadmap.lede}</p>
      </header>
      <div className="roadmap-grid">
        {column(text.roadmap.now, plan.now, 'now')}
        {column(text.roadmap.next, plan.next, 'next')}
        {column(text.roadmap.later, plan.later, 'later')}
      </div>
    </main>
    <SiteFooter locale={locale} />
  </div>;
}
