// Serialized by chrome.scripting: this function deliberately has no imports.
// Read only public listing sections, never page inputs, account details or cookies.
export function readListing(expectedUrl) {
  if (location.href.split(/[?#]/)[0].replace(/\/$/, '') !== expectedUrl) return { state: 'wrong-page' };
  const visible = node => !!node && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none';
  const heading = [...document.querySelectorAll('h1')].find(visible);
  const price = [...document.querySelectorAll('.price[itemprop="price"]')].find(visible);
  const panel = document.querySelector('#pcontent > .vi');
  if (!heading || !price || !panel) {
    const challenged = /just a moment|security verification|verify you are human/i.test(document.title + ' ' + document.body?.innerText?.slice(0,2000));
    return { state: challenged ? 'verification' : 'loading' };
  }
  const categories = [...document.querySelectorAll('[itemtype="https://schema.org/ListItem"] a')].filter(visible).map(node => node.innerText.trim());
  if (!categories.includes('For Sale')) return { state: 'unsupported' };
  const fields = [...panel.children].filter(node => visible(node) && node.matches('.attr, .gt, .post-location-title, .body, .footer'));
  const text = [categories.join('\n'), heading.innerText, price.innerText,
    ...fields.filter(node => !/^Price History$/i.test(node.innerText.trim())).map(node => node.innerText)].join('\n');
  if (text.length > 200000) return { state: 'too-large' };
  if (!fields.some(node => node.matches('.attr')) || !fields.some(node => node.matches('.post-location-title'))) return { state: 'loading' };
  return { state: 'ready', source: expectedUrl, text };
}
