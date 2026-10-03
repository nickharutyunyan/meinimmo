import { canonicalListing, allowedSender } from './policy.mjs';
import { readListing } from './extract.mjs';

let importing = false;
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!allowedSender(sender, chrome.runtime.id)) return false;
  if (message?.kind === 'ping') { reply({ ok: true, version: chrome.runtime.getManifest().version }); return false; }
  if (message?.kind !== 'import') return false;
  const source = canonicalListing(message.url);
  if (!source) { reply({ error: 'Use a List.am property listing link.' }); return false; }
  if (importing) { reply({ error: 'A listing is already being read. Please wait for it to finish.' }); return false; }
  importing = true;
  importListing(source).then(reply, () => reply({ error: 'The browser could not read this listing. Check that List.am opens in Chrome, then try again.' })).finally(() => { importing = false; });
  return true;
});

async function importListing(source) {
  const tab = await chrome.tabs.create({ url: source, active: false });
  let keepTab = false;
  let verification = false;
  try {
    const deadline = Date.now() + 22000;
    while (Date.now() < deadline) {
      const current = await chrome.tabs.get(tab.id);
      if (current.url && canonicalListing(current.url) !== source) return { error: 'The listing tab navigated away. No report was created.' };
      let result;
      try { [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readListing, args: [source] }); }
      catch { /* The tab can be between documents during a normal redirect. */ }
      const data = result?.result;
      if (data?.state === 'ready') return { ok: true, source, text: data.text };
      if (data?.state === 'unsupported') return { error: 'Only property-for-sale listings are supported. No report was created.' };
      if (data?.state === 'too-large') return { error: 'This listing is too large to import safely.' };
      verification = data?.state === 'verification';
      await new Promise(resolve => setTimeout(resolve, 750));
    }
    if (verification) {
      keepTab = true;
      await chrome.tabs.update(tab.id, { active: true });
      return { error: 'List.am needs a browser verification. Complete it in the opened tab, then return here and click Create report again. No report was created.' };
    }
    return { error: 'The public listing details did not load. Check that the advert is still available and try again.' };
  } finally {
    // Only close our own temporary tab while it still displays this listing.
    if (!keepTab) {
      const current = await chrome.tabs.get(tab.id).catch(() => null);
      if (current && canonicalListing(current.url) === source) await chrome.tabs.remove(tab.id).catch(() => {});
    }
  }
}
