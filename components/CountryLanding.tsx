'use client';
import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { requestJson } from '@/lib/client-request';
import { countries, type CountryCode } from '@/lib/countries';
import { SiteNav } from './SiteNav';
import { SiteFooter } from './SiteFooter';
import { Sidebar } from './Sidebar';
import { extractPdfText } from './LandingPage';
import { MAX_PDF_BYTES } from '@/lib/pdf-source';
import { listAmUrl } from '@/lib/list-am';
import { browserHelper } from '@/lib/browser-helper';

export function CountryLanding({ country }: { country: Exclude<CountryCode, 'DE'> }) {
  const market = countries[country]; const router = useRouter();
  const [url, setUrl] = useState(''); const [text, setText] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [helperReady, setHelperReady] = useState(false);
  const inFlight = useRef(false);
  const [progress, setProgress] = useState('');
  useEffect(() => {
    let active = true;
    const check = () => { void browserHelper('ping').then(reply => { if (active) setHelperReady(!!reply.ok); }).catch(() => { if (active) setHelperReady(false); }); };
    check(); window.addEventListener('focus', check);
    return () => { active = false; window.removeEventListener('focus', check); };
  }, []);
  async function assess(payload: FormData | object) {
    const { response, data } = await requestJson<{ id?: string; error?: string; code?: string }>('/api/assess/armenia', payload instanceof FormData ? { method: 'POST', body: payload } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok || !data.id) throw new Error(data.error || 'The report could not be created.');
    router.push(`/r/${data.id}`);
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError('');
    const englishUrl = listAmUrl(url) || url;
    setUrl(englishUrl);
    try {
      if (helperReady && !(pasteOpen && text.trim()) && listAmUrl(englishUrl)) {
        setProgress('Reading in your browser…');
        const imported = await browserHelper('import', englishUrl);
        if (!imported.ok || imported.source !== englishUrl || typeof imported.text !== 'string' || !imported.text.trim() || imported.text.length > 200000) throw new Error('The browser did not return valid listing details. No report was created.');
        setProgress('Creating your report…');
        await assess({ url: englishUrl, text: imported.text, browserImport: true });
      } else {
        setProgress('Reading listing…');
        await assess({ url: englishUrl, text: pasteOpen ? text : undefined });
      }
    } catch (e) { setError(e instanceof Error && !/fetch|network|request_timeout|json/i.test(e.message) ? e.message : 'The connection failed or took too long. Please try again; your input has been kept.'); } finally { inFlight.current = false; setBusy(false); setProgress(''); }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError('');
    try {
      if (file.size > MAX_PDF_BYTES) throw new Error('Upload a PDF no larger than 15 MB.');
      const content = await extractPdfText(file);
      const form = new FormData(); form.set('file', file); form.set('name', file.name); form.set('text', content);
      await assess(form);
    } catch (e) { setError(e instanceof Error && e.message === 'pdf_too_long' ? 'Upload a shorter Exposé: at most 150 pages and 200,000 text characters.' : 'This PDF could not be read or imported. Try a text-searchable PDF or paste the listing text.'); } finally { inFlight.current = false; setBusy(false); event.target.value = ''; }
  }
  return <>{market.ready && <Sidebar locale="en" homeHref="/am"/>}<main className={`landing country-landing${market.ready ? ' market-workspace' : ''}`}>
    <SiteNav locale="en" country={country} landing/>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">{market.name} · {market.ready ? 'Early access' : 'Coming next'}</p>
      <h1>{market.ready ? 'Find your place.' : 'A new place.'}<br/><em>{market.ready ? 'Know what you’re buying.' : 'The same clear view.'}</em></h1>
      <p className="market-intro">{market.ready ? 'Apartments, houses and land in Armenia. The asking price, the useful details, and the questions to settle before you buy.' : `${market.name} reports are under construction. We’re preparing local pricing, financing and property checks.`}</p></div>
      {market.ready ? <div className="intake-panel"><p className="eyebrow">Start with a List.am sale listing</p>
        <form onSubmit={submit} data-browser-import><div className="intake"><label><span>↗</span><input aria-label="List.am listing URL" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.list.am/en/item/…" type="url" required={!pasteOpen} disabled={busy}/></label><button disabled={busy}>{busy ? (progress || 'Reading listing…') : 'Create report'}</button></div>
          <div className="market-input-options"><button className="text-button" type="button" disabled={busy} onClick={() => setPasteOpen(!pasteOpen)} aria-expanded={pasteOpen}>{pasteOpen ? 'Hide pasted text' : 'Paste listing text'}</button><label className="text-button">Upload PDF<input aria-label="Upload Armenian property PDF" type="file" accept="application/pdf" disabled={busy} onChange={upload}/></label></div>
          {pasteOpen && <label className="paste-listing">Full listing text<textarea aria-label="Full listing text" disabled={busy} value={text} onChange={e => setText(e.target.value)} rows={8} maxLength={200000} placeholder="Open List.am in English and copy the listing, including For Sale, its title, asking price, property details and Location."/><small>Copy the full English page. We don’t infer amenities from greyed-out labels. The link above is optional for pasted text.</small></label>}
        </form>
        <p className="market-helper">Paste a List.am link in any language—we automatically use its English version. Text and PDF imports currently require English listing details.</p>
        <p className="market-helper" role="status">{helperReady ? 'Browser helper connected · Listings are read through Chrome.' : <>If List.am blocks the link, use Paste listing text or Upload PDF above. The <a href="/am/browser-helper">Chrome helper</a> is an additional option for desktop Chrome; it does not run on mobile browsers.</>}</p>
        {error && <p role="alert" className="error">{error}</p>}
      </div> : <p className="construction-note" role="status">Under construction · <a href="/am">Try Armenia</a> or <a href="/">Germany</a></p>}
    </section>
    <section id="how" className="approach-head"><p className="eyebrow">Our approach</p><div><h2>{market.ready ? 'Local details matter.' : 'Built for the local market.'}</h2><p>{market.ready ? 'A plot is not an apartment. A dollar price is not a dram price. We keep those differences visible.' : 'We won’t reuse another country’s taxes, rates or property rules.'}</p></div></section>
    {market.ready && <section className="approach-grid"><article><h3>The listing, without the noise.</h3><p>Read the actual property fields. Conflicting areas and prices get flagged. Unknown details stay blank.</p></article><article><h3>Money in AMD.</h3><p>Foreign-currency prices retain their original amount and use dated Central Bank exchange rates. Adjust your deposit, rate and loan term.</p></article><article><h3>Compare what matters.</h3><p>Save reports, pin your shortlist and compare two homes or plots. Share a link and keep your own notes private.</p></article></section>}
    <section id="faq" className="market-faq"><h2>A few useful answers.</h2><details><summary>What’s available in {market.name}?</summary><p>{market.ready ? 'English List.am sale listings for apartments, houses and land, saved reports, private notes, comparisons and an AMD loan calculator. This is a prototype; Germany’s deal score is not applied to Armenia.' : 'This market is not accepting listings yet. Choose Germany or Armenia from the country menu.'}</p></details>{market.ready && <><details><summary>Is the mortgage rate a guaranteed offer?</summary><p>No. We use a dated example from an Armenian lender, not the CBA policy rate or an invented market average. Your bank’s terms, fees and eligibility may differ. Subsidies and tax refunds are not assumed.</p></details><details><summary>Can I compare land plots?</summary><p>Yes. Select two Armenian reports in the sidebar. Land comparisons focus on plot size, price per square metre, advertised use and known connections. Permission to build and ownership still need independent checks.</p></details></>}</section>
    <SiteFooter locale="en"/>
  </main></>;
}
