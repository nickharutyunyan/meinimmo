import type { Report } from './types';
import { amd } from './countries.ts';

export type FxRates = { date: string; rates: Record<string, number>; sourceUrl: string };
export { listAmUrl } from './list-am.ts';

function decode(value: string) {
  return value.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
    const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
    return code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&(?:apos|#39);/g, "'");
}

export function listAmText(html: string) {
  // Discard executable content, hidden price conversions, recommendations, map
  // ads and price history. None are evidence about the current asking price.
  return decode(html
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+class=["'][^"']*\bdisabled\b[^"']*["'][^>]*>[\s\S]*?(?=<div class=["']at3|<\/div>\s*<\/div>\s*<\/div>)/gi, '')
    .replace(/<\/(?:div|p|h1|li|tr|section)>|<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '\n'));
}

function number(value = '') {
  const cleaned = value.trim().replace(/[\s,]/g, '').replace(/(?<=\d)\.(?=\d{3}(?:\D|$))/g, '');
  const match = cleaned.match(/^\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}
const primaryLabels = ['Floor Area', 'House Area', 'Land Area', 'Total Land Area', 'Floor', 'Floors in the Building', 'Number of Rooms', 'Number of Bathrooms', 'Ceiling Height'];
const secondaryLabels = ['Construction Type', 'New Construction', 'Renovation', 'Condition', 'Elevator', 'Balcony', 'Furniture', 'Garage'];
const labels = new Set([...primaryLabels, ...secondaryLabels]);

export function parseArmeniaListing(input: string, source: string, fx?: FxRates, method: 'url' | 'text' | 'pdf' | 'browser' = 'text'): Report {
  const raw = /<h1\b/i.test(input) ? listAmText(input) : input;
  const allLines = raw.split(/\r?\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const htmlTitle = input.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const titleIndex = htmlTitle ? allLines.findIndex(s => s === decode(htmlTitle.replace(/<[^>]+>/g, '')).trim()) : allLines.findIndex(s => s.length < 300 && /(?:\b(?:apartment|house|townhouse)\b.*\b(?:sq\.?\s*m|room|street)|^(?:agricultural )?plot\b)/i.test(s));
  if (titleIndex < 0) throw new Error('Use the English version of a List.am apartment, house or land listing. Copy its full details, including the title, sale category and asking price.');
  const title = allLines[titleIndex];
  const categories = allLines.filter(s => /^(?:For Sale|Long Term Rentals|Short Term Rentals)$/i.test(s));
  // Desktop List.am puts the headline/price in a sidebar AFTER the details.
  // Keep its price adjacent to the title and read the property panel separately;
  // do not mistake map ads, price history or mortgage amounts for asking price.
  const beforeTitle = allLines.slice(0, titleIndex);
  const detailsFirst = beforeTitle.includes('Location') && beforeTitle.some(s => primaryLabels.includes(s));
  const header = [...categories, ...allLines.slice(detailsFirst ? titleIndex : Math.max(0, titleIndex - 8), titleIndex + 5)].join(' ');
  const orderedLines = detailsFirst ? [...allLines.slice(titleIndex, titleIndex + 5), ...beforeTitle] : allLines.slice(titleIndex);
  const cutoff = orderedLines.findIndex(s => /^(?:Mortgage Calculator|People Who Viewed|Related Ads)/i.test(s));
  const lines = orderedLines.slice(0, cutoff >= 0 ? cutoff : undefined);
  const descriptionIndex = lines.findIndex(s => /^Description$/i.test(s));
  const description = descriptionIndex >= 0 ? lines.slice(descriptionIndex + 1).join(' ') : '';
  if (/\b(?:Long Term Rentals|Short Term|monthly|daily|for rent)\b/i.test(header) || !/\bfor sale\b/i.test(`${header} ${description}`)) {
    throw new Error('This is not a confirmed property-for-sale listing. Include the “For Sale” category when copying, or use the listing URL. Rental listings are not supported.');
  }
  const type = /^(?:agricultural )?plot\b|^land\b/i.test(title) ? 'land' : /\bapartment\b/i.test(title) ? 'flat' : 'house';
  const details = descriptionIndex < 0 ? lines : lines.slice(0, descriptionIndex);
  const field = (label: string) => {
    for (let i = 0; i < details.length; i++) {
      if (details[i].toLowerCase() !== label.toLowerCase()) continue;
      const before = details[i - 1] || ''; const after = details[i + 1] || '';
      if (primaryLabels.includes(label)) return /^\d+(?:[.,]\d+)?(?:\+|\s*(?:sq\.?\s*m\.?|m²|m))?$/.test(before) ? before : (/^\d/.test(after) && !labels.has(after) ? after : '');
      // Construction Type appears in both value/label and label/value layouts.
      if (label === 'Construction Type' && /^(?:Monolith|Stone|Panels|Bricks|Mixed)$/i.test(before)) return before;
      return !labels.has(after) && after.length < 70 ? after : '';
    }
    const inline = details.find(s => s.toLowerCase().startsWith(`${label.toLowerCase()}:`));
    return inline?.split(':').slice(1).join(':').trim() || '';
  };
  const priceLine = lines.slice(1, 5).find(s => /^(?:\$|€|AMD|USD|EUR)?\s*\d[\d\s,.]*(?:\s*(?:֏|AMD|USD|EUR|RUB|₽|\$|€))?(?:\s*(?:per|\/)\s*(?:sq\.?\s*m\.?|m²))?$/i.test(s) && /[$€֏₽]|AMD|USD|EUR|RUB/.test(s));
  if (!priceLine) throw new Error('The asking price and currency could not be verified. Copy the price directly below the listing title.');
  const currency = /\$|USD/.test(priceLine) ? 'USD' : /€|EUR/.test(priceLine) ? 'EUR' : /₽|RUB/.test(priceLine) ? 'RUB' : 'AMD';
  const originalPrice = number(priceLine.replace(/^(?:[$€]|AMD|USD|EUR)\s*/, ''));
  const perM2 = /(?:per|\/)\s*(?:sq\.?\s*m\.?|m²)/i.test(priceLine) || /^(?:per|\/)\s*(?:sq\.?\s*m\.?|m²)$/i.test(lines[lines.indexOf(priceLine) + 1] || '');
  const area = number(field(type === 'land' ? 'Land Area' : type === 'house' ? 'House Area' : 'Floor Area')) || number(title.match(/([\d,]+(?:\.\d+)?)\s*(?:sq\.?\s*m\.?|m²)/i)?.[1]);
  if (!area || !originalPrice || area > 100_000_000) throw new Error('A valid area and asking price are required to create this report.');
  const conversion = currency === 'AMD' ? 1 : fx?.rates[currency];
  if (!conversion || !Number.isFinite(conversion)) throw new Error('The official CBA exchange rate is unavailable. Please try again later; we will not guess an AMD price.');
  const price = Math.round(originalPrice * conversion * (perM2 ? area : 1));
  const locationIndex = details.findIndex(s => s === 'Location');
  let address = locationIndex >= 0 ? details[locationIndex + 1] || '' : '';
  if (!address || /^(?:Similar Ads|Education)$/i.test(address)) {
    address = lines.slice(1, 9).find(s => /,\s*[\p{L}][\p{L}\s-]+$/u.test(s) && !/[֏$€]|sq\.m|Property|Code/i.test(s)) || '';
  }
  const titleArea = title.match(/.*\bin\s+([^,]+)(?:,|$)/i)?.[1]?.trim().replace(/^the center$/i, 'Kentron');
  const districts = /^(?:Ajapnyak|Arabkir|Avan|Davtashen|Erebuni|Kanaker-Zeytun|Kentron|Malatia-Sebastia|Nor Nork|Nork-Marash|Nubarashen|Shengavit)$/i;
  const approximate = /Approximate location|exact address is hidden/i.test(raw) || !address;
  if (approximate) address = address.replace(/^\d+(?:\/\d+)?[A-Za-z]?\s+/, '');
  if (!address && titleArea) address = districts.test(titleArea) ? `${titleArea}, Yerevan` : titleArea;
  if (!address || address.length > 180 || !/\p{L}/u.test(address)) throw new Error('The location could not be verified. Include the listing’s Location section.');
  const city = address.split(',').at(-1)!.trim();
  const street = address.includes(',') ? address.split(',').slice(0, -1).join(',').trim() : '';
  const roomsValue = field('Number of Rooms') || title.match(/^(\d+(?:\.\d+)?)\s*room/i)?.[1] || '';
  const rooms = /^\d+(?:\.\d+)?\+?$/.test(roomsValue) ? roomsValue : '';
  const floor = field('Floor'); const floors = number(field('Floors in the Building')) || undefined;
  const renovationRaw = field('Renovation');
  const renovation = /^(?:None|Cosmetic|Euro|Designer|Good|Needs renovation|Renovated)$/i.test(renovationRaw) ? renovationRaw : undefined;
  const constructionRaw = field('Construction Type');
  const construction = /^(?:Monolith|Stone|Panels|Bricks|Mixed)$/i.test(constructionRaw) ? constructionRaw : undefined;
  const plotArea = type === 'land' ? area : number(field('Total Land Area')) || number(title.match(/on a ([\d,]+)\s*sq\.?\s*m\.?\s*land/i)?.[1]) || undefined;
  const newValue = field('New Construction');
  const newConstruction = /^yes$/i.test(newValue) || /in a new building/i.test(title) ? true : /^no$/i.test(newValue) ? false : undefined;
  const livingArea = number(description.match(/(?:living area(?: of the house)?(?: is)?|բնակելի մակերեսը)\s*[՝:]?\s*(\d+(?:\.\d+)?)/i)?.[1]) || undefined;
  const warnings: string[] = [];
  if (livingArea && livingArea !== area) warnings.push(`The listing gives ${area} m² as the property area and ${livingArea} m² as living area. Confirm which area is registered and what the difference includes.`);
  const descriptionPrices = [...description.matchAll(/(\d{1,3}(?:[., ]\d{3}){2,})\s*(?:դրամ|drams|AMD|֏)/gi)].map(m => number(m[1]));
  if (currency === 'AMD' && descriptionPrices.some(p => p && p !== originalPrice)) warnings.push('The description and headline quote different prices. The report uses the current headline price; confirm it with the seller.');
  if (titleArea && !districts.test(titleArea) && city.toLowerCase() !== titleArea.toLowerCase()) warnings.push(`The title says ${titleArea}, while the Location section says ${city}. The map link follows the Location section; confirm the municipality.`);
  if (approximate) warnings.push('The listing does not disclose an exact address. The map shows the stated street or area, not the property’s verified position.');
  const landUse = type === 'land' ? (/residential development|residential construction/i.test(title) ? 'Residential development (advertised)' : /agricultural/i.test(title) ? 'Agricultural (advertised)' : /public buildings/i.test(title) ? 'Public buildings (advertised)' : /general purpose/i.test(title) ? 'General purpose (advertised)' : undefined) : undefined;
  const utilities = /communications next to the land/i.test(description) ? 'Connections nearby; not confirmed on the plot' : /all communications are laid/i.test(description) ? 'All connections laid (seller statement)' : undefined;
  const roadAccess = /\b(?:asphalt|paved)\s+(?:road|access)/i.test(description) ? 'Paved road (seller statement)' : undefined;
  const occupancy = /\bnot rented\b|\bvacant\b/i.test(description) ? 'Not rented' : /\b(?:currently rented|currently tenanted|sold with tenants)\b/i.test(description) ? 'Rented' : undefined;
  const condition = /^Finished$|^Unfinished$|^Under construction$/i.test(field('Condition')) ? field('Condition') : '';
  const shortPlace = street || (districts.test(titleArea || '') ? titleArea : city);
  const descriptor = type === 'land' ? `${area} m² land plot` : rooms ? `${rooms}-room ${type}` : `${area} m² ${type}`;
  const reportTitle = `${descriptor} · ${shortPlace}`;
  const summary = `${descriptor[0].toUpperCase()}${descriptor.slice(1)} in ${address}, advertised at ${amd(price)}${currency !== 'AMD' ? ` (${originalPrice.toLocaleString('en-GB')} ${currency}${perM2 ? ' per m²' : ''}, converted using the CBA rate dated ${fx!.date})` : ''}. ${type === 'house' && plotArea ? `The listing includes ${plotArea} m² of land. ` : ''}${type === 'flat' && floor ? `Floor ${floor}${floors ? ` of ${floors}` : ''}. ` : ''}${newConstruction === true ? 'Advertised as a new building. ' : ''}${renovation === 'None' ? 'No renovation is recorded; allow for fit-out costs. ' : renovation ? `Renovation: ${renovation.toLowerCase()}. ` : ''}\n\n${warnings.length ? warnings.join(' ') : type === 'land' ? 'The advertised land use is not proof of permission to build. Check the cadastral extract, permitted use, legal road access and connection costs before committing.' : 'The listing does not establish structural condition, legal title or financing eligibility. Check the cadastral documents and inspect the property before making an offer.'}`;
  const evidence: Record<string, string> = { title, askingPrice: priceLine, location: address, area: `${area} m²` };
  return {
    id: '', country: 'AM', title: reportTitle, address, location: titleArea || city, propertyType: type, source, createdAt: new Date().toISOString(),
    facts: { price, area, rooms: type === 'land' ? '' : rooms, year: '', floor: type === 'flat' ? floor : '', energy: '', heating: '', totalCost: 0, city, street, district: districts.test(titleArea || '') ? titleArea : undefined, locationPrecision: approximate ? (street ? 'street' : 'city') : (street ? 'address' : 'city'), condition, tenancy: occupancy },
    armenia: { currency: 'AMD', originalPrice, originalCurrency: currency, priceBasis: perM2 ? 'per-m2' : 'total', fx: currency !== 'AMD' ? { rate: conversion, date: fx!.date, sourceUrl: fx!.sourceUrl } : undefined, plotArea, livingArea, landUse, buildingFloors: floors, construction, renovation, newConstruction, elevator: /^(Available|Not available)$/i.test(field('Elevator')) ? field('Elevator') : undefined, balcony: /^(Open|Closed|Not available)$/i.test(field('Balcony')) ? field('Balcony') : undefined, utilities, roadAccess, approximate, sourceUpdated: raw.match(/Renewed\s+(\d{2}\.\d{2}\.\d{4})/)?.[1], importMethod: method, evidence },
    score: 0, summary, considerations: warnings,
    offerQuestions: type === 'land' ? ['Does the cadastral extract confirm the plot boundaries and permitted use?', 'Is there a registered right of road access?', 'What will utility connections and site preparation cost?'] : ['Does the cadastral extract match the seller and advertised area?', ...(newConstruction ? ['Is the building commissioned and registered?', 'What fit-out work is included in the price?'] : ['Are structural and seismic inspection records available?', 'What repairs and shared-building costs are planned?'])],
    sunOrientation: '', aiEnriched: false, qualityWarnings: warnings,
  };
}
