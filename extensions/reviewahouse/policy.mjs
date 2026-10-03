export function canonicalListing(value) {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const u = new URL(value);
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.port || !['list.am', 'www.list.am'].includes(u.hostname)) return null;
    const id = u.pathname.match(/^\/(?:en\/|am\/|hy\/|ru\/)?item\/(\d+)\/?$/i)?.[1];
    return id ? `https://www.list.am/en/item/${id}` : null;
  } catch { return null; }
}

export function allowedSender(sender, extensionId) {
  if (sender.id !== extensionId || sender.frameId !== 0 || !Number.isInteger(sender.tab?.id)) return false;
  try { return ['https://reviewahouse.com', 'https://www.reviewahouse.com'].includes(new URL(sender.url).origin); }
  catch { return false; }
}
