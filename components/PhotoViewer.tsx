'use client';

import { useEffect, useRef, useState, type MouseEvent, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { copy, type Locale } from '../lib/i18n.ts';
import { photoCount, plainNumber } from '../lib/format.ts';
import { displayedListingPhotoExpired } from '../lib/listing-photos.ts';
import { applyViewerKey, stepPhoto, swipeCommand, trappedFocusIndex, viewerFrameFallback, viewerFrameSrc } from '../lib/photo-viewer.ts';

const FOCUSABLE = 'button:not([disabled]), a[href]';

function focusable(dialog: HTMLElement) {
  return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((node) => node.getClientRects().length > 0);
}

export function PhotoViewer({
  photos,
  thumbs,
  index,
  now,
  listingUrl,
  locale,
  sample = false,
  staged = false,
  onClose,
  onSelect,
  onFail,
}: {
  photos: readonly string[];
  thumbs: readonly string[];
  index: number;
  now: number;
  listingUrl: string;
  locale: Locale;
  sample?: boolean;
  staged?: boolean;
  onClose: () => void;
  onSelect: (index: number) => void;
  onFail: (url: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [dragY, setDragY] = useState(0);
  const failRef = useRef(onFail);
  failRef.current = onFail;
  const text = copy[locale].report;
  const total = photos.length;
  const current = photos[index];
  const alt = (position: number) => text.photoAlt
    .replaceAll('{n}', plainNumber(position, locale))
    .replaceAll('{total}', plainNumber(total, locale));

  useEffect(() => {
    closeRef.current?.focus();
    const body = document.body;
    const root = document.documentElement;
    const previousBody = body.style.overflow;
    const previousRoot = root.style.overflow;
    const previousPadding = body.style.paddingRight;
    const gap = window.innerWidth - root.clientWidth;
    body.style.overflow = 'hidden';
    root.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = previousBody;
      root.style.overflow = previousRoot;
      body.style.paddingRight = previousPadding;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const outcome = applyViewerKey(index, total, event.key);
      if (event.key === 'Escape' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        if (!outcome.open) onClose();
        else if (outcome.index !== index) onSelect(outcome.index);
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const nodes = focusable(dialog);
      if (!nodes.length) {
        event.preventDefault();
        return;
      }
      const next = trappedFocusIndex(nodes.indexOf(document.activeElement as HTMLElement), nodes.length, event.shiftKey);
      event.preventDefault();
      nodes[next]?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, onClose, onSelect, total]);

  const mediumAt = (url: string) => {
    const at = photos.indexOf(url);
    return at >= 0 ? thumbs[at] || '' : '';
  };
  const previous = total > 0 ? photos[stepPhoto(index, -1, total)] ?? '' : '';
  const following = total > 0 ? photos[stepPhoto(index, 1, total)] ?? '' : '';
  const neighborKey = thumbs.join('\n');
  useEffect(() => {
    if (!current) return;
    const seen = new Set<string>([current]);
    const images: HTMLImageElement[] = [];
    for (const url of [previous, following]) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const medium = mediumAt(url);
      const expired = displayedListingPhotoExpired(url, now);
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => {
        const next = viewerFrameFallback(url, medium, img.src, expired);
        if (next && img.dataset.photoFallback !== '1') {
          img.dataset.photoFallback = '1';
          img.src = next;
          return;
        }
        failRef.current(url);
      };
      img.src = viewerFrameSrc(url, medium, expired);
      images.push(img);
    }
    return () => {
      for (const img of images) img.onerror = null;
    };
  }, [current, following, neighborKey, now, previous]);

  if (!current || typeof document === 'undefined') return null;

  const move = (delta: number) => onSelect(stepPhoto(index, delta, total));
  const backdrop = (event: MouseEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) onClose();
  };
  const onTouchStart = (event: TouchEvent) => {
    const target = event.target;
    if (target instanceof Element && target.closest('button, a')) {
      touch.current = null;
      return;
    }
    const point = event.changedTouches[0];
    if (!point) return;
    touch.current = { x: point.clientX, y: point.clientY };
  };
  const onTouchMove = (event: TouchEvent) => {
    const start = touch.current;
    if (!start || window.innerWidth >= 768) return;
    const point = event.changedTouches[0];
    if (!point) return;
    const dx = point.clientX - start.x;
    const dy = point.clientY - start.y;
    setDragY(dy > 12 && dy > Math.abs(dx) ? Math.min(dy, 240) : 0);
  };
  const onTouchEnd = (event: TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const point = event.changedTouches[0];
    if (!point) return;
    const command = swipeCommand(point.clientX - start.x, point.clientY - start.y, window.innerWidth);
    if (command === 'close') onClose();
    else setDragY(0);
    if (command === 'next') move(1);
    else if (command === 'previous') move(-1);
  };

  return createPortal(<div
    ref={dialogRef}
    className={dragY > 0 ? 'photo-viewer is-dragging' : 'photo-viewer'}
    role="dialog"
    aria-modal="true"
    aria-label={text.photoViewerLabel}
    tabIndex={-1}
    style={dragY > 0 ? { transform: `translate3d(0, ${dragY}px, 0)` } : undefined}
    onMouseDown={backdrop}
    onTouchStart={onTouchStart}
    onTouchMove={onTouchMove}
    onTouchEnd={onTouchEnd}
  >
    <button ref={closeRef} type="button" className="photo-viewer-close" aria-label={text.photoClose} title={text.photoClose} onClick={onClose}><span aria-hidden="true">×</span></button>
    <div className="photo-viewer-stage" onMouseDown={backdrop}>
      <button type="button" className="photo-viewer-nav" aria-label={text.photoPrevious} title={text.photoPrevious} onClick={() => move(-1)}><span aria-hidden="true">‹</span></button>
      <div className="photo-viewer-frame" onMouseDown={backdrop}>
        <img
          key={current}
          src={viewerFrameSrc(current, thumbs[index] || '', displayedListingPhotoExpired(current, now))}
          alt={alt(index + 1)}
          referrerPolicy="no-referrer"
          decoding="async"
          onError={(event) => {
            const img = event.currentTarget;
            const next = viewerFrameFallback(current, thumbs[index] || '', img.src, displayedListingPhotoExpired(current, now));
            if (next && img.dataset.photoFallback !== '1') {
              img.dataset.photoFallback = '1';
              img.src = next;
              return;
            }
            onFail(current);
          }}
        />
      </div>
      <button type="button" className="photo-viewer-nav" aria-label={text.photoNext} title={text.photoNext} onClick={() => move(1)}><span aria-hidden="true">›</span></button>
    </div>
    <p className="photo-viewer-count" aria-live="polite">{photoCount(index + 1, total, locale, text.photoCount)}</p>
    <div className="photo-viewer-thumbs">
      {photos.map((url, thumbIndex) => <button
        type="button"
        key={url}
        aria-label={alt(thumbIndex + 1)}
        aria-current={thumbIndex === index ? 'true' : undefined}
        onClick={() => onSelect(thumbIndex)}
      >
        <img
          src={thumbs[thumbIndex] || url}
          alt=""
          width={72}
          height={54}
          referrerPolicy="no-referrer"
          decoding="async"
          onError={(event) => {
            const img = event.currentTarget;
            const next = viewerFrameFallback(url, thumbs[thumbIndex] || '', img.src, displayedListingPhotoExpired(url, now));
            if (next && img.dataset.photoFallback !== '1') {
              img.dataset.photoFallback = '1';
              img.src = next;
            }
          }}
        />
      </button>)}
    </div>
    <p className="photo-viewer-credit">
      <span>{sample ? text.photoSample : staged ? text.photoStaged : text.photoCredit}</span>
      <a href={listingUrl} target="_blank" rel="noopener noreferrer nofollow">{text.photoOriginal}{'\u00A0'}<span aria-hidden="true">↗</span></a>
    </p>
  </div>, document.body);
}
