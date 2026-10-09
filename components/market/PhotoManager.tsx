'use client';

import { useRef, useState, type DragEvent } from 'react';
import type { Locale } from '@/lib/i18n';
import type { Listing, ListingPhoto } from '@/lib/market/types';
import { marketCopy } from '@/lib/market/copy';
import { photoKey, photoSrc } from '@/lib/market/validate';

export function PhotoManager({ listing, locale, onAdd, onRemove, onReorder, uploading, missing }: {
  listing: Listing;
  locale: Locale;
  onAdd: (files: File[]) => void;
  onRemove: (photo: ListingPhoto) => void;
  onReorder: (keys: string[]) => void;
  uploading: string | null;
  missing: boolean;
}) {
  const text = marketCopy[locale];
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const keys = listing.photos.map(photoKey);

  const move = (from: string, to: string) => {
    if (from === to) return;
    const next = keys.filter(key => key !== from);
    next.splice(next.indexOf(to) + (keys.indexOf(from) < keys.indexOf(to) ? 1 : 0), 0, from);
    onReorder(next);
  };
  const filesFrom = (event: DragEvent) => [...event.dataTransfer.files].filter(file => file.type.startsWith('image/'));

  return <section
    className={`photo-manager${dropping ? ' is-dropping' : ''}${missing ? ' is-missing' : ''}`}
    id="field-photos"
    onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDropping(true); } }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropping(false); }}
    onDrop={event => { if (!event.dataTransfer.files.length) return; event.preventDefault(); setDropping(false); onAdd(filesFrom(event)); }}
  >
    <div className="photo-grid">
      {listing.photos.map((photo, position) => {
        const key = photoKey(photo);
        return <figure
          key={key}
          className={`photo-tile${position === 0 ? ' is-cover' : ''}${dragging === key ? ' is-dragging' : ''}${over === key ? ' is-over' : ''}`}
          draggable
          onDragStart={event => { setDragging(key); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', key); }}
          onDragEnd={() => { setDragging(null); setOver(null); }}
          onDragOver={event => { if (dragging) { event.preventDefault(); setOver(key); } }}
          onDrop={event => { if (!dragging) return; event.preventDefault(); event.stopPropagation(); move(dragging, key); setDragging(null); setOver(null); }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoSrc(listing.id, photo, 'thumb')} alt="" draggable={false} referrerPolicy="no-referrer" />
          {position === 0 ? <span className="photo-cover-badge">{text.editor.cover}</span> : <button type="button" className="photo-cover-button" onClick={() => onReorder([key, ...keys.filter(item => item !== key)])}>{text.editor.makeCover}</button>}
          <button type="button" className="photo-delete" onClick={() => onRemove(photo)} aria-label={text.editor.deletePhoto} title={text.editor.deletePhoto}>×</button>
        </figure>;
      })}
      <button type="button" className="photo-add" onClick={() => input.current?.click()} disabled={Boolean(uploading)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        <span>{uploading || text.editor.addPhotos}</span>
      </button>
    </div>
    <p className="ed-hint">{text.editor.dragHint}</p>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden onChange={event => { onAdd([...(event.target.files || [])]); event.target.value = ''; }} />
  </section>;
}
