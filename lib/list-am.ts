/** Language-neutral listing identity; never infer another property's URL. */
export function listAmUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (!['list.am', 'www.list.am'].includes(url.hostname) || url.username || url.password || url.port || !['http:', 'https:'].includes(url.protocol)) return;
    const id = url.pathname.match(/^\/(?:(?:en|am|hy|ru)\/)?item\/(\d+)\/?$/i)?.[1];
    return id ? `https://www.list.am/en/item/${id}` : undefined;
  } catch { return; }
}

export class ListAmImportError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status = 422) { super(message); this.code = code; this.status = status; }
}

/** One bounded import, always in English, with same-listing redirects only. */
export async function fetchEnglishListAm(value: string, fetcher: typeof fetch = fetch) {
  const canonical = listAmUrl(value);
  if (!canonical) throw new ListAmImportError('Enter a valid List.am property listing link.', 'invalid_listing_url', 400);
  let target = canonical;
  const visited = new Set<string>();
  const signal = AbortSignal.timeout(8000);
  try {
    for (let hop = 0; hop < 4; hop++) {
      if (visited.has(target)) break;
      visited.add(target);
      const response = await fetcher(target, { redirect: 'manual', signal, headers: { Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9' } });
      if ([301,302,303,307,308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        const next = location ? new URL(location, target) : null;
        // Do not follow external redirects, different adverts or login pages.
        if (!next || listAmUrl(next.href) !== canonical) break;
        next.protocol = 'https:';
        next.pathname = new URL(canonical).pathname;
        next.search = ''; next.hash = '';
        target = next.href;
        continue;
      }
      if (response.status === 404 || response.status === 410) {
        await response.body?.cancel();
        throw new ListAmImportError('This listing is no longer available on List.am.', 'listing_unavailable');
      }
      if (!response.ok) { await response.body?.cancel(); break; }
      const reader = response.body?.getReader();
      if (!reader) break;
      let size = 0; let html = ''; const decoder = new TextDecoder();
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        if (size > 2_000_000) { await reader.cancel(); throw new ListAmImportError('The listing page exceeds the supported size.', 'source_too_large', 413); }
        html += decoder.decode(part.value, { stream: true });
      }
      html += decoder.decode();
      if (!/<h1\b/i.test(html) && /captcha|just a moment|access denied|verify (?:you|that you)|cf-chl-/i.test(html)) break;
      return { source: canonical, html };
    }
  } catch (error) {
    if (error instanceof ListAmImportError) throw error;
    throw new ListAmImportError('The English listing could not be reached. No report was created.', 'source_unavailable', 502);
  }
  throw new ListAmImportError('We switched to the English listing automatically, but List.am blocked access. No report was created.', 'source_blocked');
}
