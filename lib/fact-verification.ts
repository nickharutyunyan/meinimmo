import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { enrichAssessment } from './assessment';
import { requestJev } from './jev-client';
import { jevVerificationFlow } from './jev-verification-flow';
import type { Report } from './types';

/** Opt-in trial. Uncertain/incorrect facts still need evidence-based correction. */
export async function verifyReportFacts(report: Report, source: string, timeoutMs = 20_000): Promise<Report> {
  const { env } = await getCloudflareContext({ async: true });
  const config = env as CloudflareEnv & { FACT_CHECK_PROVIDER?: string; TYPESAFE_API_KEY?: string; JEV_MODEL?: string };
  return jevVerificationFlow(report, source, timeoutMs, {
    enabled: config.FACT_CHECK_PROVIDER === 'jev' && Boolean(config.TYPESAFE_API_KEY),
    model: config.JEV_MODEL || 'jev-latest',
    request: (body, budget) => requestJev(body, config.TYPESAFE_API_KEY!, budget),
    fallback: (candidate, text, budget) => enrichAssessment(candidate, text, true, budget),
  });
}
