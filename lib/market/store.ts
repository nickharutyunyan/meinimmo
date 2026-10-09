import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { withTimeout } from '../io-timeout.ts';
import { constantTimeEqual, randomToken, sha256Hex } from '../security.ts';
import { berlinDay } from '../berlin-time.ts';
import { invalidateListingHtml } from '../report-html-cache.ts';
import type { Listing, ListingSummary, MarketSlug } from './types.ts';
import { listingSummary } from './validate.ts';
import { moderationOf } from './moderation.ts';

async function database() {
  const { env } = await withTimeout(getCloudflareContext({ async: true }));
  if (!env.DB) throw new Error('The Cloudflare D1 binding "DB" is not configured.');
  return env.DB;
}

/** True when migration 0006 has not been applied yet, so pages can render an empty market instead of failing. */
export function missingListingTables(error: unknown) {
  return error instanceof Error && /no such table: listing/i.test(error.message);
}

export function newListingId() {
  // 12 hex characters: short enough for a shared link, long enough not to be guessed.
  return [...crypto.getRandomValues(new Uint8Array(6))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

type Row = { data: string; edit_token_hash: string | null };

function parse(row: Row | null) {
  return row ? JSON.parse(row.data) as Listing : undefined;
}

export async function getListing(id: string) {
  if (!/^[0-9a-f]{12}$/.test(id)) return undefined;
  const db = await database();
  return parse(await db.prepare('SELECT data, edit_token_hash FROM listings WHERE id = ?1').bind(id).first<Row>());
}

export async function listingBySourceUrl(url: string) {
  const db = await database();
  return parse(await db.prepare('SELECT data, edit_token_hash FROM listings WHERE source_url = ?1').bind(url).first<Row>());
}

/** Checks the private edit token a seller holds. Imported listings have none and cannot be edited this way. */
export async function canEditListing(id: string, token: string | null | undefined) {
  if (!token || !/^[0-9a-f]{12}$/.test(id)) return false;
  const db = await database();
  const row = await db.prepare('SELECT edit_token_hash FROM listings WHERE id = ?1').bind(id).first<{ edit_token_hash: string | null }>();
  if (!row?.edit_token_hash) return false;
  return constantTimeEqual(row.edit_token_hash, await sha256Hex(token));
}

/** Hash of a contact email, for counting listings per seller without querying raw addresses. */
export async function contactEmailHash(email: string) {
  const value = email.trim().toLowerCase();
  return value ? (await sha256Hex(`listing-contact:${value}`)).slice(0, 40) : null;
}

async function columns(listing: Listing) {
  return [
    listing.status,
    listing.origin,
    listing.market,
    listing.propertyType,
    listing.facts.price || null,
    listing.facts.area || listing.facts.plotArea || null,
    listing.geo?.lat ?? null,
    listing.geo?.lon ?? null,
    listing.sourceUrl,
    listing.reportId,
    JSON.stringify(listing),
    listing.updatedAt,
    listing.publishedAt,
    moderationOf(listing).state,
    await contactEmailHash(listing.contact.email),
  ] as const;
}

/** Inserts a listing. Seller listings get a private edit token, returned once and stored only as a hash. */
export async function insertListing(listing: Listing, withEditToken: boolean) {
  const db = await database();
  const token = withEditToken ? randomToken(24) : null;
  await db.prepare(`
    INSERT INTO listings (id, status, origin, market, property_type, price, area, lat, lon, source_url, report_id, data, updated_at, published_at, moderation, contact_email_hash, edit_token_hash, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
  `).bind(listing.id, ...await columns(listing), token ? await sha256Hex(token) : null, listing.createdAt).run();
  return token;
}

export async function saveListing(listing: Listing) {
  const db = await database();
  await db.prepare(`
    UPDATE listings SET status = ?2, origin = ?3, market = ?4, property_type = ?5, price = ?6, area = ?7, lat = ?8, lon = ?9,
      source_url = ?10, report_id = ?11, data = ?12, updated_at = ?13, published_at = ?14, moderation = ?15, contact_email_hash = ?16
    WHERE id = ?1
  `).bind(listing.id, ...await columns(listing)).run();
  await invalidateListingHtml(listing.id);
}

/** Every published listing in one city, newest first. A city holds hundreds, not millions, so the client filters. */
export async function publishedSummaries(market: MarketSlug | 'other' | undefined, locale: 'en' | 'de'): Promise<ListingSummary[]> {
  const db = await database();
  try {
    const query = market === 'other'
      ? db.prepare("SELECT data, edit_token_hash FROM listings WHERE status = 'published' AND (moderation IS NULL OR moderation IN ('none', 'approved')) AND market IS NULL ORDER BY published_at DESC LIMIT 500")
      : market
        ? db.prepare("SELECT data, edit_token_hash FROM listings WHERE status = 'published' AND (moderation IS NULL OR moderation IN ('none', 'approved')) AND market = ?1 ORDER BY published_at DESC LIMIT 500").bind(market)
        : db.prepare("SELECT data, edit_token_hash FROM listings WHERE status = 'published' AND (moderation IS NULL OR moderation IN ('none', 'approved')) ORDER BY published_at DESC LIMIT 500");
    const { results } = await query.all<Row>();
    return results.map(row => listingSummary(JSON.parse(row.data) as Listing, locale));
  } catch (error) {
    if (missingListingTables(error)) return [];
    throw error;
  }
}

export async function marketCounts(): Promise<Record<string, number>> {
  const db = await database();
  try {
    const { results } = await db.prepare("SELECT COALESCE(market, 'other') AS market, COUNT(*) AS count FROM listings WHERE status = 'published' AND (moderation IS NULL OR moderation IN ('none', 'approved')) GROUP BY market").all<{ market: string; count: number }>();
    return Object.fromEntries(results.map(row => [row.market, row.count]));
  } catch (error) {
    if (missingListingTables(error)) return {};
    throw error;
  }
}

export type StoredPhoto = { contentType: string; bytes: ArrayBuffer; width: number; height: number };

export async function insertPhoto(listingId: string, photoId: string, variants: { full: StoredPhoto; thumb: StoredPhoto }, now: string) {
  const db = await database();
  const insert = (variant: 'full' | 'thumb', photo: StoredPhoto) => db.prepare(`
    INSERT INTO listing_photos (id, listing_id, variant, content_type, bytes, width, height, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
  `).bind(photoId, listingId, variant, photo.contentType, photo.bytes, photo.width, photo.height, now);
  await db.batch([insert('full', variants.full), insert('thumb', variants.thumb)]);
}

export async function readPhoto(listingId: string, photoId: string, variant: 'full' | 'thumb') {
  const db = await database();
  const row = await db.prepare('SELECT content_type, bytes FROM listing_photos WHERE id = ?1 AND listing_id = ?2 AND variant = ?3')
    .bind(photoId, listingId, variant).first<{ content_type: string; bytes: ArrayBuffer | number[] }>();
  if (!row) return undefined;
  const bytes = row.bytes instanceof ArrayBuffer ? new Uint8Array(row.bytes) : new Uint8Array(row.bytes);
  return { contentType: row.content_type, bytes };
}

export async function deletePhoto(listingId: string, photoId: string) {
  const db = await database();
  await db.prepare('DELETE FROM listing_photos WHERE id = ?1 AND listing_id = ?2').bind(photoId, listingId).run();
}

/**
 * Counts one action for a hashed client today and says whether it is still within the limit.
 * The counter is per Berlin day, so it resets at midnight like the report quota.
 */
export async function takeDailySlot(subject: string, kind: 'draft' | 'photo' | 'publish' | 'report', limit: number, now = new Date()) {
  const db = await database();
  const day = berlinDay(now);
  const row = await db.prepare(`
    INSERT INTO listing_rate (subject, day, kind, count) VALUES (?1, ?2, ?3, 1)
    ON CONFLICT (subject, day, kind) DO UPDATE SET count = count + 1
    RETURNING count
  `).bind(subject, day, kind).first<{ count: number }>();
  return (row?.count ?? 1) <= limit;
}

/** Seller listings published with this contact email in the last 30 days, other than this one. */
export async function recentListingsForEmail(email: string, exceptId: string, now = new Date()) {
  const hash = await contactEmailHash(email);
  if (!hash) return 0;
  const db = await database();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const row = await db.prepare(`
    SELECT COUNT(*) AS count FROM listings
    WHERE contact_email_hash = ?1 AND origin = 'seller' AND id != ?2 AND published_at IS NOT NULL AND published_at > ?3
  `).bind(hash, exceptId, since).first<{ count: number }>();
  return row?.count ?? 0;
}

export async function saveEmailCode(listingId: string, email: string, codeHash: string, expiresAt: string, now: string) {
  const db = await database();
  await db.prepare(`
    INSERT INTO listing_email_codes (listing_id, email, code_hash, attempts, expires_at, created_at) VALUES (?1, ?2, ?3, 0, ?4, ?5)
    ON CONFLICT (listing_id) DO UPDATE SET email = excluded.email, code_hash = excluded.code_hash, attempts = 0, expires_at = excluded.expires_at, created_at = excluded.created_at
  `).bind(listingId, email, codeHash, expiresAt, now).run();
}

/** Counts one guess and returns the stored code for comparison. Five guesses per code. */
export async function takeEmailCodeAttempt(listingId: string) {
  const db = await database();
  return db.prepare(`
    UPDATE listing_email_codes SET attempts = attempts + 1 WHERE listing_id = ?1
    RETURNING email, code_hash, attempts, expires_at
  `).bind(listingId).first<{ email: string; code_hash: string; attempts: number; expires_at: string }>();
}

export async function deleteEmailCode(listingId: string) {
  const db = await database();
  await db.prepare('DELETE FROM listing_email_codes WHERE listing_id = ?1').bind(listingId).run();
}

export type ReportReason = 'spam' | 'scam' | 'wrong' | 'unavailable' | 'other';

/** Stores a buyer report once per reporter and returns how many distinct reporters there are. */
export async function addReport(listingId: string, reporterHash: string, reason: ReportReason, note: string, now: string) {
  const db = await database();
  await db.prepare(`
    INSERT INTO listing_reports (listing_id, reporter_hash, reason, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5)
    ON CONFLICT (listing_id, reporter_hash) DO UPDATE SET reason = excluded.reason, note = excluded.note, created_at = excluded.created_at
  `).bind(listingId, reporterHash, reason, note || null, now).run();
  const row = await db.prepare('SELECT COUNT(*) AS count FROM listing_reports WHERE listing_id = ?1').bind(listingId).first<{ count: number }>();
  return row?.count ?? 1;
}

export type QueueItem = { listing: Listing; reports: Array<{ reason: ReportReason; note: string | null; createdAt: string }> };

/** Listings waiting for a person: held at publish, hidden after reports, or live with any report. */
export async function moderationQueue(): Promise<QueueItem[]> {
  const db = await database();
  const { results } = await db.prepare(`
    SELECT data FROM listings
    WHERE status = 'published' AND (moderation IN ('pending', 'hidden') OR id IN (SELECT listing_id FROM listing_reports))
    ORDER BY CASE moderation WHEN 'hidden' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, updated_at DESC
    LIMIT 100
  `).all<{ data: string }>();
  const listings = results.map(row => JSON.parse(row.data) as Listing);
  if (!listings.length) return [];
  const { results: reports } = await db.prepare(`
    SELECT listing_id, reason, note, created_at FROM listing_reports
    WHERE listing_id IN (${listings.map((_, index) => `?${index + 1}`).join(', ')})
    ORDER BY created_at DESC
  `).bind(...listings.map(listing => listing.id)).all<{ listing_id: string; reason: ReportReason; note: string | null; created_at: string }>();
  return listings.map(listing => ({
    listing,
    reports: reports.filter(report => report.listing_id === listing.id).map(report => ({ reason: report.reason, note: report.note, createdAt: report.created_at })),
  }));
}

/** A moderator's decision closes the reports that led to it. */
export async function clearReports(listingId: string) {
  const db = await database();
  await db.prepare('DELETE FROM listing_reports WHERE listing_id = ?1').bind(listingId).run();
}
