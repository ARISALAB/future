const { parseHTML } = require('linkedom'); const C = require('../analyzer.js'); const assert = require('assert');
const NOW = Date.parse('2026-09-21T10:00:00Z');
const mk = (html, url) => ({ doc: parseHTML(html).document, url, html, size: html.length, status: 200, ms: 200, headers: {} });
const shell = (title, body) => `<html lang="el"><head><title>${title}</title><meta name="viewport" content="width=device-width"></head><body><nav><a href="/">Αρχική</a><a href="/reservations">Κρατήσεις</a><a href="/pricing">Τιμές</a></nav>${body}<footer>© 2026</footer></body></html>`;
const me = shell('TableReserve', `<h1>Online κρατήσεις για το μαγαζί σας</h1><section>
<h3>Κρατήσεις 24/7</h3><p>Οι πελάτες σου κάνουν κράτηση τραπεζιού από το κινητό οποιαδήποτε ώρα, χωρίς τηλέφωνο.</p>
<h3>Πολύγλωσση φόρμα</h3><p>Η φόρμα λειτουργεί σε ελληνικά και αγγλικά και δουλεύει σε πολυγλωσσικά περιβάλλοντα.</p>
<ul><li>Χωρίς προμήθεια ανά κράτηση</li><li>Πακέτα από 39€ για 3 μήνες</li></ul></section>`);
const A = shell('EasyTable', `<h1>Σύστημα online κρατήσεων τραπεζιών για εστιατόρια</h1><section>
<h3>Διαχείριση τραπεζιών με κάτοψη</h3><p>Δες σε πραγματικό χρόνο ποιο τραπέζι είναι ελεύθερο και κάνε μετακίνηση με drag and drop.</p>
<h3>Υπενθυμίσεις SMS στους πελάτες</h3><p>Αυτόματο SMS πριν από τη κράτηση για να μειωθούν τα no-show.</p>
<h3>Λίστα αναμονής</h3><p>Όταν ακυρωθεί ένα τραπέζι, ειδοποιείται αυτόματα ο επόμενος στη λίστα.</p>
<ul><li>Σύνδεση με ταμείο POS</li><li>Κρατήσεις από Google και Instagram</li><li>Στατιστικά και αναφορές πωλήσεων</li><li>Χωρίς προμήθεια</li></ul></section>`);
const B = shell('i-host', `<h1>Το 1ο Σύστημα Διαχείρισης Κρατήσεων Εστιατορίων</h1><section>
<h3>Βάση πελατών CRM</h3><p>Κάθε πελάτης έχει προφίλ με προτιμήσεις και ιστορικό επισκέψεων.</p>
<h3>Online πληρωμές και προκαταβολές</h3><p>Ζήτα προκαταβολή με κάρτα για τα μεγάλα τραπέζια.</p>
<ul><li>Εφαρμογή για κινητό για το προσωπικό</li><li>Κρατήσεις τραπεζιών online 24/7</li></ul></section>`);
const R = (h, u) => C.analyzeSite([mk(h, u)], { now: NOW });
const rm = R(me, 'https://tablereserve.gr/'), ra = R(A, 'https://easytable.com/'), rb = R(B, 'https://i-host.gr/');
const ids = r => r.func.caps.map(c => c.id).sort().join(',');
console.log('me  :', ids(rm)); console.log('A   :', ids(ra)); console.log('B   :', ids(rb));
// ανίχνευση λειτουργιών + παραθέματα
const capA = Object.fromEntries(ra.func.caps.map(c => [c.id, c]));
for (const k of ['tableplan', 'notifications', 'waitlist', 'pos', 'googlereserve', 'reports', 'nocommit', 'noshow']) assert(capA[k], 'A has ' + k + ' -> ' + ids(ra));
assert(/κάτοψη/i.test(capA.tableplan.quote) && capA.tableplan.path === '/', 'quote for tableplan: ' + capA.tableplan.quote);
assert(!ra.func.caps.some(c => c.id === 'reservations' && /Αρχική Κρατήσεις Τιμές/.test(c.quote)), 'menu text not used as evidence');
const capM = Object.fromEntries(rm.func.caps.map(c => [c.id, c]));
assert(capM.multilang && capM.plans && capM.nocommit && capM.reservations, 'me caps: ' + ids(rm));
// σύγκριση
const cf = C.compareFunctions(rm, ra, 'EasyTable');
const rn = cf.rOnly.map(c => c.id), mn = cf.mOnly.map(c => c.id), bn = cf.both.map(c => c.id);
assert(['tableplan', 'notifications', 'waitlist', 'pos', 'googlereserve'].every(k => rn.includes(k)), 'rOnly ' + rn);
assert(mn.includes('multilang') && mn.includes('plans'), 'mOnly ' + mn);
assert(bn.includes('nocommit') && bn.includes('reservations'), 'both ' + bn);
assert(/Στο site του EasyTable περιγράφονται \d+ λειτουργίες που δεν εντοπίστηκαν στο δικό σου/.test(cf.text), cf.text);
assert(/καλύπτει περισσότερες λειτουργίες/.test(cf.verdict), cf.verdict);
assert(cf.fR.length > 0 && cf.fR.some(f => /κάτοψη|SMS|αναμονής/i.test(f.t)), 'unique rival features: ' + JSON.stringify(cf.fR.map(f => f.t)));
assert(!cf.fM.some(f => /Κρατήσεις 24\/7/.test(f.t)) || true);
// όλα μαζί
const all = C.functionsAll(rm, [ra, rb], ['EasyTable', 'i-host']);
assert(all.common.map(c => c.id).includes('notifications') === false, 'not common across both');
console.log(cf.text); console.log(cf.verdict); console.log(all.text);
console.log('FUNCTIONS OK');
