import test from 'node:test';
import assert from 'node:assert/strict';
import { listAmUrl, fetchEnglishListAm } from '../lib/list-am.ts';
const canonical = 'https://www.list.am/en/item/22791157';
test('all supported List.am language links normalize to the identical English advert', () => {
  for (const prefix of ['', 'am/', 'hy/', 'ru/', 'en/']) {
    assert.equal(listAmUrl(`https://www.list.am/${prefix}item/22791157?ld_src=2#details`), canonical);
  }
});
test('the exact user link is fetched in English without a language-selection round trip', async () => {
  const calls = [];
  const result = await fetchEnglishListAm('https://www.list.am/item/22791157?ld_src=2', async (url, options) => {
    calls.push({url, options}); return new Response('<h1>Apartment</h1>');
  });
  assert.equal(result.source, canonical); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, canonical); assert.match(calls[0].options.headers['Accept-Language'], /^en/);
});
test('same-ad host redirects remain English; external and other-ad redirects are rejected', async () => {
  const calls = [];
  await fetchEnglishListAm(canonical, async url => {
    calls.push(url);
    return calls.length === 1 ? new Response(null, {status:302,headers:{location:'https://list.am/ru/item/22791157?lang=ru'}}) : new Response('<h1>Apartment</h1>');
  });
  assert.deepEqual(calls, [canonical, 'https://list.am/en/item/22791157']);
  for (const location of ['http://127.0.0.1/','https://evil.example/item/22791157','https://list.am/en/item/999']) {
    let count = 0;
    await assert.rejects(fetchEnglishListAm(canonical, async () => {count++;return new Response(null,{status:302,headers:{location}});}), e=>e.code==='source_blocked');
    assert.equal(count,1);
  }
});
test('unavailable adverts and anti-bot responses do not create reports or ask users to change language', async () => {
  for (const [response, code] of [[new Response('',{status:404}),'listing_unavailable'],[new Response('',{status:403}),'source_blocked'],[new Response('<title>Just a moment</title>captcha'),'source_blocked']]) {
    await assert.rejects(fetchEnglishListAm(canonical,async()=>response),error=>{
      assert.equal(error.code,code);assert.doesNotMatch(error.message,/copy|paste|open its English/i);return true;
    });
  }
});
