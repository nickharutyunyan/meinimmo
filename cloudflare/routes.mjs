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
 * Report HTML is safe to share across viewers when it has no session marker
 * and no signed-in account menu. Notes and the sign-in label are filled in
 * the browser after the document loads.
 */
export function reportHtmlIsShared(html) {
  if (typeof html !== 'string' || html.length === 0) return false;
  if (/rah_session|rah_google_oauth|csrf/i.test(html)) return false;
  if (html.includes('class="account-menu"') || html.includes('class="account-status"')) return false;
  return true;
}
