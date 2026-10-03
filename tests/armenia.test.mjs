import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArmeniaListing, listAmUrl, listAmText } from '../lib/armenia-parser.ts';
import { parseCbaExchangeRates, parseAcbaMortgageRate } from '../lib/armenia-finance.ts';
import { monthlyPayment } from '../lib/countries.ts';
import { listings } from './fixtures/armenia-listings.mjs';
const fx = { date: '2026-09-22', rates: { USD:363.46, EUR:416.74, RUB:4.3 }, sourceUrl:'https://www.cba.am/en/exchange-rates-retrieval' };
const parse = item => parseArmeniaListing(item.text, `https://www.list.am/en/item/${item.id}`, fx);
for (const item of listings) test(`List.am ${item.id}: ${item.type} in ${item.city}`, () => {
  const result = parse(item);
  assert.equal(result.country, 'AM'); assert.equal(result.propertyType, item.type);
  assert.equal(result.armenia.originalPrice, item.price); assert.equal(result.armenia.originalCurrency, item.currency);
  assert.equal(result.facts.price, Math.round(item.price * (fx.rates[item.currency] || 1)));
  assert.equal(result.facts.area, item.area); assert.equal(result.armenia.plotArea, item.plot);
  assert.equal(result.facts.rooms, item.rooms); assert.equal(result.facts.city, item.city);
  assert.equal(result.facts.floor, item.floor || ''); assert.equal(result.armenia.sourceUpdated, item.renewed);
  assert.equal(result.facts.energy, ''); assert.equal(result.facts.totalCost, 0); assert.equal(result.facts.housegeld, undefined);
  assert.doesNotMatch(result.title, /unknown|not stated|Germany|Berlin/);
});
test('house gross vs living area is preserved; conflicting Armenian price is flagged', () => {
  assert.equal(parse(listings[0]).armenia.livingArea,145);
  const result = parse(listings[1]);
  assert.equal(result.armenia.livingArea,130);
  assert.match(result.qualityWarnings.join(' '),/different prices/);
  assert.equal(result.facts.price,59000000);
  assert.notEqual(result.facts.condition,'Renovated');
});
test('approximate marker removes misleading house number and municipal conflict stays visible', () => {
  const result=parse(listings[4]); assert.equal(result.address,'Margaryan Street, Yerevan'); assert.equal(result.armenia.approximate,true);
  assert.match(parse(listings[5]).qualityWarnings.join(' '),/Ashtarak.*Nor Yerznka/);
});
test('copied greyed-out amenity labels and leasing opportunity are not positive facts', () => {
  const r=parse(listings[3]); assert.equal(r.facts.tenancy,undefined); assert.equal(r.facts.features,undefined);
  assert.equal(r.location,'Tsaghkadzor'); assert.deepEqual(r.qualityWarnings,[]);
  assert.equal(parse(listings[5]).armenia.utilities,undefined);
  assert.match(parse(listings[4]).armenia.utilities,/not confirmed/);
});
test('URL normalizes languages and tracking but rejects private hosts, auth and search pages', () => {
  assert.equal(listAmUrl('https://list.am/ru/item/23494915?foo=1'), 'https://www.list.am/en/item/23494915');
  for (const url of ['http://localhost/item/123','https://list.am.evil.com/item/123','https://list.am/category/60','https://user:secret@list.am/item/123','https://list.am:444/item/123']) assert.equal(listAmUrl(url),undefined);
});
test('rejects rentals, non-listings, missing currency and missing FX instead of guessing', () => {
  assert.throws(()=>parseArmeniaListing('Just a moment…','source'), /English version/);
  assert.throws(()=>parseArmeniaListing(listings[3].text.replace('For Sale','Long Term Rentals'),'source'),/not a confirmed/);
  assert.throws(()=>parseArmeniaListing(listings[3].text.replace('27,500,000 ֏','27,500,000'),'source'),/price and currency/);
  assert.throws(()=>parseArmeniaListing(listings[2].text,'source'),/exchange rate/);
});
test('per-square-metre price is multiplied once and stays explicit',()=>{
  const r=parseArmeniaListing(listings[5].text.replace('$36,000','$72 per m²'),'source',fx);
  assert.equal(r.armenia.priceBasis,'per-m2'); assert.equal(r.facts.price, Math.round(36000*363.46));
});
test('HTML extraction ignores scripts and preserves field boundaries',()=>{
  const html='<script>Price 2 AMD</script><h1>House</h1><div><p>144 sq.m.</p><p>House Area</p></div>';
  const text=listAmText(html); assert.doesNotMatch(text,/Price 2/); assert.match(text,/144 sq.m.\n+House Area/);
});
test('desktop sidebar headline after property details preserves rooms, current price and address',()=>{
  const source = `For Sale
Houses
13/3 Nubarashen 1st Street, Yerevan
42 sq.m.
House Area
226 sq.m.
Total Land Area
1
Floors in the Building
2
Number of Rooms
Stone
Construction Type
Location
13/3 Nubarashen 1st Street, Yerevan
Similar Ads
$75,000
Renovation
Cosmetic
Condition
Finished
Price History
$67,500
Description
Վաճառվում է 2 սենյականոց սեփական տուն Նուբարաշենում։
Mortgage Calculator
Estimated monthly payment
246,963 ֏
Renewed 22.09.2026
Single story stone house on Nubarashen 1st Street in Nubarashen, 42 sq.m., on a 226 sq.m. land
$72,500
Property Not Verified`;
  const result = parseArmeniaListing(source,'https://www.list.am/en/item/22791157',fx);
  assert.equal(result.armenia.originalPrice,72500); assert.equal(result.facts.rooms,'2');
  assert.equal(result.armenia.plotArea,226); assert.equal(result.facts.area,42);
  assert.equal(result.title,'2-room house · 13/3 Nubarashen 1st Street');
  assert.equal(result.facts.price,26350850); assert.equal(result.facts.district,'Nubarashen');
});
test('CBA FX respects the denomination, including 100-unit currencies',()=>{
  const xml='<CurrentDate>2026-09-22T00:00:00</CurrentDate><ExchangeRate><ISO>USD</ISO><Amount>1</Amount><Rate>363.46</Rate></ExchangeRate><ExchangeRate><ISO>EUR</ISO><Amount>1</Amount><Rate>416.74</Rate></ExchangeRate><ExchangeRate><ISO>JPY</ISO><Amount>100</Amount><Rate>250</Rate></ExchangeRate>';
  assert.equal(parseCbaExchangeRates(xml).rates.JPY,2.5);
  assert.throws(()=>parseCbaExchangeRates('<error/>'));
});
test('mortgage parser uses only the explicitly labelled lender example',()=>{
  assert.equal(parseAcbaMortgageRate('<p>Policy rate 6.75%</p><p>Loan interest calculation example:</p><p>Loan amount – AMD 20,000,000</p><p>Loan interest rate – 13.5% (floating)</p>'),13.5);
  assert.throws(()=>parseAcbaMortgageRate('Policy rate 6.75%'));
});
test('amortization matches independent Acba example and handles zero interest/cash',()=>{
  assert.ok(Math.abs(monthlyPayment(20000000,13.5,20)-241475)<1);
  assert.equal(monthlyPayment(1200000,0,10),10000); assert.equal(monthlyPayment(0,13.5,20),0);
  assert.equal(monthlyPayment(-1,13.5,20),0);
});
