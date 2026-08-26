export const MAX_PDF_BYTES = 15 * 1024 * 1024;

export function cleanPdfDisplayName(value: string, fallback = 'Property Exposé') {
  const basename = value.trim().split(/[\\/]/).pop() || '';
  const cleaned = basename
    .replace(/\.pdf$/i, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.\-_]+|[\s.\-_]+$/g, '')
    .trim();
  return cleaned || fallback;
}

export function pdfDownloadName(displayName: string) {
  return `${cleanPdfDisplayName(displayName)}.pdf`;
}

export function hasPdfSignature(bytes: Uint8Array) {
  return bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d;
}

export function pdfContentDisposition(displayName: string) {
  const filename = pdfDownloadName(displayName);
  const ascii = filename.replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '').trim() || 'property-expose.pdf';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
