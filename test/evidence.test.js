const { parseHTML } = require('linkedom'); const C = require('../analyzer.js'); const assert = require('assert');
const NOW = Date.parse('2026-09-21T10:00:00Z');
const mk = (html, url) => ({ doc: parseHTML(html).document, url, html, size: html.length, status: 200, ms: 200, headers: {} });
const home = `<html lang="en"><head><title>EDUstandards – EDUstandards</title><meta name="viewport" content="width=device-width"></head><body><h1>EDU STANDARDS</h1><p>Exclusive representative of NYLC in Greece. Certified exams for the public sector recognised by the authorities and used by thousands of candidates every year across the country.</p><a class="btn" href="/nylc">More</a><footer>© Copyright 2020</footer></body></html>`;
const news = `<html lang="en"><head><title>NEWS – EDUstandards</title></head><body><h1>News</h1><article><h2>UPDATE</h2><p>March 15, 2021. Our center has stopped lifelong teaching according to the instructions of the Ministry. We continue online until further notice.</p></article><article><h2>TOLES LEGAL</h2><p>Published on 3 Μαΐου 2021.</p></article></body></html>`;
const nylc = `<html lang="en"><head><title>NYLC – EDUstandards</title></head><body><h1>NYLC</h1><p>NYLC exams cover listening, writing and speaking.</p><a href="https://nylc.gr">MORE</a></body></html>`;
const r = C.analyzeSite([mk(home, 'https://www.edustandards.eu/en/home-english/'), mk(news, 'https://www.edustandards.eu/en/news/'), mk(nylc, 'https://www.edustandards.eu/en/nylc-2/')], { now: NOW });
const all = {}; r.positives.concat(r.negatives).forEach(i => all[i.id] = i);

// νέα: ημερομηνία και ηλικία
assert(all.news && all.news.status === 'fail', 'news flagged');
assert(/\/en\/news/.test(all.news.evidence[0]) && /Μάιος 2021/.test(all.news.evidence[0]) && /πριν 5 χρόνια/.test(all.news.evidence[0]), all.news.evidence[0]);
// παλιά ειδοποίηση με παράθεμα και σελίδα
const fr = all.fresh.evidence.join(' | ');
assert(/\/en\/news/.test(fr) && /until further notice/i.test(fr), 'stale notice with quote: ' + fr);
assert(/© 2020/.test(fr), 'old copyright');
// συνέπειες
assert(all.fresh.conseq && /δεν λειτουργεί/.test(all.fresh.conseq), 'consequence text');
assert(all.desc.conseq && all.pass === undefined, 'consequence on negatives');
// σχόλια ανά σελίδα
const pn = r.pages[2].notes.join(' ');
assert(/Μόνο \d+ λέξεις/.test(pn) && /Δεν φαίνονται: τιμές/.test(pn) && /κουμπί ή φόρμα/.test(pn), 'nylc page review: ' + pn);
assert(r.pages[1].notes.some(n => /τελευταία ανάρτηση είναι του Μάιος 2021/.test(n)), 'news page latest date note');
assert(r.pages[1].notes.some(n => /χωρίς ημερομηνία λήξης/.test(n)), 'stale note on page');
// πρόζα
assert(Array.isArray(r.story) && r.story.length >= 3, 'story paragraphs');
const st = r.story.join('\n');
assert(/βαθμολογείται με \d+\/100/.test(st) && /Το μεγαλύτερο κενό/.test(st) && /Οι πιο γρήγορες κινήσεις/.test(st), st);
console.log(st);
// ημερομηνίες: μορφές
const ds = (t) => C.__test.datesIn(t, NOW).map(x => new Date(x).toISOString().slice(0, 10)).join(',');
assert.strictEqual(ds('Δημοσιεύθηκε 25 Ιουνίου 2023'), '2023-06-25');
assert.strictEqual(ds('Posted on July 4, 2022'), '2022-07-04');
assert.strictEqual(ds('12/03/2024'), '2024-03-12');
assert.strictEqual(ds('2019-11-02'), '2019-11-02');
assert.strictEqual(ds('Μάρτιος 2021'), '2021-03-01');
assert.strictEqual(ds('Digital market 2021 trends'), '', 'no false positive for "market 2021"');
assert.strictEqual(ds('την 5 Ιανουαρίου 2031'), '', 'future dates ignored');
console.log('EVIDENCE OK');
