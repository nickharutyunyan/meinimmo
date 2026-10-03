import type { Report } from './types';
import { reportConflicts } from './report-integrity.ts';

/** Extraction is not verification. Model suggestions cannot erase source conflicts
 * or silently overwrite an already evidenced deterministic field. */
export function guardEnrichment(original: Report, candidate: Report): Report {
  if (reportConflicts(original).length) return { ...original, verificationAttempted: true, aiFactChecked: false, aiLocationChecked: false };
  const facts = { ...candidate.facts };
  for (const key of Object.keys(original.facts) as Array<keyof Report['facts']>) {
    const value = original.facts[key];
    if (value !== undefined && value !== 0 && value !== '' && value !== 'not stated') Object.assign(facts, { [key]: value });
  }
  return { ...candidate, facts, evidence: original.evidence, verificationAttempted: true, aiFactChecked: false, aiLocationChecked: false };
}
