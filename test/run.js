const { parseHTML } = require('linkedom');
const C = require('../analyzer.js');
const { weak, good, page } = require('./fixtures.js');
const assert = require('assert');
const NOW = Date.parse('2026-09-20T10:00:00Z');
const mk = (html, url, extra) => Object.assign({ doc: parseHTML(html).document, url, html, size: html.length, status: 200, ms: 400, headers: {} }, extra || {});

// weak
const rw = C.analyzeSite([mk(weak, 'https://acme.gr/'), mk(page('Υπηρεσίες', '', '<h2>x</h2><p>λίγο</p>'), 'https://acme.gr/services'), mk(page('Επικοινωνία', '', '<h1>Επικοινωνία</h1>'), 'https://acme.gr/contact')], { now: NOW, mode: 'live' });
console.log('WEAK score', rw.score, rw.band.label, '| potential', rw.potential);
console.log(' cats', rw.cats.map(c => c.name + ':' + c.score).join(' | '));
console.log(' NEG', rw.negatives.map(i => `${i.id}(${i.status},${i.gain})`).join(' '));
console.log(' POS', rw.positives.map(i => i.id).join(' '));
console.log(' skipped', rw.skipped.map(s => s.id).join(' '));
rw.negatives.slice(0, 20).forEach(i => console.log('   -', i.id, '=>', i.evidence.join(' / ')));
console.log(' fixes', rw.fixes.map(f => f.id).join(','));

// good
const rg = C.analyzeSite([mk(good, 'https://beta.gr/')], { now: NOW });
console.log('\nGOOD score', rg.score, rg.band.label, '| potential', rg.potential);
console.log(' NEG', rg.negatives.map(i => `${i.id}(${i.status},${i.gain}) ${i.evidence[0]}`).join('\n     '));

// compare
const cmp = C.compareReports(rw, rg);
console.log('\nCOMPARE weak vs good: weakWins', cmp.aWins, 'goodWins', cmp.bWins, 'ties', cmp.ties, 'rows', cmp.rows.length);

// assertions on specific detections
const ids = r => Object.fromEntries(r.negatives.concat(r.positives).map(i => [i.id, i]));
const W = ids(rw), G = ids(rg);
assert(W.title.status !== 'pass', 'brand-only title flagged');
assert(W.desc.status === 'fail', 'missing description flagged');
assert(/ico/i.test(W.og.evidence.join(' ')), 'ico og:image flagged');
assert(W.emaildomain.status === 'warn' || W.emaildomain.status === 'fail', 'free mail flagged');
assert(W.social.status === 'fail', 'root social links flagged');
assert(W.fresh.status !== 'pass' && /Covid|2020/.test(W.fresh.evidence.join(' ')), 'freshness flagged');
assert(W.placeholders.status === 'fail' && /cookie_link/.test(W.placeholders.evidence.join(' ')), 'placeholder flagged');
assert(W.alt.status !== 'pass', 'bad alts flagged');
assert(W.linknames.status !== 'pass', 'empty link flagged');
assert(W.multilang.status !== 'pass', 'multi-lang flagged');
assert(W.perf.evidence.join(' ').includes('autoplay'), 'autoplay flagged');
assert(W.pages && W.pages.status !== 'pass', 'page consistency flagged');
assert(G.title.status === 'pass' && G.desc.status === 'pass' && G.h1.status === 'pass' && G.contact.status === 'pass' && G.privacy.status === 'pass' && G.schema.status === 'pass', 'good site passes basics');
assert(rg.score > rw.score + 25, 'good scores clearly higher');
console.log('\nALL OK');

// gbp
const g = C.analyzeGbp({ displayName: { text: 'Test' }, rating: 4.6, userRatingCount: 12, websiteUri: 'https://x.gr', photos: [1, 2, 3], primaryTypeDisplayName: { text: 'Σύμβουλος' } });
console.log('GBP score', g.score, 'neg', g.negatives.map(i => i.id).join(','));
