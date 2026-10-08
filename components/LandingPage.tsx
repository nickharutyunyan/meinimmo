'use client';

import { ChangeEvent, FormEvent, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AdSlot } from './AdSlot';
import { SiteNav } from './SiteNav';
import { homePresentation, localePath, type Locale } from '@/lib/i18n';
import { QuotaModal } from './QuotaModal';
import { SiteFooter } from './SiteFooter';
import { GlossaryText } from './GlossaryText';
import { canOfferDayPass, type DayPassAccess } from '@/lib/day-pass';
import { MAX_PDF_BYTES } from '@/lib/pdf-source';
import { requestJson, shownRequestError } from '@/lib/client-request';
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
const loadPdfJs = () => pdfJsPromise ||= importPdfJs().catch(error => { pdfJsPromise = undefined; throw error; });

export async function extractPdfText(file: File) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  try {
    if (pdf.numPages > 150) throw new Error('pdf_too_long');

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
      if (pages.reduce((length, text) => length + text.length, 0) > 200_000) throw new Error('pdf_too_long');
    }

    return pages.join('\n');
  } finally { await pdf.destroy(); }
}

export function LandingPage({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [listingText, setListingText] = useState('');
  const [status, setStatus] = useState('');
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [dayPassEligible, setDayPassEligible] = useState(false);
  const [dayPassBillingAvailable, setDayPassBillingAvailable] = useState(false);
  const [paidPlansOffered, setPaidPlansOffered] = useState(false);
  const text = homePresentation(locale, paidPlansOffered);

  useEffect(() => {
    const requestedDayPass = new URLSearchParams(window.location.search).get('daypass') === '1';
    fetch('/api/auth/me', { cache: 'no-store' }).then(async (response) => await response.json() as { access?: DayPassAccess; paidPlansEnabled?: boolean; dayPassBillingAvailable?: boolean }).then((data) => {
      const purchasesOpen = Boolean(data.dayPassBillingAvailable);
      setPaidPlansOffered(Boolean(data.paidPlansEnabled));
      setDayPassBillingAvailable(purchasesOpen);
      const eligible = canOfferDayPass(data.access) && purchasesOpen;
      setDayPassEligible(eligible);
      if (requestedDayPass && eligible) setQuotaOpen(true);
      if (requestedDayPass && !eligible) history.replaceState(null, '', window.location.pathname);
    }).catch(() => undefined);
  }, []);

  async function assess(payload: object | FormData) {
    const formData = payload instanceof FormData ? payload : null;
    if (formData) formData.set('locale', locale);
    const { response, data } = await requestJson<{ error?: string; id?: string; code?: string }>('/api/assess', {
      method: 'POST',
      ...(formData ? { body: formData } : { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, locale }) }),
    });
    if (!response.ok || !data.id) {
      if (data.code === 'quota_exceeded') {
        setStatus('');
        if (dayPassBillingAvailable) {
          setDayPassEligible(true);
          setQuotaOpen(true);
        } else {
          setStatus(locale === 'de' ? 'Das Tageslimit für Berichte ist erreicht.' : 'Today’s report limit is reached.');
        }
        return;
      }
      throw new Error(data.error || text.genericError);
    }
    router.push(localePath(locale, `/r/${data.id}`));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setStatus(text.readingListing);
    try {
      await assess(pasteOpen ? { text: listingText, name: locale === 'de' ? 'Eingefügtes Immobilienangebot' : 'Pasted property listing' } : { url });
    } catch (error) {
      const fallback = locale === 'de' ? 'Die Verbindung ist fehlgeschlagen oder hat zu lange gedauert. Versuche es erneut. Deine Eingabe bleibt erhalten.' : 'The connection failed or took too long. Please try again. Your input has been kept.';
      setStatus(shownRequestError(error instanceof Error ? error.message : undefined, fallback));
    } finally { inFlight.current = false; setBusy(false); }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || inFlight.current) return;
    if (file.size > MAX_PDF_BYTES) {
      setStatus(locale === 'de' ? 'Das PDF darf höchstens 15 MB groß sein.' : 'The PDF must be 15 MB or smaller.');
      event.target.value = '';
      return;
    }
    inFlight.current = true; setBusy(true);
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
    } catch (error) {
      setStatus(error instanceof Error && error.message === 'pdf_too_long'
        ? (locale === 'de' ? 'Bitte lade ein kürzeres Exposé mit höchstens 150 Seiten und 200.000 Textzeichen hoch.' : 'Upload a shorter Exposé: at most 150 pages and 200,000 text characters.')
        : error instanceof Error && !/fetch|network|request_timeout|json|unexpected|invalid pdf|password|pdf structure/i.test(error.message) ? error.message : text.pdfError);
    } finally { inFlight.current = false; setBusy(false); event.target.value = ''; }
  }

  const isReading = status === text.readingListing || status === text.readingPdf;

  return <main className="landing" lang={locale}>
    <SiteNav locale={locale} landing />
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow">{text.audience}</p><h1>{text.headline}<br/><em>{text.emphasis}</em></h1></div>
      <div className="intake-panel" id="start">
        <p className="eyebrow">{text.start}</p>
        <form onSubmit={submit} className="intake"><label><span>↗</span><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={text.input} aria-label={text.input} type="url" required={!pasteOpen} disabled={busy}/></label><button disabled={busy}>{busy ? text.readingListing : text.assess}</button></form>
        <div className="upload-row"><span>{text.or}</span><label onPointerEnter={() => void loadPdfJs().catch(() => undefined)} onFocus={() => void loadPdfJs().catch(() => undefined)}>{text.upload} <input onChange={upload} accept="application/pdf" type="file" aria-label={text.upload} disabled={busy}/></label></div>
        <button type="button" className="text-button" disabled={busy} aria-expanded={pasteOpen} onClick={() => setPasteOpen(!pasteOpen)}>{locale === 'de' ? 'Angebotstext einfügen' : 'Paste listing text'}</button>
        {pasteOpen ? <label className="paste-listing">{locale === 'de' ? 'Vollständiger Angebotstext' : 'Full listing text'}<textarea value={listingText} onChange={event => setListingText(event.target.value)} rows={8} maxLength={200000} disabled={busy}/><small>{locale === 'de' ? 'Kopiere Preis, Lage, Beschreibung und alle Objektdaten. Der Link ist dann optional.' : 'Copy the price, location, description and all property details. The URL is optional when pasting text.'}</small></label> : null}
        {status ? <p role={busy ? 'status' : 'alert'} className={isReading ? 'hint' : 'error'}>{status}</p> : null}
        {dayPassEligible ? <div className="day-pass-inline">
          <div><span>{locale === 'de' ? 'EINMALIG · KEIN ABO' : 'ONE-OFF · NO SUBSCRIPTION'}</span><strong>{locale === 'de' ? 'Heute weitersuchen?' : 'Keep searching today?'}</strong><p>{locale === 'de' ? '50 Berichte für 24 Stunden.' : '50 reports for the next 24 hours.'}</p></div>
          <button type="button" onClick={() => setQuotaOpen(true)}>{locale === 'de' ? 'Tagespass für 5 €' : '€5 day pass'}</button>
        </div> : null}
      </div>
    </section>
    <section id="how" className="how">
      <div className="how-head">
        <div><p className="eyebrow">{text.approachLabel}</p><h2>{text.approachTitle}</h2></div>
        <p><GlossaryText locale={locale}>{text.approachIntro}</GlossaryText></p>
      </div>
      <ol className="how-steps">{text.steps.map(([kicker, title, description], index) => <li key={title}><div className="how-kicker"><span>{String(index + 1).padStart(2, '0')}</span><b>{kicker}</b></div><h3>{title}</h3><p><GlossaryText locale={locale}>{description}</GlossaryText></p></li>)}</ol>
      <div className="how-report">
        <p className="eyebrow">{text.reportLabel}</p>
        <dl className="how-points">{text.reportPoints.map(([label, detail]) => <div key={label}><dt><GlossaryText locale={locale}>{label}</GlossaryText></dt><dd><GlossaryText locale={locale}>{detail}</GlossaryText></dd></div>)}</dl>
      </div>
      <div className="how-cta"><p><strong>{text.approachFree}</strong> {text.approachFreeNote}</p><a href="#start">{text.approachCta}</a></div>
    </section>
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
