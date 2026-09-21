process.env.CHECKUP_ALLOW_PRIVATE = '1';
const assert = require('assert');
const C = require('../analyzer.js');
const fn = require('../netlify/functions/analyze.js');

// buildQuery / osmFilters / filterCandidates
const hints = { title: 'AR Akron Services | Σύμβουλοι Εστίασης, Τουρισμού & Φιλοξενίας', h1: '', desc: '' };
assert.strictEqual(C.buildQuery(hints, 'AR Akron Services', 'Αθήνα'), 'Σύμβουλοι Εστίασης, Τουρισμού & Φιλοξενίας Αθήνα');
assert.strictEqual(C.buildQuery({ h1: 'Οδοντιατρείο στο Μαρούσι για όλη την οικογένεια', title: 'Smile | Home' }, 'Smile', ''), 'Οδοντιατρείο στο Μαρούσι για όλη την οικογένεια');
const kq = C.buildQuery({ title: 'Acme Services', h1: '', desc: '', text: 'Acme Services Στην Acme πιστεύουμε στη συμβουλευτική εστίασης. Συμβουλευτική για εστίαση και τουρισμό. Εστίαση τουρισμός συμβουλευτική.' }, 'Acme Services', 'Αθήνα');
assert(/συμβουλευτική/i.test(kq) && /Αθήνα$/.test(kq) && !/acme/i.test(kq), 'keyword fallback: ' + kq);
assert.deepStrictEqual(C.osmFilters({ title: 'Οδοντιατρείο Κηφισιά', h1: '', desc: '' }), ['amenity=dentist']);
assert.deepStrictEqual(C.osmFilters({ title: 'Ταβέρνα Ο Θόδωρος', h1: '', desc: '' }), ['amenity=restaurant']);
assert.deepStrictEqual(C.osmFilters({ title: 'Σύμβουλοι Εστίασης', h1: '', desc: '' }), ['office=consulting']);
assert.deepStrictEqual(C.osmFilters({ title: 'Συμβουλευτική για εστιατόρια', h1: '', desc: '' }), ['office=consulting']);
const f = C.filterCandidates([
  { url: 'https://www.facebook.com/x', name: 'FB' }, { url: 'https://www.tripadvisor.com/r', name: 'TA' }, { url: 'https://mysite.gr/', name: 'self' },
  { url: 'https://blog.example.gr/blog/top-10', name: 'Τα 10 καλύτερα' }, { url: 'https://rival1.gr/about/team', name: 'Rival One' }, { url: 'https://www.rival1.gr/', name: 'dup' },
  { url: 'https://rival2.com/el/', name: 'Rival Two - Home' }, { url: 'https://xo.gr/foo', name: 'XO' }, { url: 'ftp://bad', name: 'x' }], 'www.mysite.gr');
assert.deepStrictEqual(f.map(x => x.url), ['https://rival1.gr/', 'https://rival2.com/'], JSON.stringify(f));

(async () => {
  const realFetch = global.fetch; const calls = [];
  const mock = (map) => { global.fetch = async (u, o) => { calls.push(String(u)); for (const k of Object.keys(map)) if (String(u).includes(k)) return map[k](u, o); throw new Error('unexpected ' + u); }; };
  const ok = (j) => ({ ok: true, status: 200, json: async () => j });
  // 1. Tavily
  process.env.TAVILY_API_KEY = 'tv'; delete process.env.GOOGLE_PLACES_API_KEY;
  mock({ 'api.tavily.com': (u, o) => { const b = JSON.parse(o.body); assert(/Σύμβουλοι/.test(b.query)); assert(/Bearer tv/.test(o.headers.authorization)); return ok({ results: [{ url: 'https://facebook.com/a', title: 'FB' }, { url: 'https://culinaryconsulting.gr/', title: 'Culinary' }, { url: 'https://harcos.gr/x/y', title: 'Harcos' }] }); } });
  let r = await fn._internals.discover({ query: 'Σύμβουλοι Εστίασης Αθήνα', city: 'Αθήνα', host: 'arakronservices.gr', title: 'Σύμβουλοι Εστίασης' });
  assert.strictEqual(r.provider, 'tavily'); assert.deepStrictEqual(r.candidates.map(c => c.url), ['https://culinaryconsulting.gr/', 'https://harcos.gr/']);
  // 2. Tavily αποτυγχάνει -> OSM
  mock({ 'api.tavily.com': () => ({ ok: false, status: 401 }),
    'nominatim': () => ok([{ lat: '37.98', lon: '23.72' }]),
    'overpass': (u, o) => { assert(/amenity"="dentist"/.test(decodeURIComponent(o.body)) && /around:6000,37.98,23.72/.test(decodeURIComponent(o.body))); return ok({ elements: [ { tags: { name: 'Α', website: 'https://a-dental.gr' } }, { tags: { name: 'Β', website: 'b-dental.gr', phone: '1', opening_hours: 'x', 'addr:street': 's' } }, { tags: { name: 'Χωρίς site' } } ] }); } });
  r = await fn._internals.discover({ query: 'Οδοντιατρείο Αθήνα', city: 'Αθήνα', host: 'x.gr', title: 'Οδοντιατρείο Κηφισιά' });
  assert.strictEqual(r.provider, 'osm'); assert.deepStrictEqual(r.candidates.map(c => c.url), ['https://b-dental.gr/', 'https://a-dental.gr/'], 'sorted by completeness'); assert(/tavily: Tavily HTTP 401/.test(r.tried.join('|')));
  assert(calls.some(c => c.includes('overpass')));
  // 3. Places
  delete process.env.TAVILY_API_KEY; process.env.GOOGLE_PLACES_API_KEY = 'gp';
  mock({ 'places.googleapis.com': (u, o) => { assert(/websiteUri/.test(o.headers['X-Goog-FieldMask'])); return ok({ places: [{ displayName: { text: 'P1' }, websiteUri: 'https://p1.gr/' }, { displayName: { text: 'P2' }, websiteUri: 'https://p2.gr/en' }, { displayName: { text: 'P3' } }] }); } });
  r = await fn._internals.discover({ query: 'x', city: '', host: 'z.gr', title: '' });
  assert.strictEqual(r.provider, 'places'); assert.strictEqual(r.candidates.length, 2);
  // 4. τίποτα διαθέσιμο (χωρίς κλειδιά, χωρίς πόλη)
  delete process.env.GOOGLE_PLACES_API_KEY; mock({});
  r = await fn._internals.discover({ query: 'x', city: '', host: 'z.gr', title: '' });
  assert.strictEqual(r.provider, ''); assert.strictEqual(r.candidates.length, 0);
  global.fetch = realFetch;
  console.log('DISCOVER OK');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
