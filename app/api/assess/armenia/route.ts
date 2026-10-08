import { NextRequest, NextResponse, after } from 'next/server';
import { listAmUrl, parseArmeniaListing } from '@/lib/armenia-parser';
import { armeniaFx } from '@/lib/armenia-market-data';
import { stableReportId } from '@/lib/report-id';
import { report as findReport, saveReport } from '@/lib/store';
import { anonymousToken, attachAnonymousCookie, requireSameOrigin } from '@/lib/auth';
import { reserveReportAllowance, rememberUserReport } from '@/lib/access';
import { cleanPdfDisplayName, hasPdfSignature, MAX_PDF_BYTES } from '@/lib/pdf-source';
import { saveSourcePdf } from '@/lib/source-storage';
import { fetchEnglishListAm, ListAmImportError } from '@/lib/list-am';
import { attachReportGeocode } from '@/lib/geocode-runtime';

export async function POST(request: NextRequest) {
  const anonymous = anonymousToken(request);
  const respond = (body: unknown, status = 200) => {
    const response = NextResponse.json(body, { status });
    attachAnonymousCookie(response, request, anonymous);
    return response;
  };
  if (!requireSameOrigin(request)) return respond({ error: 'Invalid request origin.' }, 403);
  const multipart = request.headers.get('content-type')?.includes('multipart/form-data');
  if (Number(request.headers.get('content-length') || 0) > (multipart ? MAX_PDF_BYTES + 250_000 : 250_000)) return respond({ error: 'The submitted listing is too large.' }, 413);
  let allowance: Awaited<ReturnType<typeof reserveReportAllowance>> | undefined;
  try {
    let input: { url?: string; text?: string; name?: string; browserImport?: boolean };
    let pdf: File | undefined;
    if (multipart) {
      const form = await request.formData();
      input = { text: String(form.get('text') || ''), name: String(form.get('name') || '') };
      const file = form.get('file');
      if (file && typeof file !== 'string') pdf = file;
      if (!pdf || pdf.size > MAX_PDF_BYTES || !hasPdfSignature(new Uint8Array(await pdf.slice(0, 5).arrayBuffer()))) return respond({ error: 'Upload a valid PDF no larger than 15 MB.' }, 400);
    } else input = await request.json();
    if (typeof input.text !== 'undefined' && typeof input.text !== 'string' || typeof input.url !== 'undefined' && typeof input.url !== 'string') return respond({ error: 'Invalid listing input.' }, 400);
    let text = input.text?.trim() || '';
    if (text.length > 200_000) return respond({ error: 'The listing text is too long.' }, 413);
    let source = cleanPdfDisplayName(input.name?.slice(0, 200) || 'Pasted listing');
    const url = input.url ? listAmUrl(input.url) : undefined;
    if (input.url && !url) return respond({ error: 'For this prototype, use a List.am property listing URL (not a search page).' }, 400);
    if (url) source = url;
    // Browser input is still untrusted text, not authenticated source evidence.
    if (input.browserImport && (!url || !text)) return respond({ error: 'The browser import is missing its listing URL or text.' }, 400);
    const method = pdf ? 'pdf' : text ? input.browserImport === true ? 'browser' : 'text' : 'url';
    if (!text && url) {
      text = (await fetchEnglishListAm(url)).html;
    }
    if (!text) return respond({ error: 'Add a listing URL or paste the full English listing text.' }, 400);
    // Validate before fetching FX or reserving allowance. Identity FX only for
    // preliminary validation; it is never saved or returned to the visitor.
    const preliminary = parseArmeniaListing(text, source, { date: '', rates: { USD: 1, EUR: 1, RUB: 1 }, sourceUrl: '' }, method);
    const fx = preliminary.armenia?.originalCurrency === 'AMD' ? undefined : await armeniaFx().catch(() => undefined);
    const item = parseArmeniaListing(text, source, fx, method);
    // User-supplied text must not overwrite a shared URL-import report, or a
    // different user's version of the same advert. Sidebar dedupes by URL.
    item.id = await stableReportId(`AM:${method}:${source}`, text);
    const previous = await findReport(item.id);
    item.createdAt = previous?.createdAt || item.createdAt;
    allowance = await reserveReportAllowance(request, anonymous.token);
    if (!allowance.allowed) return respond({ error: 'You have reached your report limit.', code: 'quota_exceeded', access: allowance.state }, 402);
    if (pdf) {
      const displayName = cleanPdfDisplayName(pdf.name);
      const saved = await saveSourcePdf(item.id, await pdf.arrayBuffer(), displayName).catch(() => false);
      // Reading a PDF does not depend on optional original-file storage.
      // The Source section explicitly explains when no download was retained.
      if (saved) item.sourceFile = { displayName, size: pdf.size };
    }
    const geocoded = await attachReportGeocode(item);
    await saveReport(geocoded);
    const userId = allowance.userId;
    if (userId) after(() => rememberUserReport(userId, item.id));
    return respond(geocoded, 201);
  } catch (error) {
    await allowance?.release?.();
    if (error instanceof ListAmImportError) return respond({ error: error.message, code: error.code }, error.status);
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('Use the English')) return respond({ error: 'We could not verify the property details from the supplied source. No report was created.', code: 'unreadable_listing' }, 422);
    const safe = /^(Use the English|This is not|The asking|A valid area|The official CBA|The location)/.test(message);
    return respond({ error: safe ? message : 'The listing could not be imported. Please try pasting the full English listing text.' }, safe ? 422 : 502);
  }
}
