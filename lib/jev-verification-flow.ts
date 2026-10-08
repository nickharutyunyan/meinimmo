import { reportConflicts } from './report-integrity.ts';
import type { Report } from './types';
import { jevFactCheckRequest, parseJevFactReview } from './jev-fact-check.ts';

type Dependencies = {
  enabled: boolean;
  model?: string;
  request: (body: unknown, timeoutMs: number) => Promise<unknown>;
  fallback: (report: Report, source: string, timeoutMs: number) => Promise<Report>;
};

/** Keep routing pure so timeout/uncertainty/fallback behavior is testable. */
export async function jevVerificationFlow(report: Report, source: string, timeoutMs: number, dependencies: Dependencies): Promise<Report> {
  const started = performance.now();
  const candidate = { ...report, verificationAttempted: true, aiFactChecked: false, aiLocationChecked: false };
  if (dependencies.enabled) {
    const request = jevFactCheckRequest(candidate, source, dependencies.model);
    if (request) {
      try {
        const review = parseJevFactReview(await dependencies.request(request, Math.min(3_000, timeoutMs)), candidate);
        if (review?.accepted && !reportConflicts(candidate).length) return { ...candidate, aiFactChecked: true, aiLocationChecked: true };
      } catch {
        // Fail closed; the provider exception may contain source or secrets.
      }
    }
  }
  const remaining = timeoutMs - (performance.now() - started);
  if (remaining <= 0) return candidate;
  return dependencies.fallback(candidate, source, remaining);
}
