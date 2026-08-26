export type PdfTextItemLike = {
  str: string;
  transform?: ArrayLike<number>;
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

function coordinate(item: PdfTextItemLike, index: number) {
  return Number(item.transform?.[index] || 0);
}

/**
 * Rebuild the visual lines exposed by PDF.js without inserting spaces between
 * glyph fragments that belong to the same word. Keeping labels and values on
 * their real lines is important: a listing often places Kaufpreis directly
 * below the asking price and beside a separate price-per-m² value.
 */
export function pdfTextFromItems(items: ArrayLike<unknown>) {
  const lines: string[] = [];
  let line = '';
  let previous: { x: number; y: number; right: number; height: number } | undefined;

  const flush = () => {
    const clean = line.replace(/[\t ]+/g, ' ').trim();
    if (clean) lines.push(clean);
    line = '';
    previous = undefined;
  };

  for (const unknownItem of Array.from(items)) {
    if (!unknownItem || typeof unknownItem !== 'object' || !('str' in unknownItem)) continue;
    const item = unknownItem as PdfTextItemLike;
    const value = typeof item.str === 'string' ? item.str : '';
    const whitespaceOnly = /^\s*$/.test(value);
    const x = coordinate(item, 4);
    const y = coordinate(item, 5);
    const height = Math.max(1, Number(item.height || 0));

    if (!whitespaceOnly && previous) {
      const changedBaseline = Math.abs(y - previous.y) > Math.max(1.5, Math.min(height, previous.height) * 0.35);
      const movedBack = x < previous.right - Math.max(1.5, height * 0.2);
      if (changedBaseline || movedBack) flush();
    }

    if (whitespaceOnly) {
      if (line && !/\s$/.test(line)) line += ' ';
    } else {
      const gap = previous ? x - previous.right : 0;
      if (line && !/\s$/.test(line) && gap > Math.max(1.2, height * 0.14)) line += ' ';
      line += value;
      previous = { x, y, right: x + Number(item.width || 0), height };
    }

    if (item.hasEOL) flush();
  }

  flush();
  return lines.join('\n');
}

