import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Report } from './types';
import { looksLikePropertyListing, parseListing } from './listing-parser';
import { offerQuestionsFor } from './report-copy';

const UNKNOWN = 'not stated';

export const looksLikeListing = looksLikePropertyListing;
export const deterministicAssessment = parseListing;

export function defaultOfferQuestions(report: Report) {
  return offerQuestionsFor(report, 'en');
}

function validatedQuestions(value: unknown, report: Report) {
  if (!Array.isArray(value) || value.length !== 4) return undefined;
  const questions = value.map(item => typeof item === 'string' ? item.trim() : '');
  if (questions.some(question => question.length < 30 || question.length > 320)) return undefined;
  if (new Set(questions.map(question => question.toLowerCase())).size !== questions.length) return undefined;

  const joined = questions.join(' ').toLowerCase();
  if (report.facts.tenancy === 'Rented') {
    if (/(?:whether|if|confirm whether)[^?.]{0,80}(?:rented|tenanted|vacant)/i.test(joined)) return undefined;
    if (!/(?:rent|tenant|lease|miete|rendite|yield|return)/i.test(joined)) return undefined;
  }
  if (report.facts.housegeld && !/(?:hausgeld|weg|reserve|recoverable|umlage)/i.test(joined)) return undefined;
  if (report.facts.energy === 'A' && /(?:achieve|upgrade path|reach)\s+(?:energy\s+)?(?:class\s+)?a/i.test(joined)) return undefined;
  return questions;
}

export async function enrichOnlyWhenNeeded(report: Report, sourceText = '') {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.OPENROUTER_API_KEY) return report;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_500);
  const body = JSON.stringify({
    model: env.OPENROUTER_MODEL || 'openrouter/free',
    temperature: 0.1,
    max_tokens: 380,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are a cautious German residential-property buyer advocate. Never invent or reconfirm a fact already stated. Return concise, property-specific due-diligence questions, not generic filler.',
      },
      {
        role: 'user',
        content: `Return JSON only: {"offerQuestions":["exactly four questions"]}. Each question must target a material unresolved risk in this assessment. Prioritize tenancy and yield evidence, recoverable versus owner-only Hausgeld, WEG finances and Sonderumlagen, legal rights, energy bills/tariff, exact floor/access/light/noise, and missing documents. Do not ask whether a fact is true when it is already stated; ask for evidence or the decision-relevant breakdown instead. Assessment: ${JSON.stringify(report)} ${sourceText ? `Additional evidence: ${sourceText.slice(0, 3000)}` : ''}`,
      },
    ],
  });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'content-type': 'application/json' },
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn('OpenRouter enrichment unavailable', { status: response.status });
      return report;
    }
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.replace(/^```(?:json)?\s*|\s*```$/g, '') || '{}';
    const parsed = JSON.parse(content) as { offerQuestions?: unknown };
    const questions = validatedQuestions(parsed.offerQuestions, report);
    if (!questions) {
      console.warn('OpenRouter enrichment failed factual relevance validation');
      return report;
    }
    return { ...report, offerQuestions: questions, aiEnriched: true };
  } catch (error) {
    console.warn(error instanceof DOMException && error.name === 'AbortError' ? 'OpenRouter enrichment timed out' : 'OpenRouter enrichment returned invalid JSON');
    return report;
  } finally {
    clearTimeout(timeout);
  }
}
