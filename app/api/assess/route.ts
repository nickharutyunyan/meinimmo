import { after, NextRequest, NextResponse } from 'next/server';
import { defaultOfferQuestions, deterministicAssessment, looksLikeListing } from '@/lib/assessment';
import { report as findReport, replaceReport, saveReport, saveReportSource } from '@/lib/store';
import { resolveLocation } from '@/lib/display';
import { rememberUserReport, reserveReportAllowance } from '@/lib/access';
import { anonymousToken, attachAnonymousCookie, requireSameOrigin } from '@/lib/auth';
import { publicListingUrl } from '@/lib/security';
import { stableReportId } from '@/lib/report-id';
import { neighborhoodForPostalCode } from '@/lib/geocode';
import { refreshDerivedReport, unsupportedListingReason } from '@/lib/listing-parser';
import { cleanPdfDisplayName, hasPdfSignature, MAX_PDF_BYTES } from '@/lib/pdf-source';
import { deleteSourcePdf, saveSourcePdf } from '@/lib/source-storage';
import { categorizeProperty } from '@/lib/jev';
import { EXTRACTION_VERSION } from '@/lib/report-integrity';
import { fetchListing, listingImportStatus, ListingFetchError } from '@/lib/listing-fetch';
import { verifyReportFacts } from '@/lib/fact-verification';

export const runtime = 'nodejs';

const MAX_SOURCE_TEXT_LENGTH = 2_000_000;

export async function POST(request: NextRequest) {
  const startedAt = performance.now();
  const timings = new Map<string, number>();
  const timed = async <T,>(name: string, task: () => Promise<T> | T) => {
    const started = performance.now();
    try { return await task(); } finally { timings.set(name, (timings.get(name) || 0) + performance.now() - started); }
  };
  const anonymous = anonymousToken(request);
  const respond = (body: unknown, status = 200) => {
    const response = NextResponse.json(body, { status });
    attachAnonymousCookie(response, request, anonymous);
    timings.set('total', performance.now() - startedAt);
    response.headers.set('Server-Timing', [...timings].map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`).join(', '));
    return response;
  };
  const remember = (userId: string | undefined, id: string) => {
    if (userId) after(() => rememberUserReport(userId, id));
  };
  const categorizeLater = (candidate: NonNullable<Awaited<ReturnType<typeof findReport>>>) => {
    if (!candidate.taxonomyEvidence) return;
    after(async () => {
      try {
        const categorized = await categorizeProperty(candidate);
        if (categorized === candidate || !categorized.jevCategorized || !categorized.taxonomy) return;
        const latest = await findReport(candidate.id);
        if (latest?.extractionVersion !== candidate.extractionVersion || latest?.sourceReviewAttemptedAt !== candidate.sourceReviewAttemptedAt) return;
        await replaceReport({
          ...categorized,
          offerQuestions: latest?.offerQuestions || categorized.offerQuestions,
          offerQuestionsDe: latest?.offerQuestionsDe || categorized.offerQuestionsDe,
          aiEnriched: latest?.aiEnriched || categorized.aiEnriched,
        });
      } catch (error) {
        console.warn('Background property categorization failed', { message: error instanceof Error ? error.message : 'unknown error' });
      }
    });
  };

  if (!requireSameOrigin(request)) return respond({ error: 'Invalid request origin.' }, 403);
  const contentType = request.headers.get('content-type')?.toLowerCase() || '';
  const declaredRequestLength = Number(request.headers.get('content-length') || 0);
  const requestLimit = contentType.startsWith('multipart/form-data') ? MAX_PDF_BYTES + 2_000_000 : 1_000_000;
  if (declaredRequestLength > requestLimit) return respond({ error: 'The submitted file or listing is too large.' }, 413);
  const verifyLater = (candidate: Awaited<ReturnType<typeof findReport>> & object, sourceText: string) => {
    after(async () => {
      try {
        let prepared = candidate;
        if (!prepared.facts.street && !prepared.facts.district && prepared.facts.postalCode) {
          const neighborhood = await neighborhoodForPostalCode(prepared.facts.postalCode, prepared.facts.city);
          if (neighborhood) {
            prepared = refreshDerivedReport({
              ...prepared,
              location: neighborhood,
              facts: { ...prepared.facts, district: neighborhood, locationPrecision: 'neighborhood' },
            });
            const latest = await findReport(prepared.id);
            if (latest?.extractionVersion !== candidate.extractionVersion || latest?.sourceReviewAttemptedAt !== candidate.sourceReviewAttemptedAt) return;
            await replaceReport({
              ...prepared,
              offerQuestions: latest?.offerQuestions || prepared.offerQuestions,
              offerQuestionsDe: latest?.offerQuestionsDe || prepared.offerQuestionsDe,
              aiEnriched: latest?.aiEnriched || prepared.aiEnriched,
            });
          }
        }
        // Taxonomy v2 reads immutable source excerpts, not generated facts or
        // scores, so its single request can run alongside evidence review.
        const [verified, classified] = await Promise.all([
          verifyReportFacts(prepared, sourceText, 20_000),
          categorizeProperty(prepared),
        ]);
        
        const categorized = classified.taxonomy
          ? { ...verified, taxonomy: classified.taxonomy, categories: undefined, jevCategorized: classified.jevCategorized }
          : verified;
        const latest = await findReport(candidate.id);
        if (latest?.extractionVersion !== candidate.extractionVersion || latest?.sourceReviewAttemptedAt !== candidate.sourceReviewAttemptedAt) return;
        await replaceReport({
          ...categorized,
          offerQuestions: latest?.offerQuestions || categorized.offerQuestions,
          offerQuestionsDe: latest?.offerQuestionsDe || categorized.offerQuestionsDe,
          aiEnriched: latest?.aiEnriched || categorized.aiEnriched,
        });
      } catch (error) {
        console.warn('Background listing verification failed', { message: error instanceof Error ? error.message : 'unknown error' });
      }
    });
  };

  let uploadedPdf: { data: ArrayBuffer; displayName: string; size: number } | undefined;
  const input = await timed('input', async () => {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')) {
      return request.json() as Promise<{ url?: string; text?: string; name?: string; locale?: 'en' | 'de' }>;
    }
    const form = await request.formData();
    const locale = form.get('locale') === 'de' ? 'de' : 'en';
    const file = form.get('file');
    if (!file || typeof file === 'string') return { url: undefined, text: String(form.get('text') || ''), name: String(form.get('name') || ''), locale };
    if (file.size < 5 || file.size > MAX_PDF_BYTES || (file.type && file.type !== 'application/pdf')) {
      throw new Error(locale === 'de' ? 'pdf_invalid_de' : 'pdf_invalid_en');
    }
    const data = await file.arrayBuffer();
    if (!hasPdfSignature(new Uint8Array(data, 0, 5))) throw new Error(locale === 'de' ? 'pdf_invalid_de' : 'pdf_invalid_en');
    const displayName = cleanPdfDisplayName(String(form.get('name') || file.name), locale === 'de' ? 'Immobilien-Exposé' : 'Property Exposé');
    uploadedPdf = { data, displayName, size: file.size };
    return { url: undefined, text: String(form.get('text') || ''), name: displayName, locale };
  }).catch((error) => {
    const message = error instanceof Error ? error.message : '';
    if (message === 'pdf_invalid_de') return { inputError: 'Bitte lade ein gültiges PDF mit höchstens 15 MB hoch.', locale: 'de' as const };
    if (message === 'pdf_invalid_en') return { inputError: 'Upload a valid PDF no larger than 15 MB.', locale: 'en' as const };
    return { inputError: 'The submitted data could not be read. Please try again.', locale: 'en' as const };
  });
  if (input && typeof input === 'object' && 'inputError' in input) return respond({ error: input.inputError }, 400);
  if (!input || typeof input !== 'object' || Array.isArray(input) || ['url', 'text', 'name'].some(key => key in input && typeof input[key as 'url' | 'text' | 'name'] !== 'string' && input[key as 'url' | 'text' | 'name'] !== undefined)) return respond({ error: 'Submit a listing URL, text or PDF.' }, 400);
  const de = input.locale === 'de';
  if ((input.text || '').length > MAX_SOURCE_TEXT_LENGTH) return respond({ error: de ? 'Das Exposé enthält zu viel Text.' : 'The Exposé contains too much text.' }, 413);
  const quotaExceeded = (state: Awaited<ReturnType<typeof reserveReportAllowance>>['state']) => respond({
    error: de ? 'Du hast dein Berichtslimit für diesen Zeitraum erreicht.' : 'You have reached your report limit for this period.',
    code: 'quota_exceeded',
    access: state,
  }, 402);

  let text = input.text || '';
  let source = cleanPdfDisplayName(input.name || (de ? 'Immobilien-Exposé' : 'Property Exposé'));
  let reportId: string | undefined;
  let existing: Awaited<ReturnType<typeof findReport>>;

  if (input.url) {
    if (/^https?:\/\/(?:www\.)?list\.am(?:\/|$)/i.test(input.url)) return respond({ error: 'This is an Armenian listing. Choose Armenia in the country menu to create its report.' }, 400);
    const url = publicListingUrl(input.url);
    if (!url) return respond({ error: de ? 'Bitte gib einen gültigen öffentlichen Link ein.' : 'Enter a valid public listing URL.' }, 400);
    source = url.toString();
    reportId = await timed('fingerprint', () => stableReportId(source));
    existing = await timed('cache', () => findReport(reportId!));
    // An explicit URL import must fetch the listing again: its price and facts
    // can change even when the parser version has not changed.
    try {
      text = await timed('source', () => fetchListing(source));
    } catch (error) {
      const code = error instanceof ListingFetchError ? error.code : 'unavailable';
      const messages = {
        blocked: de ? 'Dieses Portal blockiert den Import. Lade das Exposé als PDF hoch oder füge den Angebotstext ein.' : 'This portal blocks imports. Upload its Exposé PDF or paste the listing text below.',
        timeout: de ? 'Das Portal hat nicht rechtzeitig geantwortet. Versuche es erneut oder lade das Exposé hoch.' : 'The listing portal took too long to respond. Try again or upload its Exposé.',
        too_large: de ? 'Das Angebot ist zu groß zum Importieren.' : 'This listing is too large to import.',
        invalid: de ? 'Der Link führt nicht zu einer gültigen öffentlichen Seite.' : 'The link does not lead to a valid public page.',
        unavailable: de ? 'Das Angebot ist nicht mehr verfügbar oder konnte nicht geöffnet werden. Versuche ein PDF oder den Angebotstext.' : 'This listing is no longer available or could not be opened. Try its PDF or paste its listing text.',
      };
      return respond({ error: messages[code] }, listingImportStatus(code));
    }
  }

  const unsupported = unsupportedListingReason(text);
  if (unsupported) return respond({ error: de ? 'Bitte verwende ein Angebot für eine Wohnung oder ein Haus zum Kauf. Gewerbe- und Mietangebote werden nicht unterstützt.' : unsupported }, 422);
  const listingValid = await timed('validation', () => text.length >= 150 && looksLikeListing(text));
  if (!listingValid) return respond({ error: de ? 'Das sieht nicht nach einem Immobilienangebot oder einem durchsuchbaren Exposé aus.' : 'This does not look like a real-estate listing or a text-searchable Exposé.' }, 422);

  if (!reportId) reportId = await timed('fingerprint', () => stableReportId(source, text));
  if (!existing) existing = await timed('cache', () => findReport(reportId!));
  if (!input.url && !uploadedPdf && existing?.extractionVersion === EXTRACTION_VERSION && !existing.sourceUnavailable && resolveLocation(existing).basis !== 'none') {
    const allowance = await timed('quota', () => reserveReportAllowance(request, anonymous.token));
    if (!allowance.allowed) return quotaExceeded(allowance.state);
    remember(allowance.userId, existing.id);
    categorizeLater(existing);
    return respond({ ...existing, access: allowance.state });
  }

  const allowance = await timed('quota', () => reserveReportAllowance(request, anonymous.token));
  if (!allowance.allowed) return quotaExceeded(allowance.state);
  const baseReport = await timed('parse', () => deterministicAssessment(text, source));
  const prepared = { ...baseReport, sourceReviewAttemptedAt: new Date().toISOString(), offerQuestions: defaultOfferQuestions(baseReport), offerQuestionsDe: defaultOfferQuestions(baseReport, 'de') };
  let report: NonNullable<Awaited<ReturnType<typeof findReport>>> = existing
    ? {
      ...prepared,
      id: existing.id,
      createdAt: existing.createdAt,
      aiEnriched: false,
      // Fresh parser output must not inherit an older snapshot's verification.
      aiLocationChecked: false,
      aiFactChecked: false,
      jevCategorized: false,
      categories: undefined,
      taxonomy: undefined,
    }
    : { ...prepared, id: reportId };

  if (uploadedPdf) report = {
    ...report,
    source: uploadedPdf.displayName,
    sourceFile: undefined,
  };

  if (resolveLocation(report).basis === 'none') {
    report = await timed('aiLocationFallback', () => verifyReportFacts(report, text, 8_000));
    if (resolveLocation(report).basis === 'none') {
      await timed('quotaRelease', () => allowance.release?.());
      return respond({ error: de ? 'Im Angebot fehlt eine verlässliche Lageangabe. Ohne belegbare Lage erstellen wir keinen Bericht.' : 'The listing does not provide a reliable location. We will not create a report without one.' }, 422);
    }
  }

  try {
    if (uploadedPdf) {
      const stored = await timed('pdfStore', () => saveSourcePdf(report.id, uploadedPdf!.data, uploadedPdf!.displayName));
      if (stored) report = { ...report, sourceFile: { displayName: uploadedPdf.displayName, size: uploadedPdf.size } };
    }
    await timed('archive', () => saveReportSource(report.id, text));
    await timed('store', () => existing ? replaceReport(report) : saveReport(report));
    if (!report.aiLocationChecked || !report.aiFactChecked) verifyLater(report, text);
    else categorizeLater(report);
    remember(allowance.userId, report.id);
    return respond({ ...report, access: allowance.state }, existing ? 200 : 201);
  } catch (error) {
    await timed('quotaRelease', () => allowance.release?.());
    if (uploadedPdf) await deleteSourcePdf(report.id).catch(() => undefined);
    throw error;
  }
}
