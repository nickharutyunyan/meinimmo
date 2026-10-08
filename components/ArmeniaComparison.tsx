import Link from 'next/link';
import type { Report } from '@/lib/types';
import { amd, mapsLink } from '@/lib/countries';
import { SiteNav } from './SiteNav';
import { SiteFooter } from './SiteFooter';
import { ComparisonShareButton } from './ComparisonShareButton';

export function ArmeniaComparison({ first, second }: { first: Report; second: Report }) {
  const items = [first, second]; const land = items.every(r => r.propertyType === 'land');
  const attributes: [string, (r:Report) => string | undefined][] = [
    ['Property type', r => r.propertyType === 'land' ? 'Land plot' : r.propertyType === 'flat' ? 'Apartment' : 'House'],
    ['Neighborhood', r => r.facts.district], ['Asking price', r => amd(r.facts.price)],
    ['Original asking price', r => `${r.armenia!.originalPrice.toLocaleString('en-GB')} ${r.armenia!.originalCurrency}${r.armenia!.priceBasis === 'per-m2' ? ' per m²' : ''}`],
    ['Conversion date', r => r.armenia!.fx?.date], ['Advertised building area', r => r.propertyType !== 'land' ? `${r.facts.area} m²` : undefined],
    ['Living area', r => r.armenia?.livingArea ? `${r.armenia.livingArea} m²` : undefined],
    ['Land area', r => r.armenia!.plotArea ? `${r.armenia!.plotArea} m²` : undefined],
    [land ? 'Price per land m²' : 'Price per advertised m²', r => `${amd(r.facts.price / r.facts.area)}${!land && r.propertyType === 'land' ? ' (land)' : ''}`],
    ['Rooms', r => r.facts.rooms], ['Floor', r => r.facts.floor ? `${r.facts.floor}${r.armenia!.buildingFloors ? ` / ${r.armenia!.buildingFloors}` : ''}` : undefined],
    ['New construction', r => r.armenia!.newConstruction === undefined ? undefined : r.armenia!.newConstruction ? 'Yes' : 'No'],
    ['Construction', r => r.armenia!.construction], ['Renovation', r => r.armenia!.renovation === 'None' ? 'Not renovated' : r.armenia!.renovation],
    ['Advertised land use', r => r.armenia!.landUse], ['Utilities', r => r.armenia!.utilities], ['Road access', r => r.armenia!.roadAccess],
    ['Occupancy', r => r.facts.tenancy], ['Important checks', r => r.qualityWarnings?.join(' ')],
  ];
  const rows = attributes.filter(([, read]) => items.some(r => read(r)));
  return <main className="comparison-page am-comparison"><SiteNav locale="en" country="AM"/><div className="comparison-top"><p className="eyebrow">Armenia · Property comparison</p><ComparisonShareButton locale="en"/></div><h1>{land ? 'Two plots, side by side.' : 'Two properties, side by side.'}</h1><div className="am-table-scroll"><table><thead><tr><th scope="col">Property</th>{items.map(r => <th key={r.id} scope="col"><Link href={`/r/${r.id}`}>{r.title} ↗</Link></th>)}</tr></thead><tbody><tr><th scope="row">Address</th>{items.map(r => <td key={r.id}><a href={mapsLink(r.address)} target="_blank" rel="noreferrer">{r.address} ↗</a>{r.armenia!.approximate && <small>Approximate location</small>}</td>)}</tr>{rows.map(([label, read]) => <tr key={label}><th scope="row">{label}</th>{items.map(r => <td key={r.id}>{read(r) || '—'}</td>)}</tr>)}</tbody></table></div><p className="am-source-note">AMD values use the CBA exchange rate saved with each report. Different conversion dates may affect the comparison. Advertised land use and utility proximity are not proof of building permission or active connections.</p><SiteFooter locale="en"/></main>;
}
