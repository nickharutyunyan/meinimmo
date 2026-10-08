import { parse, type DefaultTreeAdapterMap } from 'parse5';

type Node = DefaultTreeAdapterMap['node'];
const omittedTags = new Set(['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'form', 'dialog', 'template', 'button', 'select']);
const blocks = new Set(['address', 'article', 'aside', 'blockquote', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'header', 'li', 'main', 'p', 'section', 'span', 'table', 'tbody', 'td', 'th', 'tr']);

const MAX_DOM_DEPTH = 400;
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

/** Unterminated tags nest without bound. Real listing pages stay far shallower than this. */
function pathologicallyNested(raw: string) {
  let depth = 0;
  for (let index = 0; index < raw.length; index += 1) {
    if (raw.charCodeAt(index) !== 60) continue;
    const next = raw.charCodeAt(index + 1);
    if (next === 47) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (!((next >= 65 && next <= 90) || (next >= 97 && next <= 122))) continue;
    let end = index + 1;
    const limit = Math.min(raw.length, index + 16);
    while (end < limit) {
      const code = raw.charCodeAt(end);
      if (!((code >= 65 && code <= 90) || (code >= 97 && code <= 122))) break;
      end += 1;
    }
    const name = raw.slice(index + 1, end).toLowerCase();
    if (VOID_TAGS.has(name)) continue;
    depth += 1;
    if (depth > MAX_DOM_DEPTH) return true;
  }
  return false;
}

/** Extract rendered listing text, never navigation, contact forms or related adverts. */
export function listingContent(raw: string) {
  if (!/<(?:html|body|main|div|p|table|h1)\b/i.test(raw)) return raw;
  if (pathologicallyNested(raw)) return raw;
  const document = parse(raw);
  const attr = (node: Node, name: string) => 'attrs' in node ? node.attrs.find(a => a.name === name)?.value || '' : '';
  const find = (node: Node, tag: string, depth = 0): Node | undefined => {
    if (depth > MAX_DOM_DEPTH) return undefined;
    if ('tagName' in node && node.tagName === tag) return node;
    for (const child of 'childNodes' in node ? node.childNodes : []) {
      const found = find(child, tag, depth + 1);
      if (found) return found;
    }
  };
  const root = find(document, 'main') || find(document, 'body') || document;
  const walk = (node: Node, depth = 0): string => {
    if (depth > MAX_DOM_DEPTH) return '';
    if (node.nodeName === '#text') return (node as DefaultTreeAdapterMap['textNode']).value;
    if (!('tagName' in node) && !('childNodes' in node)) return '';
    const tag = 'tagName' in node ? node.tagName : '';
    const identity = `${attr(node, 'id')} ${attr(node, 'class')}`;
    if (omittedTags.has(tag) || attr(node, 'role') === 'navigation'
      || /(?:^|[\s_-])(?:related|recommendations|contact-seller|breadcrumb|passt)(?:[\s_-]|$)/i.test(identity)
      || attr(node, 'aria-hidden') === 'true') return '\n';
    if (tag === 'br') return '\n';
    const children = ('childNodes' in node ? node.childNodes : []).map(child => walk(child, depth + 1)).join('');
    // Preserve label/value association inside a table row. Adjacent rows cannot
    // donate a purchase price to an acquisition-cost field.
    if (tag === 'tr') return `\n${children.replace(/\s+/g, ' ').trim()}\n`;
    return blocks.has(tag) ? `\n${children}\n` : children;
  };
  return walk(root);
}
