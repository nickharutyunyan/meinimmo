/**
 * Image CDNs whose listing photos may be shown in a report.
 * This is the only list added to Content-Security-Policy `img-src`.
 * A new portal's photos stay invisible until its image host is added here.
 */
export const LISTING_IMAGE_HOSTS = ['https://media.ohne-makler.net'] as const;

const LISTING_IMAGE_HOST_NAMES = LISTING_IMAGE_HOSTS.map((entry) => entry.slice(entry.indexOf('://') + 3).toLowerCase());

export function listingImageHostAllowed(url: URL) {
  if (url.protocol !== 'https:') return false;
  const host = url.host.toLowerCase();
  return LISTING_IMAGE_HOST_NAMES.some((allowed) => host === allowed);
}
