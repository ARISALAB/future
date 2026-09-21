const { parseHTML } = require('linkedom');
const C = require('../analyzer.js'); const B = require('../benchmarks.js');
const { weak, good } = require('./fixtures.js'); const assert = require('assert');
const mk = (html, url) => ({ doc: parseHTML(html).document, url, html, size: html.length, status: 200, ms: 300, headers: {} });
const me = C.analyzeSite([mk(weak, 'https://acme.gr/')], { now: Date.parse('2026-09-20') });
const c1 = C.analyzeSite([mk(good, 'https://beta.gr/')], { now: Date.parse('2026-09-20') });
const c2 = C.analyzeSite([mk(good.replace(/<meta name="description"[^>]*>/, ''), 'https://gamma.gr/')], { now: Date.parse('2026-09-20') });
const cmp = C.compareMany(me, [c1, c2]);
console.log('gaps', cmp.gaps.length, 'wins', cmp.wins.length, '| top gap:', cmp.gaps[0].row.name, '| rival', cmp.gaps[0].rival);
assert(cmp.gaps.length > 5 && cmp.wins.length === 0, 'weak site trails the good ones');
const d = cmp.rows.find(r => r.id === 'desc'); assert(d.cells[0].status === 'fail' && d.cells[1].status === 'pass' && d.cells[2].status === 'fail', 'per-competitor cells');
// κατηγορία / πόλη
assert.strictEqual(C.guessCategory(B, { text: 'Πιστοποίηση αγγλικών για ΑΣΕΠ NYLC εξετάσεις B2 C1 πιστοποιητικό γλωσσομάθειας' }), 'education');
assert.strictEqual(C.guessCategory(B, { text: 'Συμβουλευτική για εστιατόρια και ξενοδοχεία. Οι σύμβουλοι εστίασης, consulting, συμβουλευτικές υπηρεσίες.' }), 'consulting');
assert.strictEqual(C.guessCategory(B, { text: 'Ταβέρνα με παραδοσιακό μενού και μεζέδες. Κρατήστε τραπέζι στο εστιατόριο μας.' }), 'restaurant');
assert.strictEqual(C.guessCategory(B, { text: 'Γεια σας καλώς ήρθατε' }), null);
assert.strictEqual(C.guessCity({ text: 'Απόλλωνος 5, Αθήνα 105 57' }), 'Αθήνα');
// επιλογή
const p = C.pickCompetitors(B, 'education', 'Αθήνα', 'www.edustandards.eu', 2, 0);
assert.strictEqual(p.length, 2); assert(p.every(x => !/edustandards/.test(x.url)), 'excludes self'); assert(p[0].city === 'Αθήνα', 'prefers same city');
const p2 = C.pickCompetitors(B, 'education', 'Αθήνα', 'x.gr', 2, 2); assert(p2[0].url !== C.pickCompetitors(B, 'education', 'Αθήνα', 'x.gr', 2, 0)[0].url, 'offset rotates');
assert.strictEqual(C.pickCompetitors(B, 'restaurant', '', 'x.gr', 2, 0).length, 1, 'only 1 restaurant in seed list');
assert(B.sites.every(s => B.categories.some(c => c.id === s.cat) && /^https:\/\//.test(s.url)), 'seed data valid');
console.log('BENCH OK');
