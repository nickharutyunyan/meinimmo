/** A bounded JSON request that never leaves the UI waiting on a failed network
 * request or an HTML error response from an upstream proxy. */
export async function requestJson<T>(url: string, options: RequestInit, timeoutMs = 30_000): Promise<{ response: Response; data: T }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...options, signal: controller.signal });
        const data = await response.json() as T;
        return { response, data };
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('request_timeout')); }, timeoutMs); }),
    ]);
  } finally { clearTimeout(timer!); }
}
