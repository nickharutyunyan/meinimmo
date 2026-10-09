/**
 * Browser-side photo preparation. Phone photos are 4–12 MB; the listing needs
 * a 1920 px image for the gallery and a 640 px one for cards. Resizing here
 * keeps uploads fast and keeps every stored photo small.
 */
export type PreparedPhoto = {
  full: Blob; fullWidth: number; fullHeight: number;
  thumb: Blob; thumbWidth: number; thumbHeight: number;
};

const FULL_EDGE = 1920;
const THUMB_EDGE = 640;
const FULL_LIMIT = 1_800_000;

function scaled(width: number, height: number, edge: number) {
  const ratio = Math.min(1, edge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

async function encode(source: ImageBitmap, width: number, height: number, quality: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas');
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('encode');
  return blob;
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const full = scaled(bitmap.width, bitmap.height, FULL_EDGE);
    let quality = 0.84;
    let fullBlob = await encode(bitmap, full.width, full.height, quality);
    while (fullBlob.size > FULL_LIMIT && quality > 0.5) {
      quality -= 0.12;
      fullBlob = await encode(bitmap, full.width, full.height, quality);
    }
    const thumb = scaled(bitmap.width, bitmap.height, THUMB_EDGE);
    const thumbBlob = await encode(bitmap, thumb.width, thumb.height, 0.78);
    return { full: fullBlob, fullWidth: full.width, fullHeight: full.height, thumb: thumbBlob, thumbWidth: thumb.width, thumbHeight: thumb.height };
  } finally {
    bitmap.close();
  }
}

export function photoForm(photo: PreparedPhoto) {
  const form = new FormData();
  form.set('full', photo.full, 'photo.jpg');
  form.set('fullWidth', String(photo.fullWidth));
  form.set('fullHeight', String(photo.fullHeight));
  form.set('thumb', photo.thumb, 'thumb.jpg');
  form.set('thumbWidth', String(photo.thumbWidth));
  form.set('thumbHeight', String(photo.thumbHeight));
  return form;
}

/** Edit tokens stay on the seller's device. The private link carries one in its #fragment, which never reaches a server. */
const TOKENS = 'rah-listing-tokens';

export function savedToken(id: string): string | null {
  try { return (JSON.parse(localStorage.getItem(TOKENS) || '{}') as Record<string, string>)[id] || null; } catch { return null; }
}

export function saveToken(id: string, token: string) {
  try {
    const all = JSON.parse(localStorage.getItem(TOKENS) || '{}') as Record<string, string>;
    all[id] = token;
    localStorage.setItem(TOKENS, JSON.stringify(all));
  } catch { /* Private mode: the private link still works. */ }
}
