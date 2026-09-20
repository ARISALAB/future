process.env.CHECKUP_ALLOW_PRIVATE = '1';
const http = require('http');
const assert = require('assert');
const { weak, page, good } = require('./fixtures.js');
const fn = require('../netlify/functions/analyze.js');

const routes = {
  '/': weak,
  '/services': page('Υπηρεσίες', '', '<h2>x</h2><p>λίγο</p>'),
  '/contact': page('Επικοινωνία', '', '<h1>Επικοινωνία</h1>'),
  '/about': page('Σχετικά', 'Σχετικά με εμάς', '<h1>Σχετικά</h1><p>Κείμενο</p>'),
  '/robots.txt': 'User-agent: *\nDisallow:\nSitemap: http://127.0.0.1:PORT/sitemap.xml',
  '/sitemap.xml': '<?xml version="1.0"?><urlset></urlset>',
  '/good': good,
  '/redir': null
};
const srv = http.createServer((req, res) => {
  if (req.url === '/redir') { res.writeHead(302, { location: '/good' }); return res.end(); }
  const b = routes[req.url];
  if (b == null) { res.writeHead(404); return res.end('nf'); }
  const type = req.url.endsWith('.xml') ? 'application/xml' : req.url.endsWith('.txt') ? 'text/plain' : 'text/html; charset=utf-8';
  res.writeHead(200, { 'content-type': type }); res.end(b.replace('PORT', srv.address().port));
});
srv.listen(0, '127.0.0.1', async () => {
  const port = srv.address().port, base = 'http://127.0.0.1:' + port;
  try {
    // 1. πλήρης ανάλυση
    const out = await fn.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ url: base + '/' }) });
    const j = JSON.parse(out.body);
    assert(j.ok, 'ok: ' + j.error);
    console.log('live weak: score', j.report.score, '| pages', j.report.meta.pages, '| skipped', j.report.skipped.map(s => s.id).join(','));
    assert(j.report.meta.pages >= 3, 'multi-page fetched');
    const sm = j.report.positives.concat(j.report.negatives).find(i => i.id === 'sitemap');
    assert(sm && sm.status === 'pass', 'sitemap found via robots');
    // 2. ανακατεύθυνση
    const out2 = await fn.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ url: base + '/redir' }) });
    const j2 = JSON.parse(out2.body); assert(j2.ok && j2.report.score > 80, 'redirect followed: ' + JSON.stringify(j2.error));
    console.log('live good via redirect: score', j2.report.score);
    // 3. 404
    const out3 = await fn.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ url: base + '/nope' }) });
    console.log('404 ->', JSON.parse(out3.body).ok, JSON.parse(out3.body).error || '(report με status 404)');
    // 4. ping
    const p = await fn.handler({ httpMethod: 'GET', queryStringParameters: { ping: '1' }, headers: {} });
    assert(JSON.parse(p.body).ok);
    // 5. Places με mock
    process.env.GOOGLE_PLACES_API_KEY = 'x';
    const realFetch = global.fetch;
    global.fetch = async (u, o) => u.includes('places.googleapis.com') ? { ok: true, json: async () => ({ places: [{ id: 'p1', displayName: { text: 'Acme' }, formattedAddress: 'Αθήνα', websiteUri: base + '/', rating: 4.4, userRatingCount: 9, photos: [{}, {}], regularOpeningHours: {}, nationalPhoneNumber: '210 1', primaryTypeDisplayName: { text: 'Σύμβουλος' } }] }) } : realFetch(u, o);
    const s = await fn.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ name: 'Acme' }) });
    const sj = JSON.parse(s.body); assert(sj.ok && sj.candidates.length === 1, 'places');
    global.fetch = realFetch;
    const withG = await fn.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ url: base + '/', gbp: sj.candidates[0].gbp }) });
    const wj = JSON.parse(withG.body); assert(wj.report.gbp && wj.report.gbp.score > 0, 'gbp attached');
    console.log('gbp score', wj.report.gbp.score, 'neg:', wj.report.gbp.negatives.map(i => i.id).join(','));
    console.log('SERVER OK');
  } catch (e) { console.error('FAIL', e); process.exitCode = 1; }
  srv.close();
  // SSRF χωρίς παράκαμψη
  const { _internals } = fn;
  ['10.0.0.5', '127.0.0.1', '169.254.169.254', '192.168.1.1', '172.20.0.1', '::1', 'fd00::1', '::ffff:127.0.0.1'].forEach(ip => assert(_internals.isPrivateIp(ip), 'private ' + ip));
  ['8.8.8.8', '93.184.216.34', '2606:4700::1111'].forEach(ip => assert(!_internals.isPrivateIp(ip), 'public ' + ip));
  console.log('SSRF helper OK');
});
