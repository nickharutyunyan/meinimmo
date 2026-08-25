import Link from 'next/link';
import { AdSlot } from './AdSlot';
import { SiteNav } from './SiteNav';
import { guideArticles, guideCopy } from '../lib/guide';
import { localePath, type Locale } from '../lib/i18n';
import { SiteFooter } from './SiteFooter';
import { GlossaryText } from './GlossaryText';

export default function GuideIndex({ locale }: { locale: Locale }) {
  const de = locale === 'de';
  return <main className="guide-shell">
    <SiteNav locale={locale} />
    <header className="guide-index-head">
      <p className="eyebrow">{de ? 'FELDNOTIZEN FÜR DIE HAUSSUCHE' : 'FIELD NOTES FOR THE HOUSE HUNT'}</p>
      <h1>{de ? 'Guide' : 'The Guide'}</h1>
      <p>{de
        ? 'Notizen für den nächsten freien Samstag: Straßen zum Ablaufen, ehrliche Kiezchecks und Orte für einen Kaffee danach. Mit Quellen—aber geschrieben wie eine Nachricht von jemandem, der wirklich will, dass du gut ankommst.'
        : 'Notes for your next free Saturday: streets to walk, honest neighborhood checks and somewhere good for coffee afterwards. Sourced, but written like a message from someone who genuinely wants you to land well.'}</p>
    </header>
    <section className="guide-list">
      {guideArticles.map((article, index) => {
        const copy = guideCopy(article, locale);
        return <article className={`guide-teaser guide-accent-${article.accent}`} key={article.slug}>
          <div className="guide-teaser-number">0{index + 1}</div>
          <div>
            <p className="eyebrow">{copy.kicker}</p>
            <h2><Link href={localePath(locale, `/guide/${article.slug}`)}>{copy.title}</Link></h2>
            <p><GlossaryText>{copy.dek}</GlossaryText></p>
            <Link className="guide-read" href={localePath(locale, `/guide/${article.slug}`)}>
              {de ? 'Artikel lesen' : 'Read the story'} <span>↗</span>
            </Link>
          </div>
          <div className="guide-card-placeholder" aria-label={de ? 'Platzhalter für ein späteres Foto' : 'Placeholder for a future photograph'}>
            <span>{de ? 'FOTO FOLGT' : 'PHOTO TO COME'}</span>
            <small>{copy.photoLabel}</small>
          </div>
        </article>;
      })}
    </section>
    <AdSlot locale={locale} kind="local" />
    <SiteFooter locale={locale} />
  </main>;
}
