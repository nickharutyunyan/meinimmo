export type HeldLinkFragment = { path: string; token: string };

const TOKEN = /^[A-Za-z0-9_-]{40,100}$/;

export function takeLinkFragment(
  location: { pathname: string; search: string; hash: string },
  held: HeldLinkFragment | null,
): { token: string; held: HeldLinkFragment | null; url: string | null } {
  const path = location.pathname;
  const fromHash = new URLSearchParams(location.hash.replace(/^#/, '')).get('t') || '';
  if (TOKEN.test(fromHash)) {
    const next = { path, token: fromHash };
    return { token: fromHash, held: next, url: path + location.search };
  }
  if (held && held.path === path) return { token: held.token, held, url: null };
  return { token: '', held, url: null };
}
