/*
 * Netlify Function: /.netlify/functions/analyze
 *   GET  ?ping=1                      -> { ok, places }
 *   POST { url }                      -> { ok, report }          (ανάλυση site)
 *   POST { name }                     -> { ok, candidates: [...] } (αναζήτηση επιχείρησης, θέλει GOOGLE_PLACES_API_KEY)
 *   POST { url, gbp }                 -> report + ανάλυση Google Business
 */
const { parseHTML } = require('linkedom');
const dns = require('dns').promises;
const net = require('net');
const Checkup = require('../analyzer.js');

const UA = 'Mozilla/5.0 (compatible; CheckupBot/1.0; +https://example.com/bot)';
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 12000;
const ALLOW_PRIVATE = process.env.CHECKUP_ALLOW_PRIVATE === '1'; // μόνο για τοπικά τεστ

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe8') || x.startsWith('fe9') || x.startsWith('fea') || x.startsWith('feb') || /^::ffff:(127|10|0|169\.254|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(x);
  }
  return true;
}

async function assertPublic(hostname) {
  if (ALLOW_PRIVATE) return;
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) throw new Error('Μη επιτρεπτή διεύθυνση.');
  if (net.isIP(hostname)) { if (isPrivateIp(hostname)) throw new Error('Μη επιτρεπτή διεύθυνση.'); return; }
  const res = await dns.lookup(hostname, { all: true });
  if (!res.length || res.some((r) => isPrivateIp(r.address))) throw new Error('Μη επιτρεπτή διεύθυνση.');
}

function normalizeUrl(input) {
  let s = String(input || '').trim();
  if (!s) throw new Error('Γράψε τη διεύθυνση του site.');
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  const u = new URL(s);
  if (!/^https?:$/.test(u.protocol)) throw new Error('Μόνο διευθύνσεις http/https.');
  if (u.username || u.password) throw new Error('Μη επιτρεπτή διεύθυνση.');
  return u;
}

async function readLimited(res) {
  const reader = res.body.getReader();
  const chunks = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) { try { await reader.cancel(); } catch (e) { /* noop */ } break; }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function fetchText(startUrl, opts) {
  opts = opts || {};
  let url = new URL(startUrl), hops = 0;
  const t0 = Date.now();
  for (;;) {
    await assertPublic(url.hostname);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url.href, { redirect: 'manual', signal: ctrl.signal, headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5', 'accept-language': 'el,en;q=0.8' } });
    } finally { clearTimeout(timer); }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      if (++hops > 5) throw new Error('Πάρα πολλές ανακατευθύνσεις.');
      url = new URL(res.headers.get('location'), url);
      if (!/^https?:$/.test(url.protocol)) throw new Error('Μη επιτρεπτή ανακατεύθυνση.');
      continue;
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (opts.html && res.ok && ct && !/html|xml|text/.test(ct)) throw new Error('Η διεύθυνση δεν επιστρέφει σελίδα HTML.');
    const buf = await readLimited(res);
    const headers = {}; res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    return { url: url.href, status: res.status, ms: Date.now() - t0, headers, size: buf.length, text: buf.toString('utf8') };
  }
}

function parseDoc(t) {
  let x = String(t || '');
  if (!/<html[\s>]/i.test(x)) x = '<!doctype html><html><head></head><body>' + x + '</body></html>';
  return parseHTML(x).document;
}

function pickInternalPages(homeDoc, homeUrl, max) {
  const home = new URL(homeUrl); const hostNorm = home.hostname.replace(/^www\./, '');
  const groups = [[/contact|επικοινων/i, 'contact'], [/about|σχετικ|εταιρ|εμάς|about-us/i, 'about'], [/service|υπηρεσ|προϊόν|products|menu|courses|μαθήματα|certif/i, 'services'], [/blog|news|ειδήσ|νέα|articles/i, 'news']];
  const chosen = {}; const out = [];
  Array.from(homeDoc.querySelectorAll('a[href]')).forEach((a) => {
    let u; try { u = new URL(a.getAttribute('href'), home); } catch (e) { return; }
    if (!/^https?:$/.test(u.protocol) || u.hostname.replace(/^www\./, '') !== hostNorm) return;
    if (/\.(pdf|jpe?g|png|gif|webp|zip|docx?|xlsx?|mp4|svg)$/i.test(u.pathname)) return;
    u.hash = ''; if (u.pathname === home.pathname) return;
    const label = (a.textContent || '') + ' ' + u.pathname;
    for (const [re, key] of groups) {
      if (!chosen[key] && re.test(label)) { chosen[key] = true; out.push(u.href); break; }
    }
  });
  return out.slice(0, max);
}

async function checkRobots(origin) {
  const info = { robotsFound: false, sitemapFound: false, blocksAll: false };
  try {
    const r = await fetchText(origin + '/robots.txt');
    if (r.status === 200 && !/<html/i.test(r.text.slice(0, 400))) {
      info.robotsFound = true;
      const lines = r.text.split(/\r?\n/);
      let star = false;
      lines.forEach((l) => {
        const m = l.match(/^\s*user-agent:\s*(.+)$/i); if (m) star = m[1].trim() === '*';
        if (star && /^\s*disallow:\s*\/\s*$/i.test(l)) info.blocksAll = true;
        if (/^\s*sitemap:/i.test(l)) info.sitemapFound = true;
      });
    }
  } catch (e) { /* noop */ }
  if (!info.sitemapFound) {
    try { const s = await fetchText(origin + '/sitemap.xml'); if (s.status === 200 && /<(urlset|sitemapindex)/i.test(s.text.slice(0, 2000))) info.sitemapFound = true; } catch (e) { /* noop */ }
  }
  return info;
}

async function analyzeUrl(input, opts) {
  opts = opts || {};
  const u = normalizeUrl(input);
  const home = await fetchText(u.href, { html: true });
  if (home.status === 403 || home.status === 429 || home.status === 503 || /just a moment|cf-chl|attention required/i.test(home.text.slice(0, 3000))) throw new Error('Το site μπλοκάρει τις αυτόματες αναγνώσεις (κωδικός ' + home.status + '). Δοκίμασε την επικόλληση κώδικα από τις προχωρημένες επιλογές.');
  if (home.status >= 400) throw new Error('Το site απάντησε με κωδικό ' + home.status + '. Έλεγξε τη διεύθυνση.');
  const homeDoc = parseDoc(home.text);
  const origin = new URL(home.url).origin;
  const others = pickInternalPages(homeDoc, home.url, 4);
  const [robots, ...pages] = await Promise.all([
    checkRobots(origin),
    ...others.map((p) => fetchText(p, { html: true }).catch(() => null))
  ]);
  const docs = [{ doc: homeDoc, url: home.url, status: home.status, ms: home.ms, size: home.size, headers: home.headers, html: home.text }];
  pages.forEach((p) => { if (p && p.status < 400) docs.push({ doc: parseDoc(p.text), url: p.url, status: p.status, ms: p.ms, size: p.size, headers: p.headers, html: p.text }); });
  const report = Checkup.analyzeSite(docs, { mode: 'live', robots, now: Date.now() });
  if (opts.gbp) report.gbp = Checkup.analyzeGbp(opts.gbp);
  return report;
}

async function searchPlaces(name) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error('Η αναζήτηση με όνομα χρειάζεται GOOGLE_PLACES_API_KEY στο Netlify.');
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.regularOpeningHours,places.photos,places.googleMapsUri,places.businessStatus'
    },
    body: JSON.stringify({ textQuery: String(name).slice(0, 200), languageCode: 'el', regionCode: 'GR', maxResultCount: 4 })
  });
  if (!res.ok) throw new Error('Η αναζήτηση στη Google απέτυχε (' + res.status + ').');
  const j = await res.json();
  return (j.places || []).map((p) => ({
    id: p.id, name: p.displayName && p.displayName.text, address: p.formattedAddress, website: p.websiteUri || '', rating: p.rating, count: p.userRatingCount,
    gbp: { displayName: p.displayName, formattedAddress: p.formattedAddress, websiteUri: p.websiteUri, nationalPhoneNumber: p.nationalPhoneNumber, rating: p.rating, userRatingCount: p.userRatingCount, primaryTypeDisplayName: p.primaryTypeDisplayName, regularOpeningHours: p.regularOpeningHours ? true : false, photos: (p.photos || []).map(() => 1), googleMapsUri: p.googleMapsUri, businessStatus: p.businessStatus }
  }));
}

// απλό όριο ρυθμού ανά IP (σε μνήμη· επαρκεί ως πρώτη άμυνα)
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), win = 60 * 1000, max = 12;
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now); hits.set(ip, arr);
  return arr.length > max;
}

const H = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'cache-control': 'no-store' };
const reply = (code, obj) => ({ statusCode: code, headers: H, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };
  const qs = event.queryStringParameters || {};
  if (event.httpMethod === 'GET' && qs.ping) return reply(200, { ok: true, places: !!process.env.GOOGLE_PLACES_API_KEY });
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'Μέθοδος μη επιτρεπτή.' });
  const ip = (event.headers && (event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'])) || 'unknown';
  if (rateLimited(ip)) return reply(429, { ok: false, error: 'Πολλά αιτήματα. Δοκίμασε ξανά σε ένα λεπτό.' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch (e) { return reply(400, { ok: false, error: 'Μη έγκυρο αίτημα.' }); }
  try {
    if (body.name && !body.url) return reply(200, { ok: true, candidates: await searchPlaces(body.name) });
    const report = await analyzeUrl(body.url, { gbp: body.gbp });
    return reply(200, { ok: true, report });
  } catch (e) {
    const msg = e && e.name === 'AbortError' ? 'Το site άργησε πολύ να απαντήσει.' : (e && e.message) || 'Άγνωστο σφάλμα.';
    return reply(200, { ok: false, error: msg });
  }
};

exports._internals = { analyzeUrl, isPrivateIp, normalizeUrl, pickInternalPages, searchPlaces };
