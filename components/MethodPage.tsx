import { SiteNav } from './SiteNav';
import { SiteFooter } from './SiteFooter';
import { GlossaryText } from './GlossaryText';
import { methodCopy } from '@/lib/method-copy';
import type { Locale } from '@/lib/i18n';

export function MethodPage({ locale }: { locale: Locale }) {
  const page = methodCopy(locale);
  return <main className="guide-shell" lang={locale}>
    <SiteNav locale={locale} />
    <article className="guide-article">
      <header>
        <p className="eyebrow">{page.kicker}</p>
        <h1>{page.title}</h1>
        <p className="guide-dek">{page.dek}</p>
      </header>
      <div className="guide-body">
        {page.sections.map((section, index) => <section key={section.heading}>
          <span className="guide-section-number">{String(index + 1).padStart(2, '0')}</span>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph}><GlossaryText locale={locale}>{paragraph}</GlossaryText></p>)}
        </section>)}
      </div>
      <footer className="guide-sources">
        <p className="eyebrow">{page.sourcesLabel}</p>
        <ul>{page.sources.map((source) => <li key={source.href}><a href={source.href} target="_blank" rel="noreferrer">{source.label} ↗</a></li>)}</ul>
      </footer>
    </article>
    <SiteFooter locale={locale} />
  </main>;
}
