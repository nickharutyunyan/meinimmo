import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { canonicalListing, allowedSender } from '../extensions/reviewahouse/policy.mjs';
import { readListing } from '../extensions/reviewahouse/extract.mjs';
import { parseArmeniaListing } from '../lib/armenia-parser.ts';

const source = 'https://www.list.am/en/item/22791157';
test('helper URL policy rejects other hosts, credentials, ports and non-listings', () => {
  assert.equal(canonicalListing('https://list.am/item/22791157?ld_src=2'), source);
  assert.equal(canonicalListing('https://www.list.am/ru/item/22791157/'), source);
  for (const url of ['https://list.am.evil.test/item/1', 'https://user:secret@list.am/item/1', 'https://list.am:3000/item/1', 'https://list.am/category/62', 'file:///item/1', 'javascript:alert(1)']) assert.equal(canonicalListing(url), null);
});
test('helper accepts only its own top-frame bridge on the exact production domains', () => {
  const sender = { id:'helper', frameId:0, tab:{id:1}, url:'https://reviewahouse.com/am' };
  assert.equal(allowedSender(sender,'helper'),true);
  for (const overrides of [{id:'other'}, {frameId:1}, {tab:{}}, {url:'https://evil.reviewahouse.com/am'}, {url:'http://reviewahouse.com/am'}, {url:'https://reviewahouse.com.evil.test'}]) assert.equal(allowedSender({...sender,...overrides},'helper'),false);
});
test('extension permissions exclude cookies, storage, history and unrelated sites', () => {
  const manifest = JSON.parse(readFileSync(new URL('../extensions/reviewahouse/manifest.json', import.meta.url)));
  assert.deepEqual(manifest.permissions,['scripting']);
  assert.deepEqual(manifest.host_permissions,['https://www.list.am/*','https://list.am/*']);
  assert.deepEqual(manifest.content_scripts[0].matches,['https://reviewahouse.com/*','https://www.reviewahouse.com/*']);
});
function extractionFixture({sale=true,challenge=false,url=source} = {}) {
  const node = (innerText, cls='') => ({innerText, getClientRects:()=>[{}], matches:selector=>selector.split(',').some(s=>s.trim()===`.${cls}`)});
  const fields = [node('42 sq.m.\nHouse Area\n226 sq.m.\nTotal Land Area\n1\nFloors in the Building\n2\nNumber of Rooms\nStone\nConstruction Type','attr'), node('Location','gt'), node('13/3 Nubarashen 1st Street, Yerevan','post-location-title'), node('Renovation\nCosmetic\nCondition\nFinished','attr'), node('$75,000','poi-container'),node('Price History','gt'),node('$57,500','price_history'),node('Description','gt'),node('Public description','body'),node('Estimated monthly payment 246,963 ֏','re8')];
  const doc = {title:challenge?'Just a moment…':'House',body:{innerText:''},querySelector:()=>challenge?null:{children:fields},querySelectorAll:selector=>challenge?[]:selector==='h1'?[node('Single story stone house on Nubarashen 1st Street in Nubarashen, 42 sq.m., on a 226 sq.m. land')]:selector.includes('price')?[node('$72,500')]:[node(sale?'For Sale':'Long Term Rentals')]};
  return vm.runInNewContext(`(${readListing.toString()})(source)`,{source,location:{href:url},document:doc,getComputedStyle:()=>({visibility:'visible',display:'block'})});
}
test('browser extraction excludes map ads, price history and calculator; parser preserves facts', () => {
  const result = extractionFixture();
  assert.equal(result.state,'ready');
  assert.doesNotMatch(result.text,/75,000|57,500|246,963|Price History/);
  const report = parseArmeniaListing(result.text,source,{date:'2026-09-22',rates:{USD:363.46},sourceUrl:'https://www.cba.am'},'browser');
  assert.equal(report.armenia.originalPrice,72500);
  assert.equal(report.facts.price,26350850);
  assert.equal(report.armenia.plotArea,226);
  assert.equal(report.armenia.importMethod,'browser');
  assert.match(report.title,/13\/3 Nubarashen 1st Street/);
});
test('extractor fails closed on rentals, challenge pages and different listings', () => {
  assert.equal(extractionFixture({sale:false}).state,'unsupported');
  assert.equal(extractionFixture({challenge:true}).state,'verification');
  assert.equal(extractionFixture({url:'https://www.list.am/en/item/999'}).state,'wrong-page');
});
test('bridge requires real submission, rejects foreign messages and consumes gesture once', async () => {
  const listeners = {}; const sent=[]; const replies=[];
  class Form { matches(){return true;} }
  const win = {addEventListener:(name,fn)=>listeners[name]=fn,postMessage:msg=>replies.push(msg)};
  win.top=win;
  vm.runInNewContext(readFileSync(new URL('../extensions/reviewahouse/bridge.js',import.meta.url),'utf8'),{window:win,location:{origin:'https://reviewahouse.com'},document:{addEventListener:(name,fn)=>listeners[name]=fn},HTMLFormElement:Form,chrome:{runtime:{sendMessage:async msg=>{sent.push(msg);return {ok:true};}}}});
  const request = {source:win,origin:'https://reviewahouse.com',data:{channel:'rah-helper-request',id:'1',kind:'import',url:source}};
  await listeners.message(request); assert.equal(sent.length,0);
  listeners.submit({isTrusted:false,target:new Form()}); await listeners.message(request); assert.equal(sent.length,0);
  listeners.submit({isTrusted:true,target:new Form()});
  await listeners.message({...request,origin:'https://evil.test'}); assert.equal(sent.length,0);
  await listeners.message(request); assert.equal(sent.length,1);
  await listeners.message(request); assert.equal(sent.length,1);
});

async function backgroundFixture(state, currentUrl=source) {
  let listener; const removed=[]; const created=[];
  const chrome = {runtime:{id:'helper',getManifest:()=>({version:'0.1.0'}),onMessage:{addListener:fn=>listener=fn}},tabs:{create:async opts=>{created.push(opts);return{id:42};},get:async()=>({url:currentUrl}),remove:async id=>removed.push(id),update:async()=>{}},scripting:{executeScript:async()=>[{result:{state,source,text:'public listing'}}]}};
  const code = readFileSync(new URL('../extensions/reviewahouse/background.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  vm.runInNewContext(code,{chrome,canonicalListing,allowedSender,readListing,setTimeout});
  const sender={id:'helper',frameId:0,tab:{id:1},url:'https://reviewahouse.com/am'};
  const result = await new Promise(resolve=>listener({kind:'import',url:source},sender,resolve));
  return {result,removed,created,listener,sender};
}
test('helper opens one background tab, returns content and closes only its own listing', async()=>{
  const job=await backgroundFixture('ready');
  assert.equal(job.result.text,'public listing'); assert.equal(job.created.length,1);
  assert.equal(job.created[0].active,false); assert.deepEqual(job.removed,[42]);
});
test('helper rejects unsupported content and does not close a tab navigated elsewhere', async()=>{
  const rental=await backgroundFixture('unsupported'); assert.match(rental.result.error,/for-sale/); assert.deepEqual(rental.removed,[42]);
  const moved=await backgroundFixture('ready','https://www.list.am/en/item/99');
  assert.match(moved.result.error,/navigated away/); assert.deepEqual(moved.removed,[]);
});
