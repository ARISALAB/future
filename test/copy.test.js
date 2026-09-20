const { parseHTML } = require('linkedom');
const C = require('../analyzer.js');
const assert = require('assert');
const mk = (html, url) => ({ doc: parseHTML(html).document, url: url || 'https://x.gr/', html, size: html.length, status: 200, ms: 300, headers: {} });
const run = (html) => { const r = C.analyzeSite([mk(html)], { now: Date.parse('2026-09-20') }); const m = {}; r.positives.concat(r.negatives).forEach(i => m[i.id] = i); return m; };

const bad = `<html lang="el"><head><title>Α</title></head><body>
<p>Στην AR Akron πιστεύουμε στην παροχή απαράμιλλης εξειδίκευσης και καινοτόμων λύσεων στους πελάτες μας. Προσφέρουμε εξατομικευμένες στρατηγικές και υψηλής ποιότητας υπηρεσίες με ολιστική προσέγγιση για βιώσιμη ανάπτυξη και αριστεία σε κάθε επιχείρηση που μας εμπιστεύεται και θέλει να προχωρήσει μπροστά με σιγουριά και με συνέπεια στον χρόνο και στις υποχρεώσεις της απέναντι στους πελάτες της και στους συνεργάτες της.</p>
<p>Βοηθάμε τις επιχειρήσεις να ξεπεράσουν εμπόδια και εμπόδια που δεν τους επέτρεψαν να αναπτύξουν πλήρως τις δυνατότητές τους. Δημιουργούμε λύσεις και προσφέρουμε υπηρεσίες και εκπαιδεύουμε ομάδες και συνεργαζόμαστε με φορείς και οργανώνουμε εκδηλώσεις και παρέχουμε συμβουλές και καθοδηγούμε επιχειρηματίες προς τον σωστό δρόμο ώστε να πετύχουν τους στόχους τους μακροπρόθεσμα.</p>
<p>LRN, TOEIC, OCN ισχύει. LRN, TOEIC, OCN ισχύει. LRN, TOEIC, OCN ισχύει. LRN, TOEIC, OCN ισχύει. LRN, TOEIC, OCN ισχύει.</p></body></html>`;
const good = `<html lang="el"><head><title>Β</title></head><body>
<p>Θα μειώσεις το κόστος του μενού σου κατά 12% μέσα σε τρεις μήνες. Ξεκινάμε με μια ανάλυση των πωλήσεών σου. Μετά βρίσκουμε τα πιάτα που σου κοστίζουν περισσότερο από όσο βγάζουν.</p>
<p>Έχουμε δουλέψει με 45 εστιατόρια στην Αττική από το 2014. Εσύ αποφασίζεις τι θα αλλάξει, και εμείς σου δείχνουμε τα νούμερα. Το πρώτο ραντεβού διαρκεί 30 λεπτά και είναι δωρεάν για σένα.</p>
<p>Σου δίνουμε γραπτό πλάνο με συγκεκριμένα βήματα. Μπορείς να το εφαρμόσεις μόνος σου ή με τη βοήθεια της ομάδας σου. Ζητάς αλλαγές όποτε θέλεις.</p></body></html>`;
const B = run(bad), G = run(good);
console.log('BAD ', ['cliches','voice','sentences','specifics','repeat'].map(k => k + ':' + (B[k] ? B[k].status : 'skip')).join(' '));
B.cliches && console.log('   cliches:', B.cliches.evidence[0]);
B.repeat && console.log('   repeat:', B.repeat.evidence.join(' | '));
B.voice && console.log('   voice:', B.voice.evidence[0]);
B.sentences && console.log('   sentences:', B.sentences.evidence[0]);
console.log('GOOD', ['cliches','voice','sentences','specifics','repeat'].map(k => k + ':' + (G[k] ? G[k].status : 'skip')).join(' '));
assert(B.cliches.status === 'fail' && /απαράμιλλος/.test(B.cliches.evidence[0]), 'cliches flagged');
assert(B.voice.status !== 'pass', 'we-heavy flagged');
const longT = run('<html lang="el"><body><p>'+('Η εταιρεία μας παρέχει ένα ευρύ φάσμα υπηρεσιών προς όλους τους πελάτες της ώστε να μπορούν να ανταποκρίνονται στις μεταβαλλόμενες ανάγκες της αγοράς και να επιτυγχάνουν συνεχώς τους στόχους που έχουν θέσει για την επιχείρησή τους σε κάθε περίοδο του έτους και σε κάθε συνθήκη. ').repeat(3)+'</p></body></html>');
assert(longT.sentences && longT.sentences.status !== 'pass', 'long sentences flagged');
assert(B.repeat.status !== 'pass' && /εμποδια/.test(B.repeat.evidence.join(' ')), 'doubled word flagged');
assert(G.cliches.status === 'pass' && G.specifics.status === 'pass' && G.voice.status === 'pass', 'good text passes');
assert(!G.repeat || G.repeat.status === 'pass', 'good repeat passes');

// PageSpeed parsing
const psi = { lighthouseResult: { requestedUrl: 'https://x.gr/', finalUrl: 'https://x.gr/', categories: { performance: { score: 0.42 }, accessibility: { score: 0.91 }, seo: { score: 1 }, 'best-practices': { score: 0.8 } },
  audits: { 'first-contentful-paint': { displayValue: '2,1 s', score: 0.6 }, 'largest-contentful-paint': { displayValue: '5,3 s', score: 0.1 }, 'total-blocking-time': { displayValue: '120 ms', score: 0.95 }, 'cumulative-layout-shift': { displayValue: '0,02', score: 1 }, 'speed-index': { displayValue: '3,8 s', score: 0.4 },
    'uses-optimized-images': { title: 'Κωδικοποίηση εικόνων', displayValue: 'Εξοικονόμηση 1,2 s', details: { type: 'opportunity', overallSavingsMs: 1200 } }, 'unused-css-rules': { title: 'CSS που δεν χρησιμοποιείται', details: { type: 'opportunity', overallSavingsMs: 80 } }, 'render-blocking-resources': { title: 'Αφαίρεση scripts που μπλοκάρουν', displayValue: '0,5 s', details: { type: 'opportunity', overallSavingsMs: 500 } } } },
  loadingExperience: { metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 3900, category: 'AVERAGE' }, CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 12, category: 'GOOD' } } } };
const r = C.parsePagespeed(psi);
assert.strictEqual(r.performance, 42); assert.strictEqual(r.band.id, 'low');
assert.strictEqual(r.metrics.length, 5); assert.strictEqual(r.metrics[1].status, 'fail'); assert.strictEqual(r.metrics[2].status, 'pass');
assert.deepStrictEqual(r.opportunities.map(o => o.title), ['Κωδικοποίηση εικόνων', 'Αφαίρεση scripts που μπλοκάρουν']);
assert.strictEqual(r.field[1].value, '0.12'); assert.strictEqual(C.parsePagespeed({}), null);
const u = C.psiUrl('https://x.gr/a?b=1', { key: 'K' }); assert(u.includes('url=https%3A%2F%2Fx.gr%2Fa%3Fb%3D1') && u.includes('category=seo') && u.includes('key=K') && u.includes('strategy=mobile'));
console.log('COPY + PSI OK');
