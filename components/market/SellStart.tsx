'use client';

import { useRef, useState, type DragEvent } from 'react';
import { localePath, type Locale } from '@/lib/i18n';
import type { Listing, ListingType } from '@/lib/market/types';
import { marketCopy } from '@/lib/market/copy';
import { LISTING_TOKEN_HEADER_NAME } from '@/lib/market/client-constants';
import { photoForm, preparePhoto, saveToken } from '@/lib/market/client-photos';
import { extractPdfText } from '../LandingPage';

type Picked = { id: string; file: File; kind: 'photo' | 'pdf'; preview?: string };

const TYPES: ListingType[] = ['flat', 'house', 'land'];

function TypeIcon({ type }: { type: ListingType }) {
  if (type === 'flat') return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 27V6h16v21M12 10h2m4 0h2m-8 5h2m4 0h2m-8 5h2m4 0h2M14 27v-3h4v3M5 27h22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (type === 'house') return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m5 15 11-9 11 9M8 13v14h16V13M13 27v-7h6v7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 22 12 9l5 7 3-4 8 10ZM4 26h24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function SellStart({ locale }: { locale: Locale }) {
  const text = marketCopy[locale];
  const input = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<ListingType>('flat');
  const [files, setFiles] = useState<Picked[]>([]);
  const [pasted, setPasted] = useState('');
  const [dropping, setDropping] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const busy = Boolean(status);
  const photos = files.filter(item => item.kind === 'photo');
  const pdfs = files.filter(item => item.kind === 'pdf');

  const add = (list: FileList | File[]) => {
    const next: Picked[] = [];
    for (const file of [...list]) {
      const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      const photo = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
      if (!pdf && !photo) continue;
      next.push({ id: `${file.name}-${file.size}-${file.lastModified}`, file, kind: pdf ? 'pdf' : 'photo', preview: photo ? URL.createObjectURL(file) : undefined });
    }
    setError('');
    setFiles(previous => {
      const known = new Set(previous.map(item => item.id));
      return [...previous, ...next.filter(item => !known.has(item.id))].slice(0, 40);
    });
  };
  const remove = (id: string) => setFiles(previous => previous.filter(item => {
    if (item.id === id && item.preview) URL.revokeObjectURL(item.preview);
    return item.id !== id;
  }));
  const onDrop = (event: DragEvent) => { event.preventDefault(); setDropping(false); add(event.dataTransfer.files); };

  async function create() {
    if (!photos.length && !pdfs.length && pasted.trim().length < 20) { setError(text.sell.needSomething); return; }
    setError('');
    const skipped: string[] = [];
    try {
      const parts = [pasted.trim()];
      for (const item of pdfs) {
        setStatus(text.sell.readingPdf(item.file.name));
        try { parts.push(await extractPdfText(item.file)); } catch { skipped.push(text.sell.pdfFailed(item.file.name)); }
      }
      setStatus(text.sell.drafting);
      const response = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: parts.filter(Boolean).join('\n\n'), locale, propertyType: type }),
      });
      const body = await response.json() as { listing?: Listing; token?: string; error?: string };
      if (!response.ok || !body.listing || !body.token) throw new Error(body.error || 'draft');
      const { listing, token } = body;
      saveToken(listing.id, token);
      for (const [index, item] of photos.entries()) {
        setStatus(text.sell.uploading(index + 1, photos.length));
        try {
          const prepared = await preparePhoto(item.file);
          const upload = await fetch(`/api/listings/${listing.id}/photos`, { method: 'POST', headers: { [LISTING_TOKEN_HEADER_NAME]: token }, body: photoForm(prepared) });
          if (!upload.ok) throw new Error('upload');
        } catch {
          skipped.push(text.sell.photoFailed(item.file.name));
        }
      }
      if (skipped.length) sessionStorage.setItem(`rah-listing-notes-${listing.id}`, JSON.stringify(skipped));
      window.location.href = `${localePath(locale, `/sell/${listing.id}`)}#k=${token}`;
    } catch (failure) {
      setStatus('');
      setNotes(skipped);
      setError(failure instanceof Error && failure.message !== 'draft' ? failure.message : (locale === 'de' ? 'Der Entwurf konnte nicht erstellt werden. Bitte erneut versuchen.' : 'The draft could not be created. Please try again.'));
    }
  }

  return <main className="sell-start">
    <header className="market-hero is-sell">
      <p className="market-eyebrow">{text.sell.eyebrow}</p>
      <h1>{text.sell.title} <em>{text.sell.emphasis}</em></h1>
      <p className="market-lede">{text.sell.lede}</p>
      <ol className="sell-how">
        <li><b>{text.sell.how1}</b><span>{text.sell.how1Text}</span></li>
        <li><b>{text.sell.how2}</b><span>{text.sell.how2Text}</span></li>
        <li><b>{text.sell.how3}</b><span>{text.sell.how3Text}</span></li>
      </ol>
    </header>

    <section className="sell-panel" aria-busy={busy}>
      <h2 className="sell-step"><span>1</span>{text.sell.stepType}</h2>
      <div className="sell-types" role="radiogroup" aria-label={text.sell.stepType}>
        {TYPES.map(value => <button key={value} type="button" role="radio" aria-checked={type === value} className={type === value ? 'is-on' : ''} onClick={() => setType(value)} disabled={busy}>
          <TypeIcon type={value} />
          <span>{text.sell[value]}</span>
        </button>)}
      </div>

      <h2 className="sell-step"><span>2</span>{text.sell.stepFiles}</h2>
      <div
        className={`sell-drop${dropping ? ' is-over' : ''}${files.length ? ' has-files' : ''}`}
        onDragOver={event => { event.preventDefault(); setDropping(true); }}
        onDragLeave={() => setDropping(false)}
        onDrop={onDrop}
      >
        {files.length ? <ul className="sell-files">
          {files.map(item => <li key={item.id} className={`is-${item.kind}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {item.preview ? <img src={item.preview} alt="" /> : <span className="sell-pdf">PDF<small>{item.file.name}</small></span>}
            <button type="button" onClick={() => remove(item.id)} aria-label={`${text.sell.remove} ${item.file.name}`} disabled={busy}>×</button>
          </li>)}
          <li className="sell-add"><button type="button" onClick={() => input.current?.click()} disabled={busy}>+</button></li>
        </ul> : <div className="sell-drop-empty">
          <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 34V14a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4Zm0-4 9-9 7 7 5-5 11 11M31 18a2 2 0 1 0 0-.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <p><b>{text.sell.drop}</b> {text.sell.dropOr} <button type="button" className="market-link-button" onClick={() => input.current?.click()}>{text.sell.browse}</button></p>
          <small>{text.sell.dropHint}</small>
        </div>}
        <input ref={input} type="file" multiple hidden accept="image/*,application/pdf,.pdf,.heic,.heif" onChange={event => { if (event.target.files) add(event.target.files); event.target.value = ''; }} />
      </div>
      {files.length ? <p className="sell-counts">{[photos.length && text.sell.photos(photos.length), pdfs.length && text.sell.documents(pdfs.length)].filter(Boolean).join(' · ')}</p> : null}

      <details className="sell-paste" open={Boolean(pasted)}>
        <summary>{text.sell.paste}</summary>
        <textarea value={pasted} onChange={event => setPasted(event.target.value)} placeholder={text.sell.pastePlaceholder} rows={5} maxLength={20000} disabled={busy} />
      </details>

      {error ? <p className="sell-error" role="alert">{error}</p> : null}
      {notes.map(note => <p key={note} className="sell-note">{note}</p>)}
      <div className="sell-submit">
        <button type="button" className="market-button is-large" onClick={create} disabled={busy}>{busy ? <><span className="market-spinner" aria-hidden="true" />{status}</> : text.sell.create}</button>
        <p>{text.sell.private}</p>
      </div>
    </section>
  </main>;
}
