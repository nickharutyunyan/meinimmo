const FREE_VERIFICATION_MODELS = [
  'google/gemma-4-26b-a4b-it:free',
  'dots-studio/dots-3-note-preview:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
] as const;

/** One observed rate limit or daily quota pauses later attempts in this isolate. */
export const ENRICHMENT_PAUSE_MS = 15 * 60 * 1000;
export const ENRICHMENT_RATE_LIMIT_LOG = 'OpenRouter enrichment skipped: rate limit or daily quota';

let pausedUntil = 0;

export function enrichmentModelOrder(configured?: string) {
  return [...new Set([configured, ...FREE_VERIFICATION_MODELS].filter((model): model is string => Boolean(model)))].slice(0, 3);
}

export function enrichmentPaused(now = Date.now()) {
  return now < pausedUntil;
}

export function pauseEnrichment(now = Date.now(), pauseMs = ENRICHMENT_PAUSE_MS) {
  pausedUntil = now + pauseMs;
}

export function resetEnrichmentPause() {
  pausedUntil = 0;
}

/** A 429, a credit failure, or a daily-quota message. Another model would spend the same quota. */
export function enrichmentIsRateLimited(status: number, body: string) {
  if (status === 429 || status === 402) return true;
  return /free-models-per-day|rate[\s-]?limit|daily quota|insufficient credits|quota exceeded/i.test(body);
}

/** One model per request, and the provider must not hop to another upstream. */
export function openRouterChatBody(model: string, messages: unknown, maxTokens: number) {
  return {
    model,
    provider: { sort: { by: 'throughput', partition: 'none' }, require_parameters: true, allow_fallbacks: false },
    reasoning: { effort: 'none' },
    temperature: 0,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages,
  };
}

export type EnrichmentFetchResult = {
  ok: boolean;
  status: number;
  body: string;
  json?: unknown;
};

/**
 * Tries the next model only after a non-quota failure.
 * A rate limit or daily quota returns immediately.
 */
export async function runEnrichmentModels(
  models: string[],
  send: (model: string) => Promise<EnrichmentFetchResult>,
) {
  let lastStatus = 0;
  let lastBody = '';
  for (const model of models) {
    const result = await send(model);
    if (result.ok) return { outcome: 'ok' as const, model, json: result.json };
    lastStatus = result.status;
    lastBody = result.body;
    if (enrichmentIsRateLimited(result.status, result.body)) {
      return { outcome: 'rate_limited' as const, status: result.status };
    }
  }
  return { outcome: 'unavailable' as const, status: lastStatus, body: lastBody };
}
