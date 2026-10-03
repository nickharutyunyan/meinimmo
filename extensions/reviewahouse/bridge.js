(() => {
  if (window !== window.top) return;
  const origin = location.origin;
  if (!['https://reviewahouse.com', 'https://www.reviewahouse.com'].includes(origin)) return;
  let gestureUntil = 0;
  let pending = false;
  // The website cannot silently start imports: a real submission is required.
  document.addEventListener('submit', event => {
    if (event.isTrusted && event.target instanceof HTMLFormElement && event.target.matches('[data-browser-import]')) gestureUntil = Date.now() + 3000;
  }, true);
  window.addEventListener('message', async event => {
    const message = event.data;
    if (event.source !== window || event.origin !== origin || message?.channel !== 'rah-helper-request' || !/^[\w-]{1,80}$/.test(message.id || '')) return;
    if (!['ping', 'import'].includes(message.kind)) return;
    const respond = data => window.postMessage({ channel: 'rah-helper-response', id: message.id, ...data }, origin);
    if (message.kind === 'import') {
      if (pending || Date.now() > gestureUntil) { respond({ error: 'Click Create report to read a listing through your browser.' }); return; }
      gestureUntil = 0;
      pending = true;
    }
    try { respond(await chrome.runtime.sendMessage({ kind: message.kind, url: message.url })); }
    catch { respond({ error: 'The helper disconnected. Refresh this page and try again.' }); }
    finally { if (message.kind === 'import') pending = false; }
  });
})();
