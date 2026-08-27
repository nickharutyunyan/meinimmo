const GERMAN_MONTHS: Record<string, number> = {
  januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
};

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

export function extractAvailabilityDate(lines: string[]) {
  const candidates = lines.flatMap((line, index) => [line, `${line} ${lines[index + 1] || ''}`]);
  for (const candidate of candidates) {
    const numeric = candidate.match(/(?:bezugsfrei|beziehbar|verf[uü]gbar|frei)\s+ab\s*:?\s*(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\b/i)
      || candidate.match(/(?:available|vacant|move-in)\s+from\s*:?\s*(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\b/i);
    if (numeric) {
      const value = isoDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
      if (value) return value;
    }
    const written = candidate.match(/(?:bezugsfrei|beziehbar|verf[uü]gbar|frei)\s+ab\s*:?\s*(\d{1,2})\.?\s+(Januar|Februar|M[aä]rz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})\b/i);
    if (written) {
      const month = GERMAN_MONTHS[written[2].toLocaleLowerCase('de-DE')];
      const value = month ? isoDate(Number(written[3]), month, Number(written[1])) : '';
      if (value) return value;
    }
  }
  return undefined;
}

export function formatAvailabilityDate(value: string | undefined, locale: 'en' | 'de') {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (isoDate(year, month, day) !== value) return '';
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}
