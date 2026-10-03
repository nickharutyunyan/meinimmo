export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

/** Server callers supply the secret; never expose it through an API response. */
export async function requestJev(body: unknown, apiKey: string, timeoutMs = 3_000): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(JEV_ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Jev request failed (${response.status})`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}
