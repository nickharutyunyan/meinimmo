'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { localePath, type Locale } from '@/lib/i18n';
import type { Listing, ListingPhoto } from '@/lib/market/types';
import { applyPatch, displayTitle, missingForPublish, photoKey, publicListing, validEmail, validPhone, type ListingPatch, type ReadinessItem } from '@/lib/market/validate';
import { marketCopy } from '@/lib/market/copy';
import { LISTING_TOKEN_HEADER_NAME } from '@/lib/market/client-constants';
import { photoForm, preparePhoto, savedToken, saveToken } from '@/lib/market/client-photos';
import { ListingView } from './ListingView';
import { ShareLinks } from './ShareLinks';
import { TextField } from './EditFields';

type SaveState = 'saved' | 'saving' | 'failed';
const READINESS: ReadinessItem[] = ['title', 'price', 'size', 'location', 'photos', 'contact', 'consent'];
const FIELD_FOR: Record<ReadinessItem, string> = {
  title: 'field-title', price: 'field-price', size: 'field-size', location: 'field-location', photos: 'field-photos', contact: 'field-contact', consent: 'field-consent',
};

/** Merges two patches so quick edits to different fields travel together. */
function mergePatch(base: ListingPatch, next: ListingPatch): ListingPatch {
  return {
    ...base,
    ...next,
    facts: base.facts || next.facts ? { ...base.facts, ...next.facts } : undefined,
    address: base.address || next.address ? { ...base.address, ...next.address } : undefined,
    contact: base.contact || next.contact ? { ...base.contact, ...next.contact } : undefined,
  };
}

export function ListingEditor({ id, locale }: { id: string; locale: Locale }) {
  const text = marketCopy[locale];
  const [token, setToken] = useState<string | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [failed, setFailed] = useState(false);
  const [save, setSave] = useState<SaveState>('saved');
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verify, setVerify] = useState<{ email: string; code: string; busy: boolean; error: string; resent: boolean } | null>(null);
  const pending = useRef<ListingPatch | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const inFlight = useRef<Promise<unknown> | null>(null);

  // The private link carries the token in its #fragment. Keep it on this device and tidy the address bar.
  useEffect(() => {
    const fromHash = new URLSearchParams(window.location.hash.slice(1)).get('k');
    if (fromHash) {
      saveToken(id, fromHash);
      window.history.replaceState(null, '', window.location.pathname);
    }
    const value = fromHash || savedToken(id);
    setToken(value);
    if (!value) { setFailed(true); return; }
    try {
      const stored = sessionStorage.getItem(`rah-listing-notes-${id}`);
      if (stored) { setNotes(JSON.parse(stored) as string[]); sessionStorage.removeItem(`rah-listing-notes-${id}`); }
    } catch { /* Notes are a courtesy. */ }
    fetch(`/api/listings/${id}`, { headers: { [LISTING_TOKEN_HEADER_NAME]: value }, cache: 'no-store' })
      .then(async response => {
        const body = await response.json() as { listing?: Listing };
        if (!response.ok || !body.listing) throw new Error('load');
        setListing(body.listing);
      })
      .catch(() => setFailed(true));
  }, [id]);

  // Opening a private link while this page is already open only changes the #fragment; load it properly.
  useEffect(() => {
    const onHash = () => { if (new URLSearchParams(window.location.hash.slice(1)).get('k')) window.location.reload(); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const headers = useCallback((json = true): HeadersInit => ({ ...(json ? { 'content-type': 'application/json' } : {}), [LISTING_TOKEN_HEADER_NAME]: token || '' }), [token]);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (inFlight.current) await inFlight.current;
    const patch = pending.current;
    if (!patch || !token) return;
    pending.current = null;
    setSave('saving');
    const request = fetch(`/api/listings/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(patch) })
      .then(async response => {
        const body = await response.json() as { listing?: Listing; code?: string; error?: string };
        if (!response.ok) {
          // A live listing refused an edit that would leave it incomplete; show the stored version again.
          if (response.status === 422 && body.listing) {
            setListing(body.listing);
            if (body.code === 'email_locked' && body.error) setNotes([body.error]);
            else setShowMissing(true);
            setSave('saved');
            return;
          }
          throw new Error('save');
        }
        if (!pending.current && body.listing) setListing(body.listing);
        setSave(pending.current ? 'saving' : 'saved');
      })
      .catch(() => setSave('failed'));
    inFlight.current = request;
    await request;
    inFlight.current = null;
  }, [headers, id, token]);

  const patch = useCallback((next: ListingPatch) => {
    setListing(current => current ? applyPatch(current, next, new Date().toISOString()) : current);
    pending.current = mergePatch(pending.current || {}, next);
    setSave('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void flush(); }, 450);
  }, [flush]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (pending.current) { void flush(); event.preventDefault(); } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [flush]);

  async function addPhotos(files: File[]) {
    if (!token || !files.length) return;
    const skipped: string[] = [];
    for (const [index, file] of files.entries()) {
      setUploading(text.sell.uploading(index + 1, files.length));
      try {
        const prepared = await preparePhoto(file);
        const response = await fetch(`/api/listings/${id}/photos`, { method: 'POST', headers: headers(false), body: photoForm(prepared) });
        const body = await response.json() as { listing?: Listing; error?: string };
        if (!response.ok || !body.listing) throw new Error(body.error || 'upload');
        const uploaded = body.listing.photos;
        setListing(current => current ? { ...current, photos: uploaded } : body.listing!);
      } catch {
        skipped.push(text.sell.photoFailed(file.name));
      }
    }
    setUploading(null);
    setNotes(skipped);
  }

  async function removePhoto(photo: ListingPhoto) {
    if (!token || !listing) return;
    const key = photoKey(photo);
    setListing(current => current ? { ...current, photos: current.photos.filter(item => photoKey(item) !== key) } : current);
    if (photo.kind === 'remote') { patch({ photoOrder: listing.photos.filter(item => photoKey(item) !== key).map(photoKey) }); return; }
    const response = await fetch(`/api/listings/${id}/photos/${photo.id}`, { method: 'DELETE', headers: headers(false) }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) as { listing?: Listing } : {};
    if (body.listing) setListing(body.listing);
    else setSave('failed');
  }

  async function publish(live: boolean) {
    if (!token || !listing) return;
    await flush();
    const missing = missingForPublish(listing);
    if (live && missing.length) { setShowMissing(true); focusField(missing[0]); return; }
    setPublishing(true);
    try {
      const response = await fetch(`/api/listings/${id}/publish`, { method: live ? 'POST' : 'DELETE', headers: headers(false) });
      const body = await response.json() as { listing?: Listing; error?: string; code?: string };
      // First publish from this address: prove the email, then publish continues from the code form.
      if (live && response.status === 409 && body.code === 'verify_email') { await requestCode(false); return; }
      if (!response.ok || !body.listing) throw new Error(body.error || 'publish');
      setListing(body.listing);
      setVerify(null);
      if (live) setJustPublished(true);
    } catch (error) {
      setNotes([error instanceof Error && error.message !== 'publish' ? error.message : text.editor.saveFailed]);
    } finally {
      setPublishing(false);
    }
  }

  async function requestCode(resend: boolean) {
    if (!listing) return;
    const email = listing.contact.email.trim().toLowerCase();
    setVerify(current => ({ email, code: current?.code || '', busy: true, error: '', resent: false }));
    try {
      const response = await fetch(`/api/listings/${id}/verify-email`, { method: 'POST', headers: headers(), body: JSON.stringify({ action: 'send' }) });
      const body = await response.json() as { sent?: boolean; verified?: boolean; error?: string };
      if (body.verified) { setVerify(null); await publish(true); return; }
      if (!response.ok) throw new Error(body.error || 'send');
      setVerify(current => ({ email, code: current?.code || '', busy: false, error: '', resent: resend }));
    } catch (error) {
      setVerify(current => ({ email, code: current?.code || '', busy: false, error: error instanceof Error && error.message !== 'send' ? error.message : text.editor.saveFailed, resent: false }));
    }
  }

  async function confirmCode() {
    if (!verify) return;
    setVerify({ ...verify, busy: true, error: '' });
    try {
      const response = await fetch(`/api/listings/${id}/verify-email`, { method: 'POST', headers: headers(), body: JSON.stringify({ action: 'check', code: verify.code }) });
      const body = await response.json() as { verified?: boolean; error?: string };
      if (!response.ok || !body.verified) throw new Error(body.error || 'check');
      setListing(current => current ? { ...current, verifiedEmail: verify.email } : current);
      await publish(true);
    } catch (error) {
      setVerify(current => current ? { ...current, busy: false, error: error instanceof Error && error.message !== 'check' ? error.message : text.editor.saveFailed } : current);
    }
  }

  function focusField(item: ReadinessItem) {
    setPreview(false);
    window.setTimeout(() => {
      const node = document.getElementById(FIELD_FOR[item]);
      node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const field = node?.matches('input, textarea, select') ? node : node?.querySelector<HTMLElement>('input, textarea, select, button');
      field?.focus({ preventScroll: true });
    }, 60);
  }

  if (failed) return <main className="editor-empty"><p>{text.editor.notFound}</p><Link className="market-button" href={localePath(locale, '/sell')}>{text.sell.create}</Link></main>;
  if (!listing) return <main className="editor-empty is-loading"><span className="market-spinner" aria-hidden="true" /></main>;
  if (listing.status === 'archived') return <main className="editor-empty"><p>{text.editor.deleted}</p></main>;

  const missing = missingForPublish(listing);
  const done = READINESS.length - missing.length;
  const live = listing.status === 'published';
  const moderation = listing.moderation?.state || 'none';
  const visible = live && (moderation === 'none' || moderation === 'approved');
  const statusLabel = !live ? text.editor.draft : moderation === 'pending' ? text.editor.statusReview : moderation === 'rejected' ? text.editor.statusRejected : moderation === 'hidden' ? text.editor.statusHidden : text.editor.live;
  const pageUrl = localePath(locale, `/l/${listing.id}`);
  const privateLink = typeof window === 'undefined' ? '' : `${window.location.origin}${localePath(locale, `/sell/${listing.id}`)}#k=${token}`;
  const emailOk = validEmail(listing.contact.email);
  const phoneOk = !listing.contact.phone || validPhone(listing.contact.phone);

  const sidebar = <div className="editor-panel">
    <section className={`listing-card editor-contact${missing.includes('contact') && showMissing ? ' is-missing' : ''}`} id="field-contact">
      <h2 className="listing-side-label">{text.editor.contactTitle}</h2>
      <label className="editor-input"><span>{text.editor.name}</span><TextField value={listing.contact.name} label={text.editor.name} maxLength={80} onCommit={value => patch({ contact: { name: value } })} /></label>
      <label className={`editor-input${listing.contact.email && !emailOk ? ' is-invalid' : ''}`}><span>{text.editor.email}</span><TextField value={listing.contact.email} label={text.editor.email} maxLength={160} placeholder="name@example.com" onCommit={value => patch({ contact: { email: value } })} /></label>
      <label className={`editor-input${!phoneOk ? ' is-invalid' : ''}`}><span>{text.editor.phone}</span><TextField value={listing.contact.phone} label={text.editor.phone} maxLength={40} placeholder="+49 30 1234567" onCommit={value => patch({ contact: { phone: value } })} /></label>
      <label className="ed-toggle"><input type="checkbox" checked={listing.contact.showEmail} onChange={event => patch({ contact: { showEmail: event.target.checked } })} /><span><b>{text.editor.showEmail}</b></span></label>
      <label className="ed-toggle"><input type="checkbox" checked={listing.contact.showPhone} disabled={!listing.contact.phone} onChange={event => patch({ contact: { showPhone: event.target.checked } })} /><span><b>{text.editor.showPhone}</b></span></label>
      <p className="listing-side-note">{text.editor.contactHint}</p>
    </section>

    <section className={`listing-card editor-publish${live ? ' is-live' : ''}`}>
      <div className="editor-progress" aria-label={text.editor.ready(done, READINESS.length)}>
        <span style={{ width: `${(done / READINESS.length) * 100}%` }} />
      </div>
      <p className="editor-progress-label">{visible ? text.editor.update : live ? statusLabel : text.editor.ready(done, READINESS.length)}</p>
      {live && !visible ? <div className={`editor-moderation is-${moderation}`} role="status">
        <p>{moderation === 'pending' ? text.editor.reviewText : moderation === 'rejected' ? text.editor.rejectedText : text.editor.hiddenText}</p>
        {moderation === 'rejected' && listing.moderation?.note ? <blockquote>{listing.moderation.note}</blockquote> : null}
        {listing.moderation?.flags.length ? <><p className="editor-moderation-intro">{text.editor.flagsIntro}</p><ul>{listing.moderation.flags.map(flag => <li key={flag}>{text.editor.flags[flag]}</li>)}</ul></> : null}
      </div> : null}
      {missing.length && (showMissing || done >= 4) ? <div className="editor-missing">
        <p>{text.editor.stillMissing}</p>
        <ul>{missing.map(item => <li key={item}><button type="button" onClick={() => focusField(item)}>{text.editor.missing[item]}</button></li>)}</ul>
      </div> : null}
      <label className={`ed-toggle editor-consent${missing.includes('consent') && showMissing ? ' is-missing' : ''}`} id="field-consent">
        <input type="checkbox" checked={listing.consent} onChange={event => patch({ consent: event.target.checked })} />
        <span>{text.editor.consent}</span>
      </label>
      {verify && !live ? <div className="editor-verify" id="field-verify">
        <h3>{text.editor.verifyTitle}</h3>
        <p>{text.editor.verifySent(verify.email)}</p>
        <label className="editor-input">
          <span>{text.editor.verifyCode}</span>
          <input
            className="ed-field editor-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={verify.code}
            onChange={event => setVerify({ ...verify, code: event.target.value.replace(/\D/g, '').slice(0, 6), error: '' })}
            onKeyDown={event => { if (event.key === 'Enter' && verify.code.length === 6) void confirmCode(); }}
            autoFocus
          />
        </label>
        {verify.error ? <p className="editor-verify-error" role="alert">{verify.error}</p> : null}
        {verify.resent ? <p className="listing-side-note" role="status">{text.editor.verifyResent}</p> : null}
        <button type="button" className="market-button is-block is-large" onClick={confirmCode} disabled={verify.busy || verify.code.length !== 6}>
          {verify.busy || publishing ? text.editor.publishing : text.editor.verifyConfirm}
        </button>
        <button type="button" className="market-link-button editor-resend" onClick={() => requestCode(true)} disabled={verify.busy}>{text.editor.verifyResend}</button>
        <p className="listing-side-note">{text.editor.verifyWhy}</p>
      </div> : live ? <div className="editor-live-actions">
        {visible ? <Link className="market-button is-block" href={pageUrl} target="_blank">{text.editor.view} ↗</Link> : null}
        <button type="button" className="market-link-button" onClick={() => publish(false)} disabled={publishing}>{text.editor.unpublish}</button>
      </div> : <button type="button" className="market-button is-block is-large" onClick={() => publish(true)} disabled={publishing}>
        {publishing ? text.editor.publishing : text.editor.publishFree}
      </button>}
    </section>

    <section className="listing-card editor-promote">
      <h2 className="listing-side-label">{text.editor.promote} <span className="market-soon">{text.editor.soon}</span></h2>
      <p className="listing-side-note">{text.editor.promoteText}</p>
    </section>

    <section className="listing-card">
      <h2 className="listing-side-label">{text.editor.privateLink}</h2>
      <p className="listing-side-note">{text.editor.privateLinkHint}</p>
      <button type="button" className="market-button is-quiet is-block is-small" onClick={async () => { await navigator.clipboard.writeText(privateLink).catch(() => undefined); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }}>{copied ? text.editor.copied : text.editor.copy}</button>
    </section>
  </div>;

  return <div className="editor-shell">
    <div className="editor-bar">
      <span className={`editor-status${visible ? ' is-live' : live ? ' is-held' : ''}`}>{statusLabel}</span>
      <span className={`editor-save is-${save}`} aria-live="polite">{save === 'saving' ? text.editor.saving : save === 'failed' ? text.editor.saveFailed : text.editor.saved}</span>
      <div className="editor-bar-actions">
        <div className="market-segment is-small" role="radiogroup">
          <button type="button" role="radio" aria-checked={!preview} className={!preview ? 'is-on' : ''} onClick={() => setPreview(false)}>{text.editor.edit}</button>
          <button type="button" role="radio" aria-checked={preview} className={preview ? 'is-on' : ''} onClick={() => setPreview(true)}>{text.editor.preview}</button>
        </div>
        {visible ? <Link className="market-button is-small" href={pageUrl} target="_blank">{text.editor.view} ↗</Link>
          : live ? null : <button type="button" className="market-button is-small" onClick={() => publish(true)} disabled={publishing}>{text.editor.publish}</button>}
      </div>
    </div>
    {notes.length ? <div className="editor-notes" role="status">{notes.map(note => <p key={note}>{note}</p>)}<button type="button" onClick={() => setNotes([])} aria-label={text.editor.close}>×</button></div> : null}

    {preview
      ? <ListingView listing={publicListing(listing)} locale={locale} />
      : <ListingView listing={listing} locale={locale} edit={{ patch, addPhotos, removePhoto, reorderPhotos: keys => patch({ photoOrder: keys }), uploading, missing: showMissing ? missing : missing.filter(item => item !== 'contact' && item !== 'consent'), sidebar }} />}

    {justPublished ? <div className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="published-title" onClick={event => { if (event.target === event.currentTarget) setJustPublished(false); }}>
      <div className="editor-modal-card">
        <p className="editor-modal-mark" aria-hidden="true">{visible ? '✓' : '⏳'}</p>
        <h2 id="published-title">{visible ? text.editor.liveTitle : text.editor.reviewTitle}</h2>
        <p>{visible ? text.editor.liveText : text.editor.reviewText}</p>
        {visible ? <ShareLinks url={pageUrl} title={displayTitle(listing, locale)} locale={locale} /> : null}
        <div className="editor-modal-actions">
          {visible ? <Link className="market-button" href={pageUrl}>{text.editor.view}</Link> : null}
          <button type="button" className="market-link-button" onClick={() => setJustPublished(false)}>{text.editor.close}</button>
        </div>
      </div>
    </div> : null}
  </div>;
}
