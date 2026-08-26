const IMPORTANT_LISTING_LINE = /(?:adresse|anschrift|lage|stadtteil|ortsteil|bezirk|kiez|mikrolage|straße|str\.?|allee|weg|platz|gasse|damm|ufer|chaussee|ring|postleitzahl|\b\d{5}\b|u-?bahn|s-?bahn|bahnhof|haltestelle|wohnfl[aä]che|nutzfl[aä]che|zimmer|kaufpreis|gesamtkosten|hausgeld|maklerprovision|aktuelle\s+nutzung|vermietet|bezugsfrei|leerstehend|eigengenutzt|zustand|baujahr|etage|geschoss|energieeffizienzklasse|energieausweis|energietr[aä]ger|heizung|balkon|terrasse|garten|aufzug)/iu;

export const MAX_AI_LISTING_CHARS = 6_000;

export function listingAiExcerpt(lines: string[]) {
  const important = lines.filter(line => IMPORTANT_LISTING_LINE.test(line));
  const context = lines.slice(0, 70);
  return [...important, ...context]
    .filter((line, index, all) => all.indexOf(line) === index)
    .join('\n')
    .slice(0, MAX_AI_LISTING_CHARS);
}

export function parseAiJson(content: string) {
  const clean = content
    .replace(/<(?:think|analysis)>[\s\S]*?<\/(?:think|analysis)>/gi, '')
    .replace(/```(?:json)?|```/gi, '')
    .trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end < start) throw new SyntaxError('AI response did not contain a JSON object.');
  return JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>;
}
