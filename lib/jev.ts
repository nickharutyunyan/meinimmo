import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Report } from './types';
import { factualTaxonomyRequest, parseFactualTaxonomy, taxonomyInputHash, TAXONOMY_VERSION } from './property-taxonomy';
import { requestJev } from './jev-client';

type JevEnvironment = CloudflareEnv & {
  TYPESAFE_API_KEY?: string;
  JEV_MODEL?: string;
};

export async function categorizeProperty(report: Report, timeoutMs = 3_000): Promise<Report> {
  if (!report.taxonomyEvidence) return report;
  const { env } = await getCloudflareContext({ async: true });
  const configuration = env as JevEnvironment;
  if (!configuration.TYPESAFE_API_KEY) return report;
  const inputHash = await taxonomyInputHash(report);
  if (report.jevCategorized && report.taxonomy?.version === TAXONOMY_VERSION && report.taxonomy.inputHash === inputHash) return report;
  try {
    const result = await requestJev(factualTaxonomyRequest(report, configuration.JEV_MODEL || 'jev-latest'), configuration.TYPESAFE_API_KEY, timeoutMs);
    const taxonomy = parseFactualTaxonomy(result, report, inputHash);
    if (!taxonomy) {
      console.warn('Jev categorization returned an invalid response');
      return report;
    }
    console.info('Jev categorization complete', { model: taxonomy.model, version: taxonomy.version });
    return { ...report, taxonomy, categories: undefined, jevCategorized: true };
  } catch (error) {
    console.warn(error instanceof DOMException && error.name === 'AbortError' ? 'Jev categorization timed out' : 'Jev categorization failed', {
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return report;
  }
}
