import { LISTING_IMAGE_HOSTS, LISTING_THUMBNAIL_HOSTS } from './listing-image-hosts.ts';

const listingImageSources = [...LISTING_IMAGE_HOSTS, ...LISTING_THUMBNAIL_HOSTS].join(' ');

/** Existing policy, plus the listing-photo CDN hosts and the OpenStreetMap tile server on img-src only. */
export const CONTENT_SECURITY_POLICY = `default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://cdnjs.cloudflare.com; worker-src 'self' blob: https://cdnjs.cloudflare.com; connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com; frame-src 'self' https://www.openstreetmap.org https://*.stripe.com; img-src 'self' data: blob: https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://tile.openstreetmap.org ${listingImageSources}; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`;
