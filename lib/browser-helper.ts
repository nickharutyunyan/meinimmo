type HelperReply = { ok?: boolean; version?: string; source?: string; text?: string; error?: string };

export function browserHelper(kind: 'ping' | 'import', url?: string): Promise<HelperReply> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', receive); };
    const receive = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'rah-helper-response' || event.data.id !== id) return;
      cleanup();
      if (event.data.error) reject(new Error(String(event.data.error)));
      else resolve(event.data as HelperReply);
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error(kind === 'ping' ? 'Helper not installed.' : 'The browser helper did not respond. Refresh the page and try again.')); }, kind === 'ping' ? 1200 : 30000);
    window.addEventListener('message', receive);
    window.postMessage({ channel: 'rah-helper-request', id, kind, url }, location.origin);
  });
}
