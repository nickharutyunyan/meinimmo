const REPORT_ID = /^[A-Za-z0-9_-]{8,80}$/;

export function normalizePathname(pathname) {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

/** Next.js client navigations and prefetches. Those must reach the Next handler. */
export function isRouterDataRequest(headers, searchParams) {
  if (searchParams.has('_rsc')) return true;
  if (headers.get('rsc') === '1') return true;
  if (headers.has('next-router-prefetch')) return true;
  if (headers.has('next-router-segment-prefetch')) return true;
  if (headers.has('next-router-state-tree')) return true;
  const accept = headers.get('accept') || '';
  return accept.includes('text/x-component');
}

export function isPersonalDocument(pathname) {
  const path = normalizePathname(pathname || '/');
  return path === '/account' || path.startsWith('/account/')
    || path === '/auth' || path.startsWith('/auth/')
    || path === '/de/account' || path.startsWith('/de/account/')
    || path === '/de/auth' || path.startsWith('/de/auth/');
}

export function isCacheableDocument(method, pathname, headers, searchParams) {
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (isRouterDataRequest(headers, searchParams)) return false;
  const path = normalizePathname(pathname);
  if (path === '/api' || path.startsWith('/api/')) return false;
  if (path.startsWith('/_next/') || path.startsWith('/cdn-cgi/')) return false;
  if (path.startsWith('/downloads/')) return false;
  return true;
}

/** Immutable report document, excluding print. Empty when the path is not one. */
export function reportDocumentId(pathname) {
  const path = normalizePathname(pathname);
  const match = path.match(/^\/(?:de\/)?r\/([^/]+)$/);
  if (!match || !REPORT_ID.test(match[1])) return '';
  return match[1];
}

/** Market listing document, `/l/{id}` or `/de/l/{id}`. Empty when the path is not one. */
export function listingDocumentId(pathname) {
  const path = normalizePathname(pathname);
  const match = path.match(/^\/(?:de\/)?l\/([0-9a-f]{12})$/);
  return match ? match[1] : '';
}

/** Documents served through the shared HTML cache: reports and market listings. */
export function cachedDocumentId(pathname) {
  return reportDocumentId(pathname) || listingDocumentId(pathname);
}

/** English at `/`, German at `/de`. Other country paths stay English. */
export function documentLanguage(pathname) {
  const path = normalizePathname(pathname || '/');
  return path === '/de' || path.startsWith('/de/') ? 'de' : 'en';
}

/** Set `<html lang>` for the URL. Idempotent, and a no-op for non-HTML. */
export function applyDocumentLanguage(html, pathname) {
  if (typeof html !== 'string' || !html.includes('<html')) return html;
  const lang = documentLanguage(pathname);
  if (/\blang=["'][^"']*["']/i.test(html.slice(html.indexOf('<html'), html.indexOf('<html') + 80))) {
    return html.replace(/(<html\b[^>]*\blang=["'])[^"']*(["'])/i, `$1${lang}$2`);
  }
  return html.replace(/<html\b/i, `<html lang="${lang}"`);
}

export function pathnameForPublishedAsset(assetRelative) {
  const normalized = String(assetRelative || '').replace(/\\/g, '/');
  if (normalized === 'index.html') return '/';
  if (normalized.endsWith('/index.html')) return `/${normalized.slice(0, -'/index.html'.length)}`;
  if (normalized.endsWith('.html')) return `/${normalized.slice(0, -'.html'.length)}`;
  return `/${normalized}`;
}

export function assetPathForPathname(pathname) {
  const path = normalizePathname(pathname);
  if (path === '/') return '/index.html';
  if (/\.(xml|txt|svg|ico|html)$/i.test(path)) return path;
  return `${path}/index.html`;
}

/** Map an OpenNext cache file, relative to the build-id directory, onto an asset path. */
export function cacheFileToAssetPath(cacheRelativePath) {
  const route = cacheRelativePath.replace(/\\/g, '/').replace(/\.cache$/, '');
  const base = route.split('/').pop() || '';
  if (!route || base.startsWith('_')) return null;
  if (route === 'index') return 'index.html';
  if (/\.(xml|txt|svg|ico)$/i.test(route)) return route;
  return `${route}/index.html`;
}

/**
 * Cookie names this app sets, and a CSRF field name if one is rendered.
 * A bare "csrf" substring is not a session: signed photo URLs contain it.
 */
const PRIVATE_HTML = /(?:^|[^A-Za-z0-9_])(?:rah_session|rah_google_oauth)(?![A-Za-z0-9_])|name=(?:"csrf"|'csrf'|csrf(?=[\s>/]))/i;

/**
 * Report HTML is safe to share across viewers when it has no session marker
 * and no signed-in account menu. Notes and the sign-in label are filled in
 * the browser after the document loads.
 */
export function reportHtmlIsShared(html) {
  if (typeof html !== 'string' || html.length === 0) return false;
  if (PRIVATE_HTML.test(html)) return false;
  if (html.includes('class="account-menu"') || html.includes('class="account-status"')) return false;
  return true;
}
