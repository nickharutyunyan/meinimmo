'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdSlot } from './AdSlot';
import { SiteNav } from './SiteNav';
import { copy, localePath, type Locale } from '@/lib/i18n';
import { QuotaModal } from './QuotaModal';
import { SiteFooter } from './SiteFooter';
import { GlossaryText } from './GlossaryText';
import { canOfferDayPass, type DayPassAccess } from '@/lib/day-pass';
import { MAX_PDF_BYTES } from '@/lib/pdf-source';
import { pdfTextFromItems } from '@/lib/pdf-text';

const PDF_PAGE_BATCH_SIZE = 4;

const importPdfJs = () => import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
  // Keep the worker on ReviewAHouse's own CDN. The previous third-party CDN
  // request made a cold PDF upload depend on another origin before parsing
  // could even start.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  return pdfjs;
});

let pdfJsPromise: ReturnType<typeof importPdfJs> | undefined;
const loadPdfJs = () => pdfJsPromise ||= importPdfJs();

async function extractPdfText(file: File) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];

  // Text extraction is independent per page. Small batches cut multi-page
  // Exposes from a serial waterfall without creating excessive worker load for
  // unusually long documents.
  for (let firstPage = 1; firstPage <= pdf.numPages; firstPage += PDF_PAGE_BATCH_SIZE) {
    const lastPage = Math.min(pdf.numPages, firstPage + PDF_PAGE_BATCH_SIZE - 1);
    const batch = await Promise.all(Array.from(
      { length: lastPage - firstPage + 1 },
      async (_, offset) => {
        const page = await pdf.getPage(firstPage + offset);
        return pdfTextFromItems((await page.getTextContent()).items);
      },
    ));
    pages.push(...batch);
  }

  return pages.join('\n');
}

export function LandingPage({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [dayPassEligible, setDayPassEligible] = useState(false);
  const text = copy[locale].home;

  useEffect(() => {
    const requestedDayPass = new URLSearchParams(window.location.search).get('daypass') === '1';
    fetch('/api/auth/me', { cache: 'no-store' }).then(async (response) => await response.json() as { access?: DayPassAccess }).then((data) => {
      const eligible = canOfferDayPass(data.access);
      setDayPassEligible(eligible);
      if (requestedDayPass && eligible) setQuotaOpen(true);
      if (requestedDayPass && !eligible) history.replaceState(null, '', window.location.pathname);
    }).catch(() => undefined);
  }, []);

  async function assess(payload: object | FormData) {
    const formData = payload instanceof FormData ? payload : null;
    if (formData) formData.set('locale', locale);
    const response = await fetch('/api/assess', {
      method: 'POST',
      ...(formData ? { body: formData } : { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, locale }) }),
    });
    const data = await response.json() as { error?: string; id?: string; code?: string };
    if (!response.ok || !data.id) {
      if (data.code === 'quota_exceeded') {
        setStatus('');
        setDayPassEligible(true);
        setQuotaOpen(true);
        return;
      }
      setStatus(data.error || text.genericError);
      return;
    }
    router.push(localePath(locale, `/r/${data.id}`));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus(text.readingListing);
    await assess({ url });
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PDF_BYTES) {
      setStatus(locale === 'de' ? 'Das PDF darf höchstens 15 MB groß sein.' : 'The PDF must be 15 MB or smaller.');
      return;
    }
    setStatus(text.readingPdf);
    try {
      const content = await extractPdfText(file);
      if (content.trim().length < 150) {
        setStatus(text.scannedPdf);
        return;
      }
      const payload = new FormData();
      payload.set('text', content);
      payload.set('name', file.name);
      payload.set('file', file, file.name);
      await assess(payload);
    } catch {
      setStatus(text.pdfError);
    }
  }

  const isReading = status === text.readingListing || status === text.readingPdf;

  return <main className="landing" lang={locale}>
    <SiteNav locale={locale} landing />
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow">{text.audience}</p><h1>{text.headline}<br/><em>{text.emphasis}</em></h1></div>
      <div className="intake-panel">
        <p className="eyebrow">{text.start}</p>
        <form onSubmit={submit} className="intake"><label><span>↗</span><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={text.input} type="url" required/></label><button>{text.assess}</button></form>
        <div className="upload-row"><span>{text.or}</span><label onPointerEnter={() => void loadPdfJs()} onFocus={() => void loadPdfJs()}>{text.upload} <input onChange={upload} accept="application/pdf" type="file"/></label></div>
        {status ? <p className={isReading ? 'hint' : 'error'}>{status}</p> : null}
        {dayPassEligible ? <div className="day-pass-inline">
          <div><span>{locale === 'de' ? 'EINMALIG · KEIN ABO' : 'ONE-OFF · NO SUBSCRIPTION'}</span><strong>{locale === 'de' ? 'Heute weitersuchen?' : 'Keep searching today?'}</strong><p>{locale === 'de' ? '50 Berichte für 24 Stunden.' : '50 reports for the next 24 hours.'}</p></div>
          <button type="button" onClick={() => setQuotaOpen(true)}>{locale === 'de' ? 'Tagespass für 5 €' : '€5 day pass'}</button>
        </div> : null}
      </div>
    </section>
    <section id="how" className="approach-head"><p className="eyebrow">{text.approachLabel}</p><div><h2>{text.approachTitle}</h2><p>{text.approachIntro}</p></div></section>
    <section className="approach-grid">{text.steps.map(([kicker, title, description], index) => <article key={title}><div className="approach-meta"><span>{String(index + 1).padStart(2, '0')}</span><b>{kicker}</b></div><h3>{title}</h3><p><GlossaryText locale={locale}>{description}</GlossaryText></p></article>)}</section>
    <AdSlot locale={locale} kind="finance" />
    <section id="faq" className="faq-section">
      <div className="faq-intro"><p className="eyebrow">{text.faqLabel}</p><h2>{text.faqTitle}</h2><p>{text.faqIntro}</p></div>
      <div className="faq-list">{text.faqs.map(([question, answer], index) => <details key={question} open={index === 0}><summary><span>{String(index + 1).padStart(2, '0')}</span>{question}</summary><p><GlossaryText locale={locale}>{answer}</GlossaryText></p></details>)}</div>
    </section>
    <QuotaModal open={quotaOpen} locale={locale} onClose={() => {
      setQuotaOpen(false);
      if (new URLSearchParams(window.location.search).has('daypass')) history.replaceState(null, '', window.location.pathname);
    }} />
    <SiteFooter locale={locale} />
  </main>;
}
