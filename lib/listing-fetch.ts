import { publicListingUrl } from './security.ts';

export class ListingFetchError extends Error {
  code: 'blocked' | 'unavailable' | 'too_large' | 'timeout' | 'invalid';
  constructor(code: ListingFetchError['code']) { super(code); this.code = code; }
}

export async function fetchListing(source: string, fetcher: typeof fetch = fetch, timeoutMs = 15_000) {
  let url = publicListingUrl(source);
  if (!url) throw new ListingFetchError('invalid');
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    for (let redirects = 0; redirects <= 5; redirects++) {
      const response: Response = await fetcher(url, { headers: { 'user-agent': 'ReviewAHouse/1.0 (+property assessment)' }, redirect: 'manual', signal });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const target: string | null = response.headers.get('location');
        await response.body?.cancel();
        url = target ? publicListingUrl(new URL(target, url).href) : undefined;
        if (!url) throw new ListingFetchError('invalid');
        continue;
      }
      if ([401, 403, 429].includes(response.status)) throw new ListingFetchError('blocked');
      if (!response.ok) throw new ListingFetchError('unavailable');
      if (Number(response.headers.get('content-length')) > 2_000_000) throw new ListingFetchError('too_large');
      const reader = response.body?.getReader();
      if (!reader) return '';
      const decoder = new TextDecoder(); let text = ''; let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return text + decoder.decode();
        size += value.byteLength;
        if (size > 2_000_000) { await reader.cancel(); throw new ListingFetchError('too_large'); }
        text += decoder.decode(value, { stream: true });
      }
    }
    throw new ListingFetchError('unavailable');
  } catch (error) {
    if (error instanceof ListingFetchError) throw error;
    throw new ListingFetchError(signal.aborted ? 'timeout' : 'unavailable');
  }
}
