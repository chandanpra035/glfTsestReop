/** GLF RESERVE LOCAL-ONLY test server. Never deploy this file to Vercel. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const HOST = '127.0.0.1';
const PORT = 5500;
const CONFIG_FILE = path.join(ROOT, 'local-settings.json');
if (!fs.existsSync(CONFIG_FILE)) {
  console.error('Missing local-settings.json — copy local-settings.example.json and fill it in.');
  process.exit(1);
}
const conf = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const mandatory = ['signupScriptUrl','signupSecret','welcomeKitScriptUrl','welcomeKitSecret','chandanEmailScriptUrl','chandanEmailSecret','tokenSecret'];
const missing = mandatory.filter(k => !conf[k] || /PASTE_|REPLACE_|YOUR_|EXAMPLE/i.test(conf[k]));
if (missing.length || !Array.isArray(conf.allowedTestRecipients) || !conf.allowedTestRecipients.length || !conf.tokenSecret || conf.tokenSecret.length < 32) {
  console.error('Incomplete local-settings.json. Missing/invalid: ' + missing.join(', ') + '. Set 32+ char tokenSecret and allowedTestRecipients.');
  process.exit(1);
}
for (const key of ['signupScriptUrl','welcomeKitScriptUrl','chandanEmailScriptUrl']) {
  const u = new URL(conf[key]);
  if (u.protocol !== 'https:' || u.hostname !== 'script.google.com' || !u.pathname.endsWith('/exec')) {
    console.error('Use a Google Apps Script /exec URL for ' + key);
    process.exit(1);
  }
}
const allowlist = new Set(conf.allowedTestRecipients.map(x => String(x).trim().toLowerCase()));
process.env.GLF_TOKEN_SECRET = conf.tokenSecret;
process.env.GLF_SHEET_WEBAPP_URL = conf.welcomeKitScriptUrl;
process.env.GLF_API_SECRET = conf.welcomeKitSecret;
const { createWelcomeToken } = require('./api/welcome-kit/_email');
const verifyHandler = require('./api/welcome-kit/verify');
const submitHandler = require('./api/welcome-kit/submit');
const json = (res, status, data) => { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' }); res.end(JSON.stringify(data)); };
const validEmail = x => typeof x === 'string' && x.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);

async function postScript(url, payload) {
  const response = await fetch(url, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(payload), redirect:'follow', signal:AbortSignal.timeout(20000) });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch (_) { throw new Error('Apps Script returned non-JSON; check deployment / access.'); }
  if (!response.ok) throw new Error('Apps Script HTTP ' + response.status);
  return data;
}
function wrapVercel(res) {
  return { setHeader: (k,v) => res.setHeader(k,v), status(status) { this._status=status; return this; }, json(data) { json(res,this._status||200,data); } };
}
async function collect(req) {
  let raw='';
  for await (const chunk of req) {raw += chunk; if (raw.length > 30000) throw new Error('Request too large');}
  return JSON.parse(raw || '{}');
}
async function route(req,res) {
  const u = new URL(req.url, `http://${HOST}:${PORT}`);
  if (u.pathname === '/api/join' && req.method === 'POST') {
    const body = await collect(req);
    if (body.company) return json(res,200,{ok:true,alreadyJoined:false});
    const email = String(body.email||'').trim().toLowerCase();
    if (!validEmail(email)) return json(res,400,{error:'Enter a valid email.'});
    if (!allowlist.has(email)) return json(res,403,{error:'LOCAL TEST ONLY: add your own test address to allowedTestRecipients in local-settings.json.'});
    const countryCode = /^[A-Z]{2}$/.test(body.countryCode||'') ? body.countryCode : '';
    let country = 'Unknown';
    try { if(countryCode) country = new Intl.DisplayNames(['en'], {type:'region'}).of(countryCode) || countryCode; } catch(_) {}
    const saved = await postScript(conf.signupScriptUrl, {secret:conf.signupSecret,email,country,submittedAt:new Date().toISOString()});
    if (!(saved.success === true || saved.ok === true)) throw new Error('TEST signup Sheet failed to save: ' + String(saved.error||'unknown'));
    if (saved.alreadyJoined) return json(res,200,{ok:true,alreadyJoined:true});
    const token = createWelcomeToken(email);
    const link = `http://${HOST}:${PORT}/welcome-kit/?token=${encodeURIComponent(token)}`;
    try {
      const mail = await postScript(conf.chandanEmailScriptUrl, { secret:conf.chandanEmailSecret, to:email, link });
      if (mail.success !== true) throw new Error(mail.error || 'Email script returned failure');
    } catch (e) {
      console.error('[LOCAL] Signup saved but test welcome email FAILED:', e.message);
      return json(res,502,{error:'Signup saved in TEST Sheet, but welcome email failed. Check terminal and Chandan script.'});
    }
    console.log('[LOCAL] Test signup & welcome email:',email);
    return json(res,200,{ok:true,alreadyJoined:false});
  }
  if (u.pathname === '/api/welcome-kit/verify') {
    const token = u.searchParams.get('token') || '';
    const response = wrapVercel(res);
    return verifyHandler({method:req.method,query:{token}},response);
  }
  if (u.pathname === '/api/welcome-kit/submit') {
    const body = await collect(req);
    const {validateToken} = require('./api/welcome-kit/_token');
    const member = validateToken(body.token);
    if (!member || !allowlist.has(member.email)) return json(res,403,{success:false,error:'Not an authorized local test invitation.'});
    return submitHandler({method:req.method,body},wrapVercel(res));
  }
  if (u.pathname.startsWith('/api/')) return json(res,404,{error:'Unknown local API'});
  let relative = decodeURIComponent(u.pathname);
  if (relative.endsWith('/')) relative += 'index.html';
  const filepath = path.resolve(ROOT, '.'+relative);
  if ((!filepath.startsWith(ROOT+path.sep) && filepath !== ROOT) || /(^|[\\/])(?:\.|local-settings|google-apps-script|CHANDAN|TEST-|README|SETUP)/i.test(relative.slice(1)) || !/\.(html|jpg|jpeg|webp|png|css|js|svg|ico)$/i.test(filepath)) return json(res,404,{error:'Not found'});
  try {
    const bytes=fs.readFileSync(filepath);
    const ext=path.extname(filepath).toLowerCase();
    res.writeHead(200, {'Content-Type':({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'})[ext]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(bytes);
  } catch (_) { json(res,404,{error:'Not found'}); }
}
http.createServer((req,res)=>Promise.resolve(route(req,res)).catch(e=>{ console.error('[LOCAL] Error:',e.message); if(!res.headersSent) json(res,500,{error:'Local test request failed. Check terminal.'}); else res.end(); })).listen(PORT,HOST,()=>console.log(`LOCAL TEST ONLY: http://${HOST}:${PORT}/ (never publish local-settings.json)`));
