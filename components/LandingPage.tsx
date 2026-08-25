'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdSlot } from './AdSlot';
import { SiteNav } from './SiteNav';
import { copy, localePath, type Locale } from '@/lib/i18n';
import { QuotaModal } from './QuotaModal';
import { SiteFooter } from './SiteFooter';
import { GlossaryText } from './GlossaryText';

export function LandingPage({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [dayPassEligible, setDayPassEligible] = useState(false);
  const text = copy[locale].home;

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('daypass') === '1') setQuotaOpen(true);
    fetch('/api/auth/me').then(async (response) => await response.json() as { access?: { kind: string; remaining: number } }).then((data) => {
      setDayPassEligible(data.access?.kind === 'free' && data.access.remaining === 0);
    }).catch(() => undefined);
  }, []);

  async function assess(payload: object) {
    const response = await fetch('/api/assess', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, locale }) });
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
    setStatus(text.readingPdf);
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.394/pdf.worker.min.mjs';
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      let content = '';
      for (let page = 1; page <= pdf.numPages; page += 1) {
        const pageContent = await pdf.getPage(page).then((item) => item.getTextContent());
        content += pageContent.items.map((item) => ('str' in item ? item.str : '')).join(' ') + '\n';
      }
      if (content.trim().length < 150) {
        setStatus(text.scannedPdf);
        return;
      }
      await assess({ text: content, name: file.name });
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
        <div className="upload-row"><span>{text.or}</span><label>{text.upload} <input onChange={upload} accept="application/pdf" type="file"/></label></div>
        {status ? <p className={isReading ? 'hint' : 'error'}>{status}</p> : null}
        {dayPassEligible ? <div className="day-pass-inline">
          <div><span>{locale === 'de' ? 'EINMALIG · KEIN ABO' : 'ONE-OFF · NO SUBSCRIPTION'}</span><strong>{locale === 'de' ? 'Heute weitersuchen?' : 'Keep searching today?'}</strong><p>{locale === 'de' ? '50 Berichte für 24 Stunden.' : '50 reports for the next 24 hours.'}</p></div>
          <button type="button" onClick={() => setQuotaOpen(true)}>{locale === 'de' ? 'Tagespass für 5 €' : '€5 day pass'}</button>
        </div> : null}
      </div>
    </section>
    <section id="how" className="approach-head"><p className="eyebrow">{text.approachLabel}</p><h2>{text.approachTitle}</h2></section>
    <section className="steps">{text.steps.map(([title, description], index) => <div key={title}><b>{String(index + 1).padStart(2, '0')}</b><h2>{title}</h2><p><GlossaryText>{description}</GlossaryText></p></div>)}</section>
    <AdSlot locale={locale} kind="finance" />
    <section id="faq" className="faq-section">
      <div className="faq-intro"><p className="eyebrow">{text.faqLabel}</p><h2>{text.faqTitle}</h2><p>{text.faqIntro}</p></div>
      <div className="faq-list">{text.faqs.map(([question, answer], index) => <details key={question} open={index === 0}><summary><span>{String(index + 1).padStart(2, '0')}</span>{question}</summary><p><GlossaryText>{answer}</GlossaryText></p></details>)}</div>
    </section>
    <QuotaModal open={quotaOpen} locale={locale} onClose={() => {
      setQuotaOpen(false);
      if (new URLSearchParams(window.location.search).has('daypass')) history.replaceState(null, '', window.location.pathname);
    }} />
    <SiteFooter locale={locale} />
  </main>;
}
