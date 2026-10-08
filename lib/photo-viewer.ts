/**
 * Listing-photo viewer state. Pure so wrap-around, skipped failures and
 * keyboard handling can be tested without a browser.
 */

export type PhotoViewerCommand = 'previous' | 'next' | 'close';

export function photoViewerCommand(key: string): PhotoViewerCommand | null {
  if (key === 'ArrowLeft') return 'previous';
  if (key === 'ArrowRight') return 'next';
  if (key === 'Escape') return 'close';
  return null;
}

/** Index after moving by `delta`, wrapping from the last photo to the first. */
export function stepPhoto(index: number, delta: number, total: number) {
  if (total <= 0) return 0;
  return ((index + delta) % total + total) % total;
}

export function applyViewerKey(index: number, total: number, key: string) {
  const command = photoViewerCommand(key);
  if (command === 'close') return { open: false, index };
  if (command === 'next' || command === 'previous') {
    if (total <= 0) return { open: false, index: 0 };
    return { open: true, index: stepPhoto(index, command === 'next' ? 1 : -1, total) };
  }
  return { open: total > 0, index: total > 0 ? index : 0 };
}

export function photosWithoutFailures(urls: readonly string[], failed: ReadonlySet<string>) {
  return urls.filter((url) => !failed.has(url));
}

/**
 * URL to show after the visible list changes. A failed current photo skips
 * forward, and a failure on the last photo wraps to the first that remains.
 * An empty list closes the viewer.
 */
export function nextActiveUrl(previous: readonly string[], visible: readonly string[], activeUrl: string | null) {
  if (!activeUrl || visible.length === 0) return null;
  if (visible.includes(activeUrl)) return activeUrl;
  const at = previous.indexOf(activeUrl);
  if (at < 0) return visible[0] ?? null;
  return visible[at] ?? visible[0] ?? null;
}

/** Horizontal swipe changes photo. A downward swipe closes on narrow screens. */
export function swipeCommand(dx: number, dy: number, viewportWidth: number): PhotoViewerCommand | null {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < 48 && absY < 48) return null;
  if (viewportWidth < 768 && dy >= 64 && absY > absX) return 'close';
  if (absX >= 48 && absX > absY) return dx < 0 ? 'next' : 'previous';
  return null;
}

/** Next focusable index inside the dialog. `current` is -1 when focus is on the dialog itself. */
export function trappedFocusIndex(current: number, count: number, backwards: boolean) {
  if (count <= 0) return 0;
  if (current < 0) return backwards ? count - 1 : 0;
  if (backwards) return current === 0 ? count - 1 : current - 1;
  return current === count - 1 ? 0 : current + 1;
}

/** A derived thumbnail failed. Try the stored URL once; null means that URL itself failed. */
export function nextPhotoAttempt(stored: string, attempted: string) {
  return attempted && attempted !== stored ? stored : null;
}

/** Full stored frame, or the slot thumbnail when that stored URL has expired. */
export function viewerFrameSrc(stored: string, medium: string, expired: boolean) {
  if (expired && medium && medium !== stored) return medium;
  return stored;
}

/**
 * One more URL after a frame fails. A failed full frame tries the slot
 * thumbnail. An expired frame does not load the signed URL again.
 */
export function viewerFrameFallback(stored: string, medium: string, attempted: string, expired: boolean) {
  if (medium && medium !== stored && attempted !== medium) return medium;
  if (expired) return null;
  return nextPhotoAttempt(stored, attempted);
}
