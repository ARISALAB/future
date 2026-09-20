process.env.CHECKUP_ALLOW_PRIVATE = '1';
process.env.GOOGLE_PLACES_API_KEY = 'test';
process.env.PAGESPEED_API_KEY = 'TESTKEY';
const http = require('http'), fs = require('fs');
const { weak, page, good } = require('./fixtures.js');
const fn = require('../netlify/functions/analyze.js');
const routes = { '/': weak, '/services': page('Υπηρεσίες', '', '<h2>x</h2>'), '/contact': page('Επικοινωνία', '', '<h1>Επικοινωνία</h1>'), '/good': good, '/robots.txt': 'User-agent: *\nDisallow:' };
const site = http.createServer((req, res) => { const b = routes[req.url]; if (b == null) { res.writeHead(404); return res.end('nf'); } res.writeHead(200, { 'content-type': req.url.endsWith('.txt') ? 'text/plain' : 'text/html; charset=utf-8' }); res.end(b); });
const realFetch = global.fetch;
site.listen(0, '127.0.0.1', () => {
  const sp = site.address().port;
  global.fetch = async (u, o) => String(u).includes('places.googleapis.com') ? { ok: true, json: async () => ({ places: [
    { id: '1', displayName: { text: 'Acme Δοκιμή' }, formattedAddress: 'Αθήνα 105 57', websiteUri: 'http://127.0.0.1:' + sp + '/', rating: 4.2, userRatingCount: 7, photos: [{}, {}], nationalPhoneNumber: '210 111 1111', primaryTypeDisplayName: { text: 'Σύμβουλος επιχειρήσεων' } },
    { id: '2', displayName: { text: 'Acme χωρίς site' }, formattedAddress: 'Πειραιάς', rating: 5, userRatingCount: 2 }] }) } : realFetch(u, o);
  const app = http.createServer(async (req, res) => {
    if (req.url.startsWith('/.netlify/functions/analyze')) {
      let body = ''; req.on('data', c => body += c); req.on('end', async () => {
        const out = await fn.handler({ httpMethod: req.method, headers: {}, queryStringParameters: req.url.includes('ping') ? { ping: '1' } : {}, body });
        res.writeHead(out.statusCode, out.headers); res.end(out.body);
      }); return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(fs.readFileSync(__dirname + '/../dist/checkup.html'));
  });
  app.listen(0, '127.0.0.1', () => console.log('READY ' + app.address().port + ' ' + sp));
});
