export function canonicalCondition(value?: string) {
  const clean = (value || '').replace(/\s+/g, ' ').trim();
  if (!clean) return undefined;
  if (/\b(?:renovierungsbed[uü]rftig|sanierungsbed[uü]rftig|renovation required|needs renovation)\b/i.test(clean)) return 'Needs renovation';
  if (/\b(?:modernisierungsbed[uü]rftig|needs moderni[sz]ation)\b/i.test(clean)) return 'Needs modernization';
  if (/\b(?:im bau|bauprojekt|projektiert|under construction)\b/i.test(clean)) return 'Under construction';
  if (/\b(?:erstbezug nach (?:komplett)?sanierung|kernsaniert|vollst[aä]ndig saniert|saniert|renoviert|renovated|fully renovated)\b/i.test(clean)) return 'Renovated';
  if (/\b(?:neuwertig|like new|as-new condition)\b/i.test(clean)) return 'Like new';
  if (/\b(?:neubau(?:wohnung|haus)?|new build)\b/i.test(clean)) return 'New build';
  if (/\b(?:gepflegt|well maintained)\b/i.test(clean)) return 'Well maintained';
  return clean;
}

export function isExplicitNewBuild(value?: string) {
  return canonicalCondition(value) === 'New build';
}
