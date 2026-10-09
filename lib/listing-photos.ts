import { listingImageHostAllowed } from './listing-image-hosts.ts';

/** Same raw-HTML cap as the listing parser. Longer pages are scanned only up to here. */
const MAX_PHOTO_HTML_CHARS = 1_500_000;
const MAX_PHOTOS = 8;
const MAX_ATTR_CHARS = 2_048;
const MAX_JSON_LD_BODY = 200_000;
const MAX_JSON_LD_BLOCKS = 40;

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };

export function isRemoteListingSource(source: string) {
  return source.startsWith('https://') || source.startsWith('http://');
}

export function isDisplayableListingPhoto(value: string) {
  if (!value || value.length > MAX_ATTR_CHARS) return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith('https://') || trimmed.startsWith('data:')) return false;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (!listingImageHostAllowed(url)) return false;
  const path = url.pathname.toLowerCase();
  if (path.includes('/pixel') || path.includes('spacer') || path.includes('1x1') || path.includes('tracking')) return false;
  return true;
}

/**
 * Unix-second `exp` on a stored photo URL. The query string is left unchanged.
 * A missing or non-numeric `exp` means the URL has no expiry of its own.
 */
export function listingPhotoExpirySeconds(value: string) {
  const raw = signedPhotoQuery(value).exp;
  return raw === undefined ? undefined : unixSeconds(raw);
}

/**
 * True when the URL the visitor actually loads should be hidden by the clock.
 * A URL with no `exp`, `expires`, `sig`, or `signature` query never expires
 * by time. A signed URL still used as the src or href is hidden once its
 * own `exp` or `expires` time has passed. No report-wide timestamp is read.
 */
export function displayedListingPhotoExpired(value: string, now: number) {
  const query = signedPhotoQuery(value);
  if (!query.signed) return false;
  const raw = query.exp ?? query.expires;
  if (!raw) return false;
  const millis = expiryMillis(raw);
  return millis !== undefined && now >= millis;
}

function signedPhotoQuery(value: string) {
  let exp: string | undefined;
  let expires: string | undefined;
  let signed = false;
  const queryStart = value.indexOf('?');
  if (queryStart < 0) return { exp, expires, signed };
  let cursor = queryStart + 1;
  const hash = value.indexOf('#', cursor);
  const stop = hash < 0 ? value.length : hash;
  while (cursor < stop) {
    const amp = value.indexOf('&', cursor);
    const partEnd = amp < 0 || amp > stop ? stop : amp;
    const eq = value.indexOf('=', cursor);
    const hasValue = eq > cursor && eq < partEnd;
    const key = hasValue ? value.slice(cursor, eq) : value.slice(cursor, partEnd);
    const raw = hasValue ? value.slice(eq + 1, partEnd) : '';
    if (key === 'exp' && exp === undefined) exp = raw;
    else if (key === 'expires' && expires === undefined) expires = raw;
    else if (key === 'sig' || key === 'signature') signed = true;
    cursor = partEnd + 1;
  }
  if (exp !== undefined || expires !== undefined) signed = true;
  return { exp, expires, signed };
}

function expiryMillis(raw: string) {
  const seconds = unixSeconds(raw);
  if (seconds !== undefined) return seconds * 1000;
  if (raw.length < 16 || raw.length > 40 || raw.charCodeAt(4) !== 45) return undefined;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function unixSeconds(raw: string) {
  if (!raw) return undefined;
  let value = 0;
  for (let index = 0; index < raw.length; index += 1) {
    const code = raw.charCodeAt(index);
    if (code < 48 || code > 57) return undefined;
    value = value * 10 + (code - 48);
    if (!Number.isSafeInteger(value)) return undefined;
  }
  return value;
}

/** Earliest `exp` across the stored photo URLs, as an ISO timestamp. */
export function listingPhotosExpireAt(urls: readonly string[] | undefined) {
  let earliest: number | undefined;
  for (const url of urls || []) {
    if (typeof url !== 'string') continue;
    const exp = listingPhotoExpirySeconds(url);
    if (exp === undefined) continue;
    if (earliest === undefined || exp < earliest) earliest = exp;
  }
  return earliest === undefined ? undefined : new Date(earliest * 1000).toISOString();
}

/**
 * Allowlist and full-URL dedupe. `sig` and `exp` stay on the URL. Signed links
 * are the host's access control and are not rewritten here.
 */
export function displayableListingPhotos(urls: readonly string[] | undefined) {
  if (!urls?.length) return [];
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const value of urls) {
    if (typeof value !== 'string') continue;
    const url = value.trim();
    if (!isDisplayableListingPhoto(url) || seen.has(url)) continue;
    seen.add(url);
    kept.push(url);
    if (kept.length === MAX_PHOTOS) break;
  }
  return kept;
}

/**
 * Photos still shown. Expiry follows the URL in the img src, not the stored
 * signed file and not `photosExpireAt`. A non-signed thumbnail stays. A signed
 * URL that is still the src is omitted once its own time has passed. Failed
 * loads are omitted too. An empty list hides the strip.
 */
export function listingPhotosToShow(urls: readonly string[] | undefined, failed: ReadonlySet<string>, now = Date.now(), listingUrl = '') {
  return displayableListingPhotos(urls).filter((url) => {
    if (failed.has(url)) return false;
    const displayed = listingUrl ? listingThumbnailUrl(url, listingUrl, listingPhotoSlot(urls, url)) : url;
    return !displayedListingPhotoExpired(displayed, now);
  });
}

/** Index of `url` in the displayable stored list. Hiding another photo does not change it. */
export function listingPhotoSlot(urls: readonly string[] | undefined, url: string) {
  const slot = displayableListingPhotos(urls).indexOf(url);
  return slot < 0 ? 0 : slot;
}

/**
 * A 160px thumbnail should not download a 1920px frame.
 * An unsigned imgproxy URL can be resized in place. A signed URL cannot:
 * changing the size breaks the signature. When the listing URL names an
 * `/immobilie/{id}/` page, `picture/{n}/medium.jpg` is the img src.
 * `{n}` is the index in the displayable stored photo list.
 * That src has no expiry query. The browser may redirect it to a short-lived
 * signed frame; that target is not fetched, stored, or written into the page.
 * Anything else stays as stored.
 */
export function listingThumbnailUrl(photoUrl: string, listingUrl: string, index: number) {
  let url: URL;
  try {
    url = new URL(photoUrl);
  } catch {
    return photoUrl;
  }
  if (!/\/rs:fit:\d+:\d+\//.test(url.pathname)) return photoUrl;
  if (!url.searchParams.has('sig')) {
    url.pathname = url.pathname.replace(/\/rs:fit:\d+:\d+\//, '/rs:fit:320:240/');
    return url.toString();
  }
  const listingId = /\/immobilie\/(\d+)(?:\/|$|\?)/.exec(listingUrl)?.[1];
  if (!listingId || !Number.isInteger(index) || index < 0 || index > 40) return photoUrl;
  return `https://www.ohne-makler.net/immobilie/${listingId}/picture/${index}/medium.jpg`;
}

/**
 * Click target for one photo. The listing page is the usual target.
 * An expired signed file is never the href: use the non-expiring thumbnail,
 * or no link when that thumbnail is expired too.
 */
export function listingPhotoHref(clickUrl: string, displayedUrl: string, now: number) {
  if (!displayedListingPhotoExpired(clickUrl, now)) return clickUrl;
  if (displayedUrl && displayedUrl !== clickUrl && !displayedListingPhotoExpired(displayedUrl, now)) return displayedUrl;
  return undefined;
}

/**
 * Up to 8 absolute https image URLs from og:image, JSON-LD images, gallery
 * <img>/srcset, and lightbox anchors. Query strings are kept verbatim. One
 * forward pass: no regex over the document and no nested quantifiers.
 * Tracking pixels and data: URLs are dropped.
 */
export function extractListingPhotoUrls(html: string) {
  if (!html || !html.includes('<')) return [];
  const source = html.length > MAX_PHOTO_HTML_CHARS ? html.slice(0, MAX_PHOTO_HTML_CHARS) : html;
  if (!mayContainListingPhotos(source)) return [];

  const openGraph: string[] = [];
  const gallery: string[] = [];
  let index = 0;
  while (index < source.length) {
    const open = source.indexOf('<', index);
    if (open < 0) break;
    const tag = readTag(source, open);
    index = tag.next > open ? tag.next : open + 1;
    if (!tag.attrs) continue;
    if (tag.name === 'meta') {
      const property = (tag.attrs.property || tag.attrs.name || '').toLowerCase();
      if (property === 'og:image' || property === 'og:image:url' || property === 'og:image:secure_url') {
        const content = tag.attrs.content;
        if (content) openGraph.push(content);
      }
      continue;
    }
    if (tag.name === 'img' || tag.name === 'source') {
      if (isTrackingPixel(tag.attrs)) continue;
      const chosen = preferredImageUrl(tag.attrs.src || '', tag.attrs.srcset || '');
      if (chosen) gallery.push(chosen);
      continue;
    }
    if (tag.name === 'a') {
      const box = (tag.attrs['data-glightbox'] || '').toLowerCase();
      if ((box.includes('type: image') || box.includes('type:image')) && tag.attrs.href) gallery.push(tag.attrs.href);
    }
  }

  const structured = source.includes('ld+json') || source.includes('LD+JSON') ? jsonLdImageUrls(source) : [];
  return displayableListingPhotos([...openGraph, ...structured, ...gallery]);
}

const STAGING_PHRASE = String.raw`(?<![\p{L}\p{N}])(?:KI[-\s]+generiert(?:e[nrms]?)?|Visualisierung(?:en)?|virtuell\s+gestaged|virtual\s+staging)(?![\p{L}\p{N}])`;
const SAMPLE_PHRASE = String.raw`(?<![\p{L}\p{N}])(?:Beispielbild(?:er)?|Musterbild(?:er)?|Symbolbild(?:er)?)(?![\p{L}\p{N}])`;

function phraseMentioned(text: string, phrase: string) {
  if (!text) return false;
  const expression = new RegExp(phrase, 'giu');
  for (const match of text.matchAll(expression)) {
    const at = match.index ?? 0;
    const before = text.slice(Math.max(0, at - 40), at);
    if (!/(?:kein(?:e(?:m|n|r|s)?)?|nicht|ohne|\bno\b|\bnot\b)/i.test(before)) return true;
  }
  return false;
}

function stagingMentioned(text: string) {
  return phraseMentioned(text, STAGING_PHRASE);
}

function sampleMentioned(text: string) {
  return phraseMentioned(text, SAMPLE_PHRASE);
}

function visibleListingText(source: string) {
  let out = '';
  let cursor = 0;
  while (cursor < source.length) {
    const open = source.indexOf('<', cursor);
    if (open < 0) {
      out += source.slice(cursor);
      break;
    }
    out += `${source.slice(cursor, open)} `;
    const tag = readTag(source, open);
    cursor = tag.next > open ? tag.next : open + 1;
  }
  return out;
}

/**
 * Marks photos whose caption or alt text says they are an AI visualisation.
 * Listing-wide is set only when that phrase is in the text and no displayed
 * photo caption can be tied to it. Image pixels are not inspected.
 */
export function stagedPhotoMarks(html: string, photoUrls: readonly string[]) {
  const indexes = new Set<number>();
  const samples = new Set<number>();
  const source = !html || html.length <= MAX_PHOTO_HTML_CHARS ? html || '' : html.slice(0, MAX_PHOTO_HTML_CHARS);
  if (source.includes('<')) {
    const slots = new Map<string, number>();
    photoUrls.forEach((url, index) => {
      if (!slots.has(url)) slots.set(url, index);
    });
    let cursor = 0;
    while (cursor < source.length) {
      const open = source.indexOf('<', cursor);
      if (open < 0) break;
      const tag = readTag(source, open);
      cursor = tag.next > open ? tag.next : open + 1;
      if (!tag.attrs || (tag.name !== 'img' && tag.name !== 'a')) continue;
      const caption = tag.name === 'img'
        ? `${tag.attrs.alt || ''} ${tag.attrs.title || ''}`
        : `${tag.attrs['data-glightbox'] || ''} ${tag.attrs.title || ''}`;
      const url = (tag.name === 'img'
        ? preferredImageUrl(tag.attrs.src || '', tag.attrs.srcset || '')
        : tag.attrs.href || '').trim();
      const slot = slots.get(url);
      if (!url || slot === undefined) continue;
      if (stagingMentioned(caption)) indexes.add(slot);
      if (sampleMentioned(caption)) samples.add(slot);
    }
  }
  const ordered = [...indexes].sort((left, right) => left - right);
  const sampleOrdered = [...samples].sort((left, right) => left - right);
  const text = visibleListingText(source);
  const marks: { indexes: number[]; listingWide: boolean; sampleIndexes?: number[]; listingWideSample?: boolean } = {
    indexes: ordered,
    listingWide: ordered.length ? false : stagingMentioned(text),
  };
  if (sampleOrdered.length || sampleMentioned(text)) {
    marks.sampleIndexes = sampleOrdered;
    marks.listingWideSample = sampleOrdered.length ? false : true;
  }
  return marks;
}

function mayContainListingPhotos(source: string) {
  return source.includes('<img') || source.includes('<IMG') || source.includes('<Img')
    || source.includes('og:image') || source.includes('og:Image')
    || source.includes('srcset=') || source.includes('srcSet=')
    || source.includes('data-glightbox') || source.includes('data-Glightbox')
    || source.includes('ld+json') || source.includes('LD+JSON');
}

type StartTag = { name: string; attrs: Record<string, string> | null; next: number };

const KEPT_ATTRS = new Set(['src', 'srcset', 'width', 'height', 'href', 'content', 'property', 'name', 'data-glightbox', 'alt', 'title']);

function readTag(source: string, open: number): StartTag {
  const marker = source.charCodeAt(open + 1);
  if (marker === 33) {
    if (source.startsWith('!--', open + 1)) {
      const end = source.indexOf('-->', open + 4);
      return { name: '', attrs: null, next: end < 0 ? source.length : end + 3 };
    }
    return { name: '', attrs: null, next: skipToTagEnd(source, open + 2) };
  }
  if (marker === 47) return { name: '', attrs: null, next: skipToTagEnd(source, open + 2) };

  let cursor = open + 1;
  const nameStart = cursor;
  while (cursor < source.length && cursor - nameStart < 32 && isNameChar(source.charCodeAt(cursor))) cursor += 1;
  if (cursor === nameStart) return { name: '', attrs: null, next: open + 1 };
  const name = source.slice(nameStart, cursor).toLowerCase();
  if (name === 'script' || name === 'style' || name === 'noscript') {
    const startEnd = skipToTagEnd(source, cursor);
    return { name, attrs: null, next: skipElement(source, startEnd, name) };
  }
  const interesting = name === 'img' || name === 'source' || name === 'meta' || name === 'a';
  if (!interesting) return { name, attrs: null, next: skipToTagEnd(source, cursor) };

  let attrs: Record<string, string> | null = null;
  const keep = (attrName: string, raw: string) => {
    if (!raw || !KEPT_ATTRS.has(attrName)) return;
    attrs ??= {};
    attrs[attrName] = decodeAttribute(raw);
  };
  while (cursor < source.length) {
    while (cursor < source.length && isSpace(source.charCodeAt(cursor))) cursor += 1;
    if (cursor >= source.length) break;
    const code = source.charCodeAt(cursor);
    if (code === 62) return { name, attrs, next: cursor + 1 };
    if (code === 60) return { name, attrs, next: cursor };
    if (code === 47 && source.charCodeAt(cursor + 1) === 62) return { name, attrs, next: cursor + 2 };

    const attrStart = cursor;
    while (cursor < source.length && isAttrChar(source.charCodeAt(cursor))) cursor += 1;
    if (cursor === attrStart) {
      cursor += 1;
      continue;
    }
    const attrName = source.slice(attrStart, cursor).toLowerCase();
    while (cursor < source.length && isSpace(source.charCodeAt(cursor))) cursor += 1;
    if (source.charCodeAt(cursor) !== 61) continue;
    cursor += 1;
    while (cursor < source.length && isSpace(source.charCodeAt(cursor))) cursor += 1;
    const quoted = source.charCodeAt(cursor);
    if (quoted === 34 || quoted === 39) {
      const start = cursor + 1;
      const end = source.indexOf(quoted === 34 ? '"' : "'", start);
      if (end < 0) {
        keep(attrName, source.slice(start, start + MAX_ATTR_CHARS));
        return { name, attrs, next: source.length };
      }
      keep(attrName, source.slice(start, Math.min(end, start + MAX_ATTR_CHARS)));
      cursor = end + 1;
    } else {
      const start = cursor;
      while (cursor < source.length) {
        const valueCode = source.charCodeAt(cursor);
        if (isSpace(valueCode) || valueCode === 62 || valueCode === 60) break;
        cursor += 1;
      }
      keep(attrName, source.slice(start, Math.min(cursor, start + MAX_ATTR_CHARS)));
    }
  }
  return { name, attrs, next: cursor };
}

function skipElement(source: string, from: number, name: string) {
  const lower = source.indexOf(`</${name}`, from);
  const upper = source.indexOf(`</${name.toUpperCase()}`, from);
  const at = lower < 0 ? upper : upper < 0 ? lower : Math.min(lower, upper);
  if (at < 0) return source.length;
  return skipToTagEnd(source, at + name.length + 2);
}

function skipToTagEnd(source: string, from: number) {
  let cursor = from;
  while (cursor < source.length) {
    const code = source.charCodeAt(cursor);
    if (code === 62) return cursor + 1;
    if (code === 60) return cursor;
    if (code === 34 || code === 39) {
      const end = source.indexOf(code === 34 ? '"' : "'", cursor + 1);
      if (end < 0) return source.length;
      cursor = end + 1;
      continue;
    }
    cursor += 1;
  }
  return source.length;
}

function isTrackingPixel(attrs: Record<string, string>) {
  const width = statedDimension(attrs.width);
  const height = statedDimension(attrs.height);
  if (width !== undefined && width <= 2) return true;
  if (height !== undefined && height <= 2) return true;
  return false;
}

function statedDimension(value: string | undefined) {
  if (!value) return undefined;
  let number = 0;
  let seen = false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 48 && code <= 57) {
      seen = true;
      number = number * 10 + (code - 48);
      if (number > 10_000) return number;
      continue;
    }
    if (seen) break;
    if (code !== 32) return undefined;
  }
  return seen ? number : undefined;
}

function preferredImageUrl(src: string, srcset: string) {
  if (src && !src.startsWith('data:') && isDisplayableListingPhoto(src)) return src;
  return firstDisplayableSrcsetUrl(srcset);
}

function firstDisplayableSrcsetUrl(srcset: string) {
  let index = 0;
  while (index < srcset.length) {
    while (index < srcset.length && (isSpace(srcset.charCodeAt(index)) || srcset.charCodeAt(index) === 44)) index += 1;
    const start = index;
    while (index < srcset.length && !isSpace(srcset.charCodeAt(index)) && srcset.charCodeAt(index) !== 44) index += 1;
    const candidate = srcset.slice(start, index);
    if (candidate && isDisplayableListingPhoto(candidate)) return candidate;
    while (index < srcset.length && srcset.charCodeAt(index) !== 44) index += 1;
  }
  return '';
}

/**
 * Bounded JSON-LD walk matching listing-parser's `jsonLdObjects` scan:
 * indexOf the marker, require a nearby script tag, cap the body, then parse.
 */
function jsonLdImageUrls(raw: string) {
  const urls: string[] = [];
  const lower = raw.toLowerCase();
  let from = 0;
  let blocks = 0;
  while (blocks < MAX_JSON_LD_BLOCKS && from < raw.length && urls.length < MAX_PHOTOS) {
    const marker = lower.indexOf('application/ld+json', from);
    if (marker < 0) break;
    const start = lower.lastIndexOf('<script', marker);
    const tagEnd = raw.indexOf('>', marker);
    if (start < 0 || tagEnd < 0 || marker - start > 500 || tagEnd - start > 500) {
      from = marker + 20;
      continue;
    }
    const close = lower.indexOf('</script>', tagEnd);
    if (close < 0) break;
    const body = raw.slice(tagEnd + 1, close);
    from = close + 9;
    blocks += 1;
    if (!body || body.length > MAX_JSON_LD_BODY) continue;
    try {
      collectJsonImages(JSON.parse(decodeAttribute(body)) as unknown, urls, 0);
    } catch {
      // Invalid third-party JSON-LD must not break photo extraction.
    }
  }
  return urls;
}

function collectJsonImages(value: unknown, urls: string[], depth: number) {
  if (depth > 8 || urls.length >= 24 || value == null || typeof value === 'string') return;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string') urls.push(item);
      else collectJsonImages(item, urls, depth + 1);
    }
    return;
  }
  if (typeof value !== 'object') return;
  const object = value as Record<string, unknown>;
  const type = object['@type'];
  const types = Array.isArray(type) ? type : [type];
  const imageObject = types.some((item) => typeof item === 'string' && item.toLowerCase() === 'imageobject');
  if (imageObject) {
    if (typeof object.contentUrl === 'string') urls.push(object.contentUrl);
    else if (typeof object.url === 'string') urls.push(object.url);
  }
  if (typeof object.thumbnailUrl === 'string') urls.push(object.thumbnailUrl);
  if (typeof object.image === 'string') urls.push(object.image);
  else if (object.image) collectJsonImages(object.image, urls, depth + 1);
  for (const [key, child] of Object.entries(object)) {
    if (key === 'image' || key === 'thumbnailUrl' || key === 'contentUrl' || key === 'url' || key === '@type') continue;
    if (child && typeof child === 'object') collectJsonImages(child, urls, depth + 1);
  }
}

function decodeAttribute(value: string) {
  if (!value.includes('&')) return value;
  let out = '';
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 38) {
      out += value[index];
      continue;
    }
    const semi = value.indexOf(';', index + 1);
    if (semi < 0 || semi - index > 12) {
      out += '&';
      continue;
    }
    const code = value.slice(index + 1, semi);
    if (code.startsWith('#')) {
      const hex = code[1] === 'x' || code[1] === 'X';
      const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      out += Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : value.slice(index, semi + 1);
    } else {
      out += ENTITIES[code] ?? ENTITIES[code.toLowerCase()] ?? value.slice(index, semi + 1);
    }
    index = semi;
  }
  return out;
}

function isSpace(code: number) {
  return code === 32 || code === 9 || code === 10 || code === 13 || code === 12;
}

function isNameChar(code: number) {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isAttrChar(code: number) {
  return isNameChar(code) || (code >= 48 && code <= 57) || code === 45 || code === 58 || code === 95;
}
