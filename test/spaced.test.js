const { parseHTML } = require('linkedom'); const C = require('../analyzer.js'); const assert = require('assert');
const html = '<html lang="el"><head><title>TableReserve</title></head><body><h1><span>Online κρατήσεις</span><br>για το μαγαζί σας,<em>χωρίς κόπο</em></h1><p>Ένα<strong>δυνατό</strong>κείμενο</p></body></html>';
const r = C.analyzeSite([{ doc: parseHTML(html).document, url: 'https://tablereserve.gr/', html, size: html.length, status: 200, ms: 100, headers: {} }], {});
assert(/Online κρατήσεις για το μαγαζί σας, χωρίς κόπο/.test(r.meta.hints.h1), r.meta.hints.h1);
console.log('SPACED OK:', r.meta.hints.h1);
