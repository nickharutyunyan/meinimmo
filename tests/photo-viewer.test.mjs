import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { photoCount } from '../lib/format.ts';
import { copy } from '../lib/i18n.ts';
import {
  applyViewerKey,
  nextActiveUrl,
  nextPhotoAttempt,
  photosWithoutFailures,
  stepPhoto,
  swipeCommand,
  trappedFocusIndex,
} from '../lib/photo-viewer.ts';

const photos = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

test('photo navigation wraps from the last photo to the first and back', () => {
  assert.equal(stepPhoto(7, 1, 8), 0);
  assert.equal(stepPhoto(0, -1, 8), 7);
  assert.equal(stepPhoto(3, 1, 8), 4);
  assert.equal(stepPhoto(3, -1, 8), 2);
  assert.equal(stepPhoto(0, 1, 1), 0);
  assert.equal(stepPhoto(0, -1, 0), 0);
  assert.deepEqual(applyViewerKey(7, 8, 'ArrowRight'), { open: true, index: 0 });
  assert.deepEqual(applyViewerKey(0, 8, 'ArrowLeft'), { open: true, index: 7 });
  assert.deepEqual(applyViewerKey(2, 8, 'ArrowRight'), { open: true, index: 3 });
  assert.deepEqual(applyViewerKey(2, 8, 'ArrowLeft'), { open: true, index: 1 });
});

test('keyboard handling closes on Escape and ignores unrelated keys', () => {
  assert.deepEqual(applyViewerKey(4, 8, 'Escape'), { open: false, index: 4 });
  assert.deepEqual(applyViewerKey(4, 8, 'Enter'), { open: true, index: 4 });
  assert.deepEqual(applyViewerKey(4, 8, ' '), { open: true, index: 4 });
  assert.deepEqual(applyViewerKey(4, 8, 'ArrowUp'), { open: true, index: 4 });
  assert.deepEqual(applyViewerKey(4, 8, 'Home'), { open: true, index: 4 });
  assert.deepEqual(applyViewerKey(4, 8, 'Tab'), { open: true, index: 4 });
  assert.deepEqual(applyViewerKey(0, 0, 'ArrowRight'), { open: false, index: 0 });
  assert.equal(trappedFocusIndex(-1, 5, false), 0);
  assert.equal(trappedFocusIndex(-1, 5, true), 4);
  assert.equal(trappedFocusIndex(0, 5, true), 4);
  assert.equal(trappedFocusIndex(4, 5, false), 0);
  assert.equal(trappedFocusIndex(2, 5, false), 3);
  assert.equal(swipeCommand(-90, 8, 1280), 'next');
  assert.equal(swipeCommand(90, 8, 390), 'previous');
  assert.equal(swipeCommand(12, 80, 390), 'close');
  assert.equal(swipeCommand(12, 80, 1280), null);
  assert.equal(swipeCommand(10, 12, 390), null);
});

test('broken images are skipped, dropped from the count, and an empty set stays closed', () => {
  const skipped = photosWithoutFailures(photos, new Set(['c']));
  assert.deepEqual(skipped, ['a', 'b', 'd', 'e', 'f', 'g', 'h']);
  assert.equal(skipped.length, 7);
  assert.equal(nextActiveUrl(photos, skipped, 'b'), 'b');
  assert.equal(skipped.indexOf('b'), 1);
  const afterCurrent = nextActiveUrl(photos, skipped, 'c');
  assert.equal(afterCurrent, 'd');
  assert.equal(photoCount(skipped.indexOf(afterCurrent) + 1, skipped.length, 'en', '{n} / {total}'), '3 / 7');
  assert.equal(photoCount(skipped.indexOf(afterCurrent) + 1, skipped.length, 'de', '{n} / {total}'), '3 / 7');

  const withoutLast = photosWithoutFailures(photos, new Set(['h']));
  assert.equal(nextActiveUrl(photos, withoutLast, 'h'), 'a');
  assert.equal(photoCount(1, withoutLast.length, 'en'), '1 / 7');

  const none = photosWithoutFailures(photos, new Set(photos));
  assert.deepEqual(none, []);
  assert.equal(nextActiveUrl(photos, none, 'd'), null);
  assert.equal(applyViewerKey(3, none.length, 'ArrowRight').open, false);

  assert.equal(nextPhotoAttempt('https://cdn.example/a.jpg', 'https://cdn.example/a.jpg?size=thumb'), 'https://cdn.example/a.jpg');
  assert.equal(nextPhotoAttempt('https://cdn.example/a.jpg', 'https://cdn.example/a.jpg'), null);
});

test('viewer copy is the specified English and German text', async () => {
  assert.equal(copy.en.report.photoViewerLabel, 'Listing photos');
  assert.equal(copy.de.report.photoViewerLabel, 'Fotos aus dem Angebot');
  assert.equal(copy.en.report.photoPrevious, 'Previous photo');
  assert.equal(copy.de.report.photoPrevious, 'Vorheriges Foto');
  assert.equal(copy.en.report.photoNext, 'Next photo');
  assert.equal(copy.de.report.photoNext, 'Nächstes Foto');
  assert.equal(copy.en.report.photoClose, 'Close');
  assert.equal(copy.de.report.photoClose, 'Schließen');
  assert.equal(copy.en.report.photoCredit, 'Photo from the listing');
  assert.equal(copy.de.report.photoCredit, 'Foto aus dem Angebot');
  assert.equal(copy.en.report.photoOriginal, 'Open original listing');
  assert.equal(copy.de.report.photoOriginal, 'Originalangebot öffnen');
  assert.equal(copy.en.report.photoAlt, 'Photo {n} of {total}');
  assert.equal(copy.de.report.photoAlt, 'Foto {n} von {total}');
  assert.equal(copy.en.report.photoCount, '{n} / {total}');
  assert.equal(copy.de.report.photoCount, '{n} / {total}');
  assert.equal(photoCount(3, 8, 'en', copy.en.report.photoCount), '3 / 8');
  assert.equal(photoCount(3, 8, 'de', copy.de.report.photoCount), '3 / 8');
  assert.equal(copy.en.report.photoAlt.replaceAll('{n}', '3').replaceAll('{total}', '8'), 'Photo 3 of 8');
  assert.equal(copy.de.report.photoAlt.replaceAll('{n}', '3').replaceAll('{total}', '8'), 'Foto 3 von 8');

  const viewer = await readFile(new URL('../components/PhotoViewer.tsx', import.meta.url), 'utf8');
  assert.match(viewer, /role="dialog"/);
  assert.match(viewer, /aria-modal="true"/);
  assert.match(viewer, /aria-label=\{text\.photoViewerLabel\}/);
  assert.match(viewer, /aria-label=\{text\.photoPrevious\}/);
  assert.match(viewer, /aria-label=\{text\.photoNext\}/);
  assert.match(viewer, /aria-label=\{text\.photoClose\}/);
  assert.match(viewer, /rel="noopener noreferrer nofollow"/);
  assert.match(viewer, /referrerPolicy="no-referrer"/);
  assert.match(viewer, /target="_blank"/);
  const css = await readFile(new URL('../app/editorial.css', import.meta.url), 'utf8');
  assert.match(css, /\.photo-viewer-close, \.photo-viewer-nav \{[^}]*width: 44px; height: 44px/);
  assert.match(css, /@media \(min-width: 768px\) \{\s*\.photo-viewer-thumbs \{ display: flex; \}/);
  assert.match(css, /\.photo-viewer button:focus-visible, \.photo-viewer a:focus-visible \{[^}]*outline: 2px solid/);
  assert.match(css, /object-fit: contain/);
});
