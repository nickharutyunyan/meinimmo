const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dns = require('node:dns').promises;
const net = require('node:net');

const root = __dirname;
const storePath = path.join(root, 'data', 'reports.json');
const comparisonsPath = path.join(root, 'data', 'comparisons.json');
if (fs.existsSync(path.join(root, '.env'))) for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) { const [,key,value] = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/) || []; if (key && !process.env[key]) process.env[key] = value.replace(/^['"]|['"]$/g, ''); }
const config = { port: Number(process.env.PORT || 3000), openRouterKey: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini', appUrl: process.env.APP_URL || 'http://localhost:3000' };
const limits = new Map();
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const readStore = () => JSON.parse(fs.readFileSync(storePath, 'utf8'));
const save = report => { const all = readStore(); all.push(report); fs.writeFileSync(storePath, JSON.stringify(all, null, 2)); };
const readComparisons = () => JSON.parse(fs.readFileSync(comparisonsPath, 'utf8'));
const saveComparison = comparison => { const all=readComparisons(); all.push(comparison); fs.writeFileSync(comparisonsPath, JSON.stringify(all,null,2)); };
const clean = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const match = (text, rx) => (text.match(rx) || [])[1];
const number = value => value ? Number(String(value).replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '')) : null;
function streetOnly(value) {
  const text = clean(value).replace(/\b(?:provisionsfrei|wohnung|eigentumswohnung|haus|kauf|verkauf)\b/gi, ' ');
  const attached = text.match(/\b([A-ZÄÖÜ][\wäöüß.-]*(?:straße|str\.|allee|weg|platz|gasse)\s+\d{1,3}[a-z]?)\b/i);
  const separate = text.match(/\b([A-ZÄÖÜ][\wäöüß.-]*(?:\s+[A-ZÄÖÜ][\wäöüß.-]*){0,2}\s+(?:Straße|Str\.|Allee|Weg|Platz|Gasse)\s+\d{1,3}[a-z]?)\b/);
  return (separate || attached || [,'Street not stated'])[1].replace(/\s+/g, ' ').trim();
}

function usageFor(req) { const ip=req.socket.remoteAddress || 'unknown', today=new Date().toISOString().slice(0,10), entry=limits.get(ip) || {count:0,day:today}; if(entry.day!==today){entry.count=0;entry.day=today;limits.set(ip,entry);} return entry; }
function canAssess(req) { return usageFor(req).count < 2; }
function recordAssessment(req) { usageFor(req).count++; }
async function safeListingUrl(value) { let url; try { url = new URL(value); } catch { return false; } if (!['http:','https:'].includes(url.protocol) || ['localhost','0.0.0.0','::1'].includes(url.hostname)) return false; try { const {address} = await dns.lookup(url.hostname); return !(net.isIP(address) && /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address)); } catch { return false; } }

async function enrichWithAI(report, sourceText) {
  if (!config.openRouterKey) return report;
  const prompt = `You are Habitat, a precise German residential-property analyst. Use only the source and extracted facts below. Return strict JSON only: {"score":number 0-10,"summary":"2 concise sentences","considerations":["actionable issue 1","actionable issue 2","actionable issue 3"],"sunOrientation":"stated orientation or not stated"}. Do not invent facts, price estimates, transit times, legal claims or mortgage rates. Source may contain sales fluff; remove it. Extracted facts: ${JSON.stringify(report.facts)}. Source: ${sourceText.slice(0,45000)}`;
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${config.openRouterKey}`,'http-referer':config.appUrl,'x-title':'Habitat'},body:JSON.stringify({model:config.model,temperature:0.15,response_format:{type:'json_object'},messages:[{role:'user',content:prompt}]})});
  if (!response.ok) throw new Error('AI assessment service is temporarily unavailable.');
  const payload = await response.json(), content = payload.choices?.[0]?.message?.content, analysis = JSON.parse(content);
  return {...report,score:Number.isFinite(analysis.score)?Math.max(0,Math.min(10,analysis.score)):report.score,summary:typeof analysis.summary === 'string'?analysis.summary:report.summary,considerations:Array.isArray(analysis.considerations)?analysis.considerations.slice(0,3):report.considerations,sunOrientation:analysis.sunOrientation || 'not stated',model:config.model};
}

function validateListing(text, sourceType) {
  const unavailable = /(?:\b404\b|seite\s+nicht\s+gefunden|page\s+not\s+found|angebot\s+(?:ist\s+)?nicht\s+(?:mehr\s+)?verf[uü]gbar|immobilie\s+(?:ist\s+)?nicht\s+(?:mehr\s+)?verf[uü]gbar|objekt\s+(?:ist\s+)?nicht\s+(?:mehr\s+)?verf[uü]gbar)/i.test(text);
  const checks = {
    price: /(?:kaufpreis|mietpreis|preis)\s*[:\-]?\s*[\d.]+(?:,\d+)?\s*(?:€|eur)/i.test(text),
    area: /(?:wohnfl[aä]che|fl[aä]che)\s*(?:ca\.)?\s*[:\-]?\s*[\d.,]+\s*(?:m²|qm)/i.test(text),
    rooms: /\b[\d,]+\s*(?:zimmer|zi\.)/i.test(text),
    address: /\b\d{5}\s+[A-ZÄÖÜ][\wäöüß.-]+/i.test(text),
    building: /(?:baujahr|energieausweis|energieeffizienzklasse|heizungsart|objektzustand|etage|geschoss)/i.test(text),
    listing: /(?:expos[eé]|kaufobjekt|eigentumswohnung|wohnung\s+zum\s+kauf|haus\s+zum\s+kauf|provision)/i.test(text)
  };
  const facts = Object.values(checks).filter(Boolean).length;
  const hasCore = checks.price || checks.area || checks.rooms;
  const enoughEvidence = sourceType === 'pdf' ? facts >= 3 && hasCore : facts >= 4 && hasCore && checks.listing;
  return {ok: enoughEvidence && !unavailable, facts, unavailable};
}

function extract(text, source) {
  const price = number(match(text, /(?:Kaufpreis|Preis)\s*[:\-]?\s*([\d.]+(?:,\d+)?)\s*(?:€|EUR)/i)) || 545000;
  const area = number(match(text, /(?:Wohnfl[aä]che|Fl[aä]che)\s*(?:ca\.)?\s*[:\-]?\s*([\d.,]+)\s*(?:m²|qm)/i)) || 72;
  const rooms = match(text, /([\d,]+)\s*(?:Zimmer|Zi\.)/i) || '3';
  const year = match(text, /(?:Baujahr|erbaut)\s*[:\-]?\s*(\d{4})/i) || 'unknown';
  const floor = match(text, /\b(?:Etage|Geschoss|Stockwerk)\b\s*[:\-]?\s*((?:\d{1,2}\.?\s*(?:OG|Obergeschoss)|EG|Erdgeschoss|Dachgeschoss|Souterrain)(?:\s*(?:von|\/)\s*\d{1,2})?)/i) || match(text, /\b(\d{1,2}\.?\s*OG)\b/i) || 'not stated';
  const energy = match(text, /(?:Energieeffizienzklasse|Effizienzklasse)\s*[:\-]?\s*([A-H][+]?)/i) || 'not stated';
  const heating = match(text, /(?:Heizungsart|Heizung)\s*[:\-]?\s*([^\n,.]{1,40})/i) || 'not stated';
  const address = match(text, /([A-ZÄÖÜ][\wäöüß.\- ]*(?:straße|str\.|allee|weg|platz|gasse)\s+\d{1,3}[a-z]?,?\s*\d{5}\s+[A-ZÄÖÜ][\wäöüß.\- ]+)/i) || clean(match(text, /(?:Adresse|Lage)\s*[:\-]?\s*([^\n]{4,80})/i)) || 'Address not stated';
  const propertyType = /(?:einfamilienhaus|reihenhaus|doppelhaush[aä]lfte|haus\s+zum\s+kauf|haus\s+zu\s+verkaufen)/i.test(text) ? 'house' : 'flat';
  const title = `${rooms}-room ${propertyType} · ${streetOnly(address)}`;
  const costs = Math.round(price * .1028);
  const score = energy === 'not stated' ? 7.0 : ['A+','A','B','C'].includes(energy) ? 8.3 : ['D','E'].includes(energy) ? 7.5 : 6.4;
  return { title, address, propertyType, source, createdAt:new Date().toISOString(), facts:{price,area,rooms,year,floor,energy,heating,totalCost:price+costs}, score, summary:`This listing is presented as a ${rooms}-room property with ${area} m² at €${price.toLocaleString('de-DE')}. Habitat found ${year === 'unknown' ? 'no confirmed construction year' : `a construction year of ${year}`} and an energy class of ${energy}.`, considerations:[`Verify the floor, orientation and direct daylight during the viewing—the source lists the floor as ${floor}.`,energy === 'not stated' ? 'Request the Energieausweis before making an offer.' : `Review running costs and any upgrade plan for the ${energy} energy rating and ${heating} heating.`, 'Ask for WEG minutes, maintenance reserve and planned Sonderumlagen before committing.'] };
}

async function body(req) { let raw=''; for await (const chunk of req) { raw += chunk; if(raw.length > 1_100_000) throw new Error('Request is too large.'); } return JSON.parse(raw || '{}'); }
function json(res, status, data) { res.writeHead(status, {'content-type':'application/json'}); res.end(JSON.stringify(data)); }

const server = http.createServer(async (req,res) => {
  res.setHeader('x-content-type-options','nosniff'); res.setHeader('x-frame-options','DENY'); res.setHeader('referrer-policy','strict-origin-when-cross-origin'); res.setHeader('content-security-policy',"default-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; script-src 'self' https://cdnjs.cloudflare.com; worker-src 'self' https://cdnjs.cloudflare.com blob:; frame-src https://www.openstreetmap.org; connect-src 'self' https://cdnjs.cloudflare.com;");
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/usage') { const usage=usageFor(req); return json(res,200,{used:usage.count,limit:2,remaining:Math.max(0,2-usage.count)}); }
  if (req.method === 'POST' && url.pathname === '/api/assess') {
    try { if(!canAssess(req)) return json(res,429,{error:'You have used your 2 free assessments for today. Upgrade for more daily assessments.'}); const {url: listingUrl} = await body(req); if (!await safeListingUrl(listingUrl)) return json(res,400,{error:'Enter a public http(s) listing URL.'});
      const response = await fetch(listingUrl,{headers:{'user-agent':'Habitat assessment prototype/0.1'}}); const html = await response.text(); const text = clean(html);
      const validation = validateListing(text, 'url');
      if (!response.ok || !validation.ok) return json(res,422,{error: validation.unavailable || response.status === 404 ? 'This listing is no longer available or the page does not exist.' : [401,403].includes(response.status) ? 'This portal requires a signed-in browser session and blocked the import. Download the Exposé and upload its PDF instead.' : 'This page does not look like a real-estate listing. Please use a specific property listing or upload its Exposé PDF.'});
      let report = extract(text, listingUrl); report = await enrichWithAI(report,text); report.id = crypto.randomBytes(8).toString('hex'); save(report); recordAssessment(req); return json(res,201,report);
    } catch (error) { return json(res,422,{error:'We could not read that listing. Some portals block automated access; try its Exposé PDF instead.'}); }
  }
  if (req.method === 'POST' && url.pathname === '/api/assess-pdf') {
    try { if(!canAssess(req)) return json(res,429,{error:'You have used your 2 free assessments for today. Upgrade for more daily assessments.'}); const {text,name} = await body(req); if (!text || text.length > 1_000_000) return json(res,400,{error:'No readable PDF text found.'}); if (!validateListing(text, 'pdf').ok) return json(res,422,{error:'This PDF does not appear to be a property Exposé. Upload a listing brochure, floor plan or energy certificate with property details.'}); let report = extract(text, name || 'PDF Exposé'); report = await enrichWithAI(report,text); report.id=crypto.randomBytes(8).toString('hex'); save(report); recordAssessment(req); return json(res,201,report); } catch (error) { return json(res,500,{error:error.message || 'Could not save this assessment.'}); }
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/reports/')) { const report=readStore().find(r=>r.id===url.pathname.split('/').pop()); return report ? json(res,200,report) : json(res,404,{error:'Report not found.'}); }
  if (req.method === 'GET' && url.pathname === '/api/reports') return json(res,200,readStore().slice(-40).reverse().map(({id,title,address,propertyType,createdAt,facts})=>({id,title,address,propertyType,createdAt,rooms:facts.rooms})));
  if (req.method === 'POST' && url.pathname === '/api/comparisons') { try { const {reportIds} = await body(req); if(!Array.isArray(reportIds) || reportIds.length !== 2 || new Set(reportIds).size !== 2) return json(res,400,{error:'Choose exactly two distinct properties.'}); const reports=readStore().filter(report=>reportIds.includes(report.id)); if(reports.length !== 2) return json(res,404,{error:'One of the selected reports no longer exists.'}); const comparison={id:crypto.randomBytes(8).toString('hex'),reportIds,createdAt:new Date().toISOString()}; saveComparison(comparison); return json(res,201,comparison); } catch { return json(res,500,{error:'Could not create comparison.'}); } }
  if (req.method === 'GET' && url.pathname.startsWith('/api/comparisons/')) { const comparison=readComparisons().find(item=>item.id===url.pathname.split('/').pop()); if(!comparison) return json(res,404,{error:'Comparison not found.'}); const reports=comparison.reportIds.map(id=>readStore().find(report=>report.id===id)).filter(Boolean); return reports.length===2 ? json(res,200,{...comparison,reports}) : json(res,404,{error:'A compared report no longer exists.'}); }
  if (url.pathname.startsWith('/r/')) return serve(path.join(root,'index.html'),res);
  if (url.pathname.startsWith('/c/')) return serve(path.join(root,'index.html'),res);
  const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!file.startsWith(root)) return json(res,403,{error:'Forbidden'}); serve(file,res);
});
function serve(file,res) { fs.readFile(file,(err,data)=>{ if(err){res.writeHead(404);return res.end('Not found');} res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(data); }); }
server.listen(config.port, () => console.log(`Habitat running at ${config.appUrl}`));
