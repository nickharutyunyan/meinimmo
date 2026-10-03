import { parse, type DefaultTreeAdapterMap } from 'parse5';

type Node = DefaultTreeAdapterMap['node'];
const omittedTags = new Set(['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'form', 'dialog', 'template', 'button', 'select']);
const blocks = new Set(['address', 'article', 'aside', 'blockquote', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'header', 'li', 'main', 'p', 'section', 'span', 'table', 'tbody', 'td', 'th', 'tr']);

/** Extract rendered listing text, never navigation, contact forms or related adverts. */
export function listingContent(raw: string) {
  if (!/<(?:html|body|main|div|p|table|h1)\b/i.test(raw)) return raw;
  const document = parse(raw);
  const attr = (node: Node, name: string) => 'attrs' in node ? node.attrs.find(a => a.name === name)?.value || '' : '';
  const find = (node: Node, tag: string): Node | undefined => {
    if ('tagName' in node && node.tagName === tag) return node;
    for (const child of 'childNodes' in node ? node.childNodes : []) {
      const found = find(child, tag);
      if (found) return found;
    }
  };
  const root = find(document, 'main') || find(document, 'body') || document;
  const walk = (node: Node): string => {
    if (node.nodeName === '#text') return (node as DefaultTreeAdapterMap['textNode']).value;
    if (!('tagName' in node) && !('childNodes' in node)) return '';
    const tag = 'tagName' in node ? node.tagName : '';
    const identity = `${attr(node, 'id')} ${attr(node, 'class')}`;
    if (omittedTags.has(tag) || attr(node, 'role') === 'navigation'
      || /(?:^|[\s_-])(?:related|recommendations|contact-seller|breadcrumb|passt)(?:[\s_-]|$)/i.test(identity)
      || attr(node, 'aria-hidden') === 'true') return '\n';
    if (tag === 'br') return '\n';
    const children = ('childNodes' in node ? node.childNodes : []).map(walk).join('');
    // Preserve label/value association inside a table row. Adjacent rows cannot
    // donate a purchase price to an acquisition-cost field.
    if (tag === 'tr') return `\n${children.replace(/\s+/g, ' ').trim()}\n`;
    return blocks.has(tag) ? `\n${children}\n` : children;
  };
  return walk(root);
}
