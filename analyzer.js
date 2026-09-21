/*
 * Check-up — μηχανή ανάλυσης site.
 * Τρέχει και στον browser (DOMParser) και στον server (linkedom).
 * Δέχεται DOM, επιστρέφει αναφορά σε απλό JSON.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Checkup = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CATS = [
    { id: 'clarity', name: 'Σαφήνεια' },
    { id: 'copy', name: 'Ποιότητα κειμένου' },
    { id: 'trust', name: 'Εμπιστοσύνη' },
    { id: 'find', name: 'Εύρεση στη Google' },
    { id: 'convert', name: 'Επικοινωνία και ενέργεια' },
    { id: 'tech', name: 'Τεχνικά και προσβασιμότητα' }
  ];

  var PASS = 0.8, WARN = 0.4;

  var FREE_MAIL = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.gr', 'ymail.com', 'hotmail.com', 'hotmail.gr', 'outlook.com', 'outlook.gr', 'live.com', 'live.gr', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'mail.com', 'email.com', 'gmx.com', 'gmx.net', 'protonmail.com', 'proton.me', 'zoho.com', 'yandex.com', 'mail.ru', 'otenet.gr', 'forthnet.gr', 'hol.gr', 'windowslive.com', 'inbox.com']);
  var PRIVACY_RE = /απορρήτ|privacy|gdpr|προσωπικ[άα]ν? δεδομ|cookie/i;
  var TERMS_RE = /όροι|όρων|terms|προϋποθέσεις|conditions/i;
  var SOCIAL = [
    ['Facebook', /(^|\.)(facebook|fb)\.com$/i],
    ['Instagram', /(^|\.)instagram\.com$/i],
    ['LinkedIn', /(^|\.)linkedin\.com$/i],
    ['YouTube', /(^|\.)(youtube\.com|youtu\.be)$/i],
    ['X', /(^|\.)(twitter|x)\.com$/i],
    ['TikTok', /(^|\.)tiktok\.com$/i],
    ['Pinterest', /(^|\.)pinterest\.[a-z.]+$/i]
  ];
  var CTA_RE = /επικοινων|ζήτα|ζητήστε|κλείσε|κλείστε|κάλεσε|καλέστε|εγγραφ|δήλωσε|δηλώστε|αγορ|παράγγειλε|προσφορά|συνεργασ|book|contact|get started|buy|order|sign ?up|quote|call us|subscribe|request|demo|try/i;
  var COVID_RE = /κορωνοϊ|κορονοϊ|covid|πανδημ|lockdown/i;
  var PLACEHOLDER_RES = [/\[\[[^\]\n]{1,40}\]\]/, /\{\{[^}\n]{1,40}\}\}/, /\{[a-z]+(?:_[a-z]+)+\}/, /\{(?:title|name|link|url|vendor_count)\}/, /%[A-Z][A-Z_]{3,}%/, /lorem ipsum/i, /\bundefined\b/];
  var LANG_WORDS = /^(en|gr|el|es|de|fr|it|english|ελληνικά|español|deutsch|français|italiano)$/i;

  // ---------- βοηθητικά ----------
  function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  function len(s) { return Array.from(s || '').length; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function norm(s) { return clean(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''); }
  function uniq(a) { return Array.from(new Set(a)); }
  function short(s, n) { s = clean(s); return len(s) > n ? Array.from(s).slice(0, n - 1).join('') + '…' : s; }
  function plural(n, one, many) { return n === 1 ? one : many; }


  // ---------- βοηθητικά ποιότητας κειμένου (δωρεάν, χωρίς AI) ----------
  function normGr(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ς/g, 'σ'); }
  var CLICHES = [
    [/απαραμιλλ\w*/g, 'απαράμιλλος'], [/καινοτομ\w*/g, 'καινοτόμος/καινοτομία'], [/ολιστικ\w*/g, 'ολιστική'], [/κορυφαι\w*/g, 'κορυφαίος'],
    [/υψηλ\w+\s+ποιοτητ\w+/g, 'υψηλή ποιότητα'], [/υψηλου\s+επιπεδου/g, 'υψηλού επιπέδου'], [/εξατομικευμεν\w*/g, 'εξατομικευμένος'],
    [/στοχευμεν\w+\s+λυσ\w+/g, 'στοχευμένες λύσεις'], [/προσθετη\s+αξια|εξαιρετικη\s+αξια/g, 'προστιθέμενη αξία'], [/μοναδικ\w+\s+(?:εμπειρι\w+|λυσ\w+)/g, 'μοναδική εμπειρία'],
    [/πιστευουμε\s+στην?\s/g, 'πιστεύουμε στην…'], [/βιωσιμη\s+αναπτυξη/g, 'βιώσιμη ανάπτυξη'], [/αριστεια/g, 'αριστεία'], [/εξαιρετικ\w+\s+υπηρεσι\w+/g, 'εξαιρετικές υπηρεσίες'],
    [/διαρκ\w+\s+αντικτυπ\w+/g, 'διαρκής αντίκτυπος'],
    [/cutting[- ]edge|state[- ]of[- ]the[- ]art|world[- ]class|best[- ]in[- ]class|innovative\s+solutions|unparalleled|synerg\w+|seamless|next[- ]level|one[- ]stop[- ]shop|passionate\s+team|we\s+believe\s+in|leading\s+provider|tailored\s+solutions|holistic/g, 'αγγλικά κλισέ']
  ];
  function wordsOf(t) { return normGr(t).match(/\p{L}+/gu) || []; }


  // ---------- ημερομηνίες, παραθέματα, βοηθητικά αποδείξεων ----------
  var STALE_RE = /μέχρι\s+νεωτέρας|μέχρι\s+νεότερης|έως\s+νεωτέρας|until\s+further\s+notice|προσωρινά\s+κλειστ|temporarily\s+closed/i;
  var MONTHS_GR = ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];
  var MON_GR = { ιανουαρι: 0, φεβρουαρι: 1, μαρτι: 2, απριλι: 3, μαιου: 4, μαιο: 4, ιουνι: 5, ιουλι: 6, αυγουστ: 7, σεπτεμβρι: 8, οκτωβρι: 9, νοεμβρι: 10, δεκεμβρι: 11 };
  var MON_EN = { january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sept: 8, sep: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11 };
  function pathOf(u) { try { var p = new URL(u).pathname || '/'; return p.length > 1 ? p.replace(/\/+$/, '') : p; } catch (e) { return u || '/'; } }
  function datesIn(text, now) {
    var t = normGr(text), out = [], m, lim = (now || Date.now()) + 86400000;
    function add(y, mo, d) { var dt = Date.UTC(y, mo, Math.min(Math.max(d, 1), 28)); if (y >= 2000 && dt <= lim) out.push(dt); }
    var g = /(?:(\d{1,2})\s+)?(ιανουαρι|φεβρουαρι|μαρτι|απριλι|μαιου|μαιο|ιουνι|ιουλι|αυγουστ|σεπτεμβρι|οκτωβρι|νοεμβρι|δεκεμβρι)[α-ωa-z]*\.?\s+(?:(\d{1,2}),?\s+)?(20\d{2})/g;
    while ((m = g.exec(t))) add(+m[4], MON_GR[m[2]], +(m[1] || m[3] || 1));
    var e = /(?:\b(\d{1,2})\s+)?\b(january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sept|sep|oct|nov|dec)\b\.?\s+(?:(\d{1,2})(?:st|nd|rd|th)?,?\s+)?(20\d{2})/g;
    while ((m = e.exec(t))) add(+m[4], MON_EN[m[2]], +(m[1] || m[3] || 1));
    var n = /\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d{2})\b/g;
    while ((m = n.exec(t))) { if (+m[2] >= 1 && +m[2] <= 12) add(+m[3], +m[2] - 1, +m[1]); }
    var iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/g;
    while ((m = iso.exec(t))) { if (+m[2] >= 1 && +m[2] <= 12) add(+m[1], +m[2] - 1, +m[3]); }
    return out;
  }
  function fmtMonth(t) { var d = new Date(t); return MONTHS_GR[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
  function ageText(now, t) {
    var mo = Math.max(0, Math.round((now - t) / 2629800000));
    if (mo < 24) return 'πριν ' + mo + ' ' + (mo === 1 ? 'μήνα' : 'μήνες');
    var y = Math.floor(mo / 12); return 'πριν ' + y + ' ' + (y === 1 ? 'χρόνο' : 'χρόνια');
  }
  function sentenceWith(text, re) {
    var m = re.exec(text); if (!m) return '';
    var i = m.index, start = 0, end = text.length, k, a;
    ['. ', '! ', '? ', '· ', '; '].forEach(function (sep) { a = text.lastIndexOf(sep, i); if (a >= 0 && a + 2 > start && a < i) start = a + 2; });
    ['. ', '! ', '? ', '· ', '; '].forEach(function (sep) { k = text.indexOf(sep, i); if (k >= 0 && k + 1 < end) end = k + 1; });
    return short(text.slice(start, end), 190);
  }
  function COVID_RE_G() { return new RegExp(COVID_RE.source, 'i'); }
  function STALE_RE_G() { return new RegExp(STALE_RE.source, 'i'); }
  function whereText(path) { return path === '/' ? 'Στην αρχική σελίδα' : 'Στη σελίδα ' + path; }
  function pathOfSafe(u) { return u ? pathOf(u) : ''; }
  function titleElText(doc) { var t = doc.querySelector('title'); return t ? t.textContent : ''; }
  var NEWS_RE = /(news|blog|articles?|announcements?|press|ειδησ|νεα\b|αρθρα|ανακοινωσ)/i;

  // ---------- εξαγωγή δεδομένων από μία σελίδα ----------
  function extract(doc, ctx) {
    ctx = ctx || {};
    var base = ctx.url || null;
    function q(sel, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(sel)); }
    function attr(el, a) { return (el && el.getAttribute(a)) || ''; }
    function meta(n) {
      var el = doc.querySelector('meta[name="' + n + '"]') || doc.querySelector('meta[property="' + n + '"]');
      return el ? clean(el.getAttribute('content')) : null;
    }
    function abs(h) { try { return new URL(h, base || 'http://x.invalid/').href; } catch (e) { return h; } }

    // JSON-LD
    var ld = [], types = new Set(), ldBad = 0;
    function collect(n) {
      if (!n || typeof n !== 'object') return;
      if (n['@graph']) [].concat(n['@graph']).forEach(collect);
      if (n['@type']) [].concat(n['@type']).forEach(function (t) { types.add(String(t)); });
      ld.push(n);
    }
    q('script[type="application/ld+json"]').forEach(function (s) {
      try { var j = JSON.parse(s.textContent); (Array.isArray(j) ? j : [j]).forEach(collect); } catch (e) { ldBad++; }
    });
    q('[itemtype]').forEach(function (el) {
      var t = attr(el, 'itemtype').split('/').pop(); if (t) types.add(t);
    });

    // σύνδεσμοι
    var links = q('a[href]').map(function (a, i) {
      var img = a.querySelector('img'), svgt = a.querySelector('svg title');
      var text = clean(a.textContent);
      var name = text || clean(attr(a, 'aria-label')) || clean(attr(a, 'title')) || (img ? clean(attr(img, 'alt')) : '') || (svgt ? clean(svgt.textContent) : '');
      var cls = attr(a, 'class');
      return { i: i, href: attr(a, 'href'), text: text, name: name, hidden: attr(a, 'aria-hidden') === 'true', btn: /btn|button|cta/i.test(cls) || attr(a, 'role') === 'button' };
    });
    var buttons = q('button').map(function (b) { return clean(b.textContent); });

    // φόρμες
    var forms = q('form').map(function (f) {
      var inputs = q('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]), textarea, select', f);
      var labeled = inputs.filter(function (i) {
        var id = attr(i, 'id');
        return attr(i, 'aria-label') || attr(i, 'placeholder') || (id && f.querySelector('label[for="' + id + '"]')) || (i.closest && i.closest('label'));
      }).length;
      var privacy = q('a[href]', f).some(function (a) { return PRIVACY_RE.test(clean(a.textContent) + ' ' + attr(a, 'href')) || TERMS_RE.test(clean(a.textContent)); });
      return { inputs: inputs.length, labeled: labeled, checkbox: !!f.querySelector('input[type="checkbox"]'), privacy: privacy };
    });

    // εικόνες
    var imgs = q('img').map(function (i) {
      return { src: attr(i, 'src') || attr(i, 'data-src'), alt: i.getAttribute('alt'), w: attr(i, 'width'), h: attr(i, 'height') };
    }).filter(function (i) { return !/pixel|facebook\.com\/tr|\/tr\?|1x1|spacer/i.test(i.src); });

    // επικεφαλίδες
    function spaced(el) { var c = el.cloneNode(true); Array.prototype.slice.call(c.querySelectorAll('*')).forEach(function (n) { try { n.appendChild(doc.createTextNode(' ')); if (n.parentNode) n.parentNode.insertBefore(doc.createTextNode(' '), n); } catch (e) {} }); return clean(c.textContent); }
    var h1 = q('h1').map(spaced).filter(Boolean);
    var h2 = q('h2').map(spaced).filter(Boolean);

    // ορατό κείμενο
    var body = doc.body;
    var text = '';
    if (body) {
      var clone = body.cloneNode(true);
      Array.prototype.slice.call(clone.querySelectorAll('script,style,noscript,template,svg,iframe')).forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      Array.prototype.slice.call(clone.querySelectorAll('a,li,p,h1,h2,h3,h4,h5,h6,div,span,button,td,th,label,option,section,article,header,footer,nav,br,dt,dd')).forEach(function (n) { try { n.appendChild(doc.createTextNode(' ')); if (n.parentNode) n.parentNode.insertBefore(doc.createTextNode(' '), n); } catch (e) {} });
      text = clean(clone.textContent);
    }
    var pText = clean(q('p').map(spaced).join(' '));
    var words = text ? text.split(/\s+/).filter(function (w) { return len(w) > 1; }).length : 0;
    var greek = (text.match(/[\u0370-\u03FF\u1F00-\u1FFF]/g) || []).length;
    var latin = (text.match(/[A-Za-z]/g) || []).length;

    // παράγραφοι για πρόταση περιγραφής
    var paras = q('main p, article p, section p, p').map(spaced).filter(function (t) { return len(t) >= 70 && len(t) <= 400; });

    // επικοινωνία
    var phones = [];
    links.forEach(function (l) { if (/^tel:/i.test(l.href)) phones.push(decodeURIComponent(l.href.replace(/^tel:/i, '')).trim()); });
    var phoneRe = /(?:\+?30[\s.-]?)?(?:2\d{2}[\s.-]?\d{3}[\s.-]?\d{4}|69\d[\s.-]?\d{3}[\s.-]?\d{4}|2\d{9}|69\d{8})/g;
    (text.match(phoneRe) || []).forEach(function (p) { phones.push(p.trim()); });
    var telLinks = links.filter(function (l) { return /^tel:/i.test(l.href); }).length;
    var emails = [];
    links.forEach(function (l) { if (/^mailto:/i.test(l.href)) emails.push(l.href.replace(/^mailto:/i, '').split('?')[0].trim()); });
    (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).forEach(function (e) { if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(e)) emails.push(e); });
    var mailLinks = links.filter(function (l) { return /^mailto:/i.test(l.href); }).length;
    var schemaAddr = ld.some(function (n) { return n && (n.address || n['@type'] === 'PostalAddress'); });
    var addrRe = /[\p{L}.\s]{3,40}\s\d{1,3}[A-Za-zΑ-Ω]?,?\s+\d{3}\s?\d{2}\b/u;
    var hasAddress = schemaAddr || q('address').length > 0 || addrRe.test(text);

    // κοινωνικά
    var social = [], socialBroken = [];
    links.forEach(function (l) {
      var u; try { u = new URL(l.href, base || 'http://x.invalid/'); } catch (e) { return; }
      SOCIAL.forEach(function (s) {
        if (s[1].test(u.hostname)) {
          var path = u.pathname.replace(/\/+$/, '');
          if (!path && !u.search) socialBroken.push({ name: s[0], href: l.href });
          else social.push({ name: s[0], href: u.href });
        }
      });
    });

    // πολιτική απορρήτου / όροι
    var privacyLinks = links.filter(function (l) { return PRIVACY_RE.test(l.text + ' ' + l.href); });
    var termsLinks = links.filter(function (l) { return TERMS_RE.test(l.text) || /terms|oroi/i.test(l.href); });

    // αντίγραφα και ημερομηνίες
    var copyYears = [];
    var cre = /(?:©|copyright|\(c\))[^0-9]{0,40}((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi, m;
    while ((m = cre.exec(text))) { copyYears.push(+(m[2] || m[1])); }
    var dates = [];
    [meta('article:modified_time'), meta('og:updated_time'), meta('article:published_time')].forEach(function (d) { if (d) dates.push(d); });
    q('time[datetime]').forEach(function (t) { dates.push(attr(t, 'datetime')); });
    ld.forEach(function (n) { if (n && n.dateModified) dates.push(n.dateModified); });
    if (ctx.headers && ctx.headers['last-modified']) dates.push(ctx.headers['last-modified']);
    var lastDate = null;
    dates.forEach(function (d) { var t = Date.parse(d); if (!isNaN(t) && (lastDate === null || t > lastDate)) lastDate = t; });

    // γλώσσες
    var langSwitch = uniq(links.concat(buttons.map(function (b) { return { text: b }; })).map(function (l) { return (l.text || '').trim(); }).filter(function (t) { return LANG_WORDS.test(t); }).map(function (t) { return t.toLowerCase(); }));
    imgs.forEach(function (i) { if (i.alt && LANG_WORDS.test(i.alt.trim())) langSwitch.push(i.alt.trim().toLowerCase()); });
    langSwitch = uniq(langSwitch);

    var covidHit = sentenceWith(text, COVID_RE_G());
    var staleHit = sentenceWith(text, STALE_RE_G());
    var isNews = NEWS_RE.test(pathOfSafe(base) + ' ' + clean(titleElText(doc)));
    var textDates = isNews || (ctx.home === true) ? datesIn(text, ctx.now) : [];
    var hasPrice = /(€\s?\d|\d\s?€|\bEUR\b\s?\d|από\s+\d+\s?€|\$\s?\d)/i.test(text);
    var ctaAny = links.some(function (l) { return CTA_RE.test(l.name) && !l.hidden; }) || buttons.some(function (b) { return CTA_RE.test(b); });
    var ogImage = meta('og:image');
    var robotsMeta = meta('robots');
    var canonicalEl = doc.querySelector('link[rel="canonical"]');
    var titleEl = doc.querySelector('title');
    var placeholders = [];
    PLACEHOLDER_RES.forEach(function (re) { var mm = text.match(re); if (mm) placeholders.push(mm[0]); });
    (doc.documentElement ? doc.documentElement.outerHTML || '' : '').replace(/(?:value|placeholder|content|alt|title)="([^"]*\[\[[^"\]]{1,40}\]\][^"]*)"/g, function (all, v) { placeholders.push(short(v, 40)); return all; });

    return {
      url: ctx.url || '', status: ctx.status, ms: ctx.ms, size: ctx.size || (ctx.html ? ctx.html.length : 0), headers: ctx.headers || {},
      title: titleEl ? clean(titleEl.textContent) : '',
      desc: meta('description'),
      og: { title: meta('og:title'), description: meta('og:description'), image: ogImage, siteName: meta('og:site_name'), twitter: meta('twitter:card') },
      canonical: canonicalEl ? attr(canonicalEl, 'href') : '',
      lang: attr(doc.documentElement, 'lang'),
      viewport: meta('viewport'),
      robotsMeta: robotsMeta,
      hreflang: q('link[rel="alternate"][hreflang]').length,
      ldTypes: Array.from(types), ldCount: ld.length, ldBad: ldBad, ld: ld,
      h1: h1, h2: h2, text: text, pText: pText, words: words, greekRatio: greek + latin ? greek / (greek + latin) : 0,
      paras: paras, links: links, buttons: buttons, forms: forms, imgs: imgs,
      phones: uniq(phones), emails: uniq(emails), telLinks: telLinks, mailLinks: mailLinks, hasAddress: hasAddress,
      social: social, socialBroken: socialBroken, privacyLinks: privacyLinks, termsLinks: termsLinks,
      copyYears: copyYears, lastDate: lastDate, langSwitch: langSwitch, placeholders: uniq(placeholders),
      scripts: q('script[src]').length, styles: q('link[rel~="stylesheet"]').length,
      autoplayVideo: q('video[autoplay]').length > 0,
      covidHit: covidHit, staleHit: staleHit, isNews: isNews, textDates: textDates, hasPrice: hasPrice, ctaAny: ctaAny,
      ratingSchema: ld.some(function (n) { return n && (n.aggregateRating || n.review); })
    };
  }

  function deriveBrand(h, url) {
    if (h.og && h.og.siteName) return h.og.siteName;
    var org = (h.ld || []).filter(function (n) { return n && n.name && /Organization|Business|Service|NGO|School|Restaurant|Hotel|Store/.test([].concat(n['@type'] || []).join(',')); })[0];
    if (org) return clean(org.name);
    if (h.title) {
      var parts = h.title.split(/\s[|–—-]\s|\s:\s/).map(clean).filter(Boolean);
      var shortest = parts.sort(function (a, b) { return len(a) - len(b); })[0];
      if (shortest && len(shortest) <= 32) return shortest;
    }
    var hn = hostOf(url || '').split('.')[0] || 'Η επιχείρησή σου';
    return hn.charAt(0).toUpperCase() + hn.slice(1);
  }

  // ---------- έλεγχοι ----------
  // Κάθε έλεγχος: run(S) -> null (δεν εφαρμόζεται) ή { s: 0..1, ev: [...] }
  function ORG_LIKE(t) { return /(Organization|Business|Service|Restaurant|Hotel|Store|Corporation|NGO|School|Clinic|Dentist|Physician|Person|Shop|Cafe|Bar|Lodging|Attorney|Accountant)$/i.test(t); }

  var CHECKS = [
    // --- Σαφήνεια ---
    {
      id: 'title', cat: 'clarity', w: 4, name: 'Τίτλος σελίδας',
      why: 'Είναι ο τίτλος που βλέπει ο κόσμος στη Google. Πρέπει να λέει τι κάνεις, όχι μόνο πώς λέγεσαι.',
      fix: 'Γράψε τίτλο 30–65 χαρακτήρων με μορφή «Τι προσφέρεις + πού | Όνομα».',
      run: function (S) {
        var h = S.home, t = h.title;
        if (!t) return { s: 0, ev: ['Δεν βρέθηκε τίτλος σελίδας.'] };
        var n = len(t), ev = ['Τίτλος: «' + t + '» (' + n + ' χαρακτήρες)'], s = 1;
        var parts = t.split(/\s[|–—-]\s|\s:\s/).map(norm).filter(Boolean);
        var generic = /^(home|αρχική|αρχικη|welcome|untitled|υπηρεσίες|επικοινωνία|σχετικά|news|contact)$/i.test(clean(t));
        var brandOnly = norm(t) === norm(S.brand) || (n <= 24 && !/[|–—:]|\s-\s/.test(t) && t.split(/\s+/).length <= 3);
        if (generic) { s = 0.2; ev.push('Ο τίτλος είναι γενικός και δεν λέει τίποτα για την επιχείρηση.'); }
        else if (parts.length > 1 && parts[0] === parts[1]) { s = 0.5; ev.push('Το ίδιο όνομα επαναλαμβάνεται δύο φορές στον τίτλο.'); }
        else if (brandOnly) { s = 0.4; ev.push('Ο τίτλος έχει μόνο το όνομα, όχι τι κάνεις.'); }
        else if (n < 20) { s = 0.6; ev.push('Πολύ σύντομος τίτλος.'); }
        else if (n > 70) { s = 0.7; ev.push('Πάνω από 70 χαρακτήρες: θα κοπεί στα αποτελέσματα.'); }
        return { s: s, ev: ev };
      }
    },
    {
      id: 'desc', cat: 'clarity', w: 4, name: 'Περιγραφή για τη Google (meta description)',
      why: 'Είναι το κείμενο κάτω από τον τίτλο στα αποτελέσματα. Αν λείπει, η Google επιλέγει η ίδια ένα τυχαίο απόσπασμα.',
      fix: 'Πρόσθεσε περιγραφή 70–160 χαρακτήρων με το κύριο όφελος και μια πρόσκληση για ενέργεια.',
      run: function (S) {
        var d = S.home.desc;
        if (!d) return { s: 0, ev: ['Δεν βρέθηκε meta description.'] };
        var n = len(d), ev = ['Περιγραφή (' + n + ' χαρακτήρες): «' + short(d, 110) + '»'];
        if (n < 50) return { s: 0.5, ev: ev.concat('Πολύ σύντομη.') };
        if (n > 200) return { s: 0.7, ev: ev.concat('Πολύ μεγάλη, θα κοπεί.') };
        return { s: 1, ev: ev };
      }
    },
    {
      id: 'h1', cat: 'clarity', w: 3, name: 'Κύριος τίτλος (H1)',
      why: 'Ο κύριος τίτλος στη σελίδα λέει στον επισκέπτη και στη Google για τι μιλάει η σελίδα.',
      fix: 'Βάλε έναν μόνο H1 που περιγράφει καθαρά την υπηρεσία ή την αποστολή σου.',
      run: function (S) {
        var h = S.home.h1;
        if (h.length === 0) return { s: 0, ev: ['Δεν υπάρχει H1 στη σελίδα.'] };
        if (h.length > 1) return { s: 0.6, ev: ['Βρέθηκαν ' + h.length + ' H1. Πρώτος: «' + short(h[0], 80) + '»'] };
        return { s: 1, ev: ['H1: «' + short(h[0], 90) + '»'] };
      }
    },
    {
      id: 'headings', cat: 'clarity', w: 2, name: 'Δομή με υποτίτλους',
      why: 'Οι υπότιτλοι (H2) κάνουν τη σελίδα εύκολη στην ανάγνωση και δείχνουν τα θέματά της.',
      fix: 'Χώρισε το κείμενο σε ενότητες με H2 (τουλάχιστον 2–3 στην αρχική).',
      run: function (S) {
        var n = S.home.h2.length;
        return { s: n >= 2 ? 1 : n === 1 ? 0.6 : 0.3, ev: [n + ' ' + plural(n, 'υπότιτλος', 'υπότιτλοι') + ' (H2) στην αρχική.'] };
      }
    },
    {
      id: 'content', cat: 'clarity', w: 3, name: 'Επάρκεια κειμένου',
      why: 'Πολύ λίγο κείμενο δεν εξηγεί τι προσφέρεις ούτε δίνει στη Google κάτι να καταλάβει.',
      fix: 'Γράψε 250+ λέξεις στην αρχική: τι κάνεις, για ποιον, τι κερδίζει ο πελάτης, ένα παράδειγμα.',
      run: function (S) {
        var n = S.home.words;
        var s = n >= 250 ? 1 : n >= 120 ? 0.7 : n >= 60 ? 0.4 : 0.1;
        return { s: s, ev: ['Περίπου ' + n + ' λέξεις ορατού κειμένου στην αρχική.'] };
      }
    },
    {
      id: 'lang', cat: 'clarity', w: 2, name: 'Δήλωση γλώσσας',
      why: 'Η δήλωση γλώσσας βοηθά τη Google, τους browsers και τους αναγνώστες οθόνης.',
      fix: 'Πρόσθεσε lang="el" στο <html> (ή lang="en" αν η σελίδα είναι αγγλική).',
      run: function (S) {
        var h = S.home;
        if (!h.lang) return { s: 0, ev: ['Λείπει το lang στο <html>.'] };
        var isEl = /^el/i.test(h.lang);
        if (h.greekRatio > 0.5 && !isEl) return { s: 0.5, ev: ['lang="' + h.lang + '" αλλά το κείμενο είναι ελληνικό.'] };
        if (h.greekRatio < 0.2 && isEl && h.words > 30) return { s: 0.5, ev: ['lang="el" αλλά το κείμενο είναι κυρίως αγγλικό.'] };
        return { s: 1, ev: ['lang="' + h.lang + '"'] };
      }
    },


    // --- Ποιότητα κειμένου (κανόνες, χωρίς AI) ---
    {
      id: 'cliches', cat: 'copy', w: 3, name: 'Διατύπωση χωρίς κοινοτοπίες',
      why: 'Φράσεις όπως «απαράμιλλη εξειδίκευση» ή «καινοτόμες λύσεις» υπάρχουν σε χιλιάδες sites και δεν πείθουν κανέναν.',
      fix: 'Αντικατάστησέ τες με κάτι συγκεκριμένο: τι ακριβώς κάνεις, για ποιον και με ποιο αποτέλεσμα.',
      run: function (S) {
        var t = normGr(S.union.pText || S.union.text), w = wordsOf(t).length;
        if (w < 40) return null;
        var found = [], total = 0;
        CLICHES.forEach(function (c) { var m = t.match(c[0]); if (m) { total += m.length; found.push(c[1] + ' (×' + m.length + ')'); } });
        var dens = total / (w / 100);
        var s = total === 0 ? 1 : (total <= 2 && dens < 1.2) ? 0.8 : total <= 4 ? 0.5 : 0.2;
        return { s: s, ev: total ? ['Βρέθηκαν ' + total + ' κοινοτοπίες: ' + found.slice(0, 5).join(', ') + '.'] : ['Δεν βρέθηκαν συνηθισμένες κοινοτοπίες.'] };
      }
    },
    {
      id: 'voice', cat: 'copy', w: 2, name: 'Μιλάς για τον πελάτη ή για σένα;',
      why: 'Τα κείμενα που μιλούν μόνο για το «εμείς» δεν απαντούν στο ερώτημα του επισκέπτη: «τι κερδίζω εγώ;».',
      fix: 'Γύρνα τις προτάσεις προς τον πελάτη: «θα μειώσεις το κόστος σου», όχι «πιστεύουμε στην αριστεία».',
      run: function (S) {
        var ws = wordsOf(S.union.pText || S.union.text), we = 0, you = 0;
        ws.forEach(function (x) {
          if (/^(εμεισ|μασ|ημων|we|our|us)$/.test(x) || /(ουμε|αμε)$/.test(x) && x.length > 6) we++;
          else if (/^(εσυ|εσεισ|σου|σασ|εσενα|you|your|yours)$/.test(x)) you++;
        });
        if (we + you < 4) return null;
        var r = we / (we + you);
        var s = r <= 0.5 ? 1 : r <= 0.65 ? 0.8 : r <= 0.8 ? 0.5 : 0.25;
        return { s: s, ev: ['Λέξεις για το «εμείς»: ' + we + '. Λέξεις για το «εσύ/εσείς»: ' + you + '.'] };
      }
    },
    {
      id: 'sentences', cat: 'copy', w: 2, name: 'Μήκος προτάσεων',
      why: 'Πολύ μεγάλες προτάσεις κουράζουν και ο επισκέπτης σταματά να διαβάζει.',
      fix: 'Σπάσε τις προτάσεις πάνω από 30 λέξεις σε δύο. Ένα νόημα ανά πρόταση.',
      run: function (S) {
        var t = S.union.pText || '';
        var sen = t.split(/[.!?…;·]+\s+/).map(function (x) { return wordsOf(x).length; }).filter(function (n) { return n >= 3; });
        var total = sen.reduce(function (a, b) { return a + b; }, 0);
        if (sen.length < 3 || total < 60) return null;
        var avg = total / sen.length, longN = sen.filter(function (n) { return n > 35; }).length;
        var s = avg <= 20 ? 1 : avg <= 26 ? 0.8 : avg <= 32 ? 0.5 : 0.25;
        if (longN / sen.length > 0.25) s = Math.min(s, 0.5);
        return { s: s, ev: ['Μέση πρόταση: ' + Math.round(avg) + ' λέξεις.' + (longN ? ' ' + longN + ' ' + (longN === 1 ? 'πρόταση έχει' : 'προτάσεις έχουν') + ' πάνω από 35 λέξεις.' : '')] };
      }
    },
    {
      id: 'specifics', cat: 'copy', w: 2, name: 'Συγκεκριμένα στοιχεία',
      why: 'Αριθμοί, χρόνια εμπειρίας, ποσοστά και παραδείγματα κάνουν έναν ισχυρισμό πιστευτό.',
      fix: 'Πρόσθεσε 2–3 συγκεκριμένα στοιχεία: πόσοι πελάτες, πόσα έργα, σε πόσο χρόνο, με τι αποτέλεσμα.',
      run: function (S) {
        var t = S.union.pText || ''; if (wordsOf(t).length < 80) return null;
        var c = t.replace(/(?:©|copyright)[^.]{0,50}/gi, ' ').replace(/(?:\+?30[\s.-]?)?(?:2\d{2}[\s.-]?\d{3}[\s.-]?\d{4}|69\d[\s.-]?\d{3}[\s.-]?\d{4}|2\d{9}|69\d{8})/g, ' ').replace(/\b\d{3}\s?\d{2}\b/g, ' ');
        var nums = (c.match(/\d[\d.,]*\s?(?:%|€|\+)?/g) || []).map(function (x) { return x.trim(); }).filter(Boolean);
        var uniqN = uniq(nums);
        var s = uniqN.length >= 3 ? 1 : uniqN.length === 2 ? 0.7 : uniqN.length === 1 ? 0.5 : 0.25;
        return { s: s, ev: uniqN.length ? ['Βρέθηκαν ' + uniqN.length + ' αριθμητικά στοιχεία (π.χ. ' + uniqN.slice(0, 3).join(', ') + ').'] : ['Το κείμενο δεν έχει αριθμούς, ποσοστά ή χρόνια εμπειρίας.'] };
      }
    },
    {
      id: 'repeat', cat: 'copy', w: 2, name: 'Καθαρότητα κειμένου (επαναλήψεις, μετάφραση)',
      why: 'Οι λέξεις που επαναλαμβάνονται συνεχώς ή γράφονται δύο φορές («εμπόδια και εμπόδια») δείχνουν αυτόματη μετάφραση ή προχειρότητα.',
      fix: 'Διάβασε ξανά τα κείμενα φωναχτά και διόρθωσε ό,τι ακούγεται περίεργο. Μείωσε τις λίστες που επαναλαμβάνονται σε κάθε ερώτηση.',
      run: function (S) {
        var ev = [], pen = 0, any = false;
        S.pages.forEach(function (p) {
          var t = normGr(p.pText || ''); if (wordsOf(t).length < 40) return; any = true;
          var dbl = t.match(/(?<![\p{L}])(\p{L}{4,})\s+(?:και\s+)?\1(?![\p{L}])/gu);
          if (dbl && dbl.length) { pen += 0.4; ev.push('Διπλή λέξη: «' + short(dbl[0], 40) + '».'); }
          var ws = (t.match(/\p{L}{3,}/gu) || []), cnt = {};
          for (var i = 0; i < ws.length - 2; i++) { var g = ws[i] + ' ' + ws[i + 1] + ' ' + ws[i + 2]; cnt[g] = (cnt[g] || 0) + 1; }
          var rep = Object.keys(cnt).filter(function (k) { return cnt[k] >= 4; }).sort(function (a, b) { return cnt[b] - cnt[a]; });
          if (rep.length) { pen += 0.5; ev.push('Η φράση «' + short(rep[0], 40) + '» επαναλαμβάνεται ' + cnt[rep[0]] + ' φορές σε μία σελίδα.'); }
        });
        if (!any) return null;
        return { s: clamp(1 - pen, 0, 1), ev: ev.length ? uniq(ev).slice(0, 3) : ['Δεν βρέθηκαν διπλές λέξεις ή υπερβολικές επαναλήψεις.'] };
      }
    },

    // --- Εμπιστοσύνη ---
    {
      id: 'contact', cat: 'trust', w: 5, name: 'Στοιχεία επικοινωνίας',
      why: 'Ο πελάτης εμπιστεύεται μια επιχείρηση που φαίνεται πού βρίσκεται και πώς τη βρίσκεις.',
      fix: 'Δείξε τηλέφωνο, email και διεύθυνση σε ένα σταθερό σημείο (footer και σελίδα επικοινωνίας).',
      run: function (S) {
        var u = S.union, got = [];
        if (u.phones.length) got.push('τηλέφωνο');
        if (u.emails.length) got.push('email');
        if (u.hasAddress) got.push('διεύθυνση');
        var s = got.length >= 3 ? 1 : got.length === 2 ? 0.85 : got.length === 1 ? 0.5 : 0;
        return { s: s, ev: got.length ? ['Βρέθηκαν: ' + got.join(', ') + '.'] : ['Δεν βρέθηκε τηλέφωνο, email ή διεύθυνση.'] };
      }
    },
    {
      id: 'emaildomain', cat: 'trust', w: 3, name: 'Επαγγελματικό email',
      why: 'Ένα email @gmail.com ή @mail.com φαίνεται λιγότερο σοβαρό από info@τοdomainσου.gr και πάει πιο εύκολα σε spam.',
      fix: 'Φτιάξε email στο δικό σου domain (π.χ. info@όνομα.gr) και άλλαξέ το στη σελίδα.',
      run: function (S) {
        var em = S.union.emails; if (!em.length) return null;
        var host = S.host;
        var free = [], own = [];
        em.forEach(function (e) {
          var d = e.split('@')[1] || ''; d = d.toLowerCase();
          if (FREE_MAIL.has(d)) free.push(d);
          else if (d && host && (d === host || d.endsWith('.' + host) || host.endsWith('.' + d))) own.push(d);
        });
        if (own.length) return { s: 1, ev: ['Το email είναι στο δικό σου domain (' + own[0] + ').'] };
        if (free.length) return { s: 0.4, ev: ['Το email είναι σε δωρεάν υπηρεσία (@' + free[0] + ').'] };
        return { s: 0.8, ev: ['Το email είναι σε άλλο domain (' + (em[0].split('@')[1] || '') + ').'] };
      }
    },
    {
      id: 'privacy', cat: 'trust', w: 4, name: 'Πολιτική απορρήτου και όροι',
      why: 'Αν συλλέγεις email ή στοιχεία (φόρμα, cookies), το GDPR ζητά ενημέρωση. Δείχνει και σοβαρότητα.',
      fix: 'Πρόσθεσε σελίδες «Πολιτική Απορρήτου» και «Όροι Χρήσης» με σύνδεσμο στο footer και στις φόρμες.',
      run: function (S) {
        var p = S.union.privacyLinks.length, t = S.union.termsLinks.length;
        if (p) return { s: 1, ev: ['Βρέθηκε σύνδεσμος απορρήτου/cookies' + (t ? ' και όρων.' : '.')] };
        if (t) return { s: 0.5, ev: ['Βρέθηκαν όροι χρήσης αλλά όχι πολιτική απορρήτου.'] };
        return { s: 0, ev: ['Δεν βρέθηκε σύνδεσμος πολιτικής απορρήτου ή όρων.'] };
      }
    },
    {
      id: 'proof', cat: 'trust', w: 4, name: 'Αποδείξεις εμπιστοσύνης',
      why: 'Κριτικές, πελάτες, βραβεία και συνεργασίες πείθουν πιο πολύ από τους ισχυρισμούς της ίδιας της επιχείρησης.',
      fix: 'Δείξε 2–3 κριτικές ή λογότυπα πελατών/συνεργατών και ένα παράδειγμα δουλειάς με αποτέλεσμα.',
      run: function (S) {
        var t = S.union.text, sig = [];
        var hd = S.union.heads;
        var checks = [[/αξιολογήσεις|κριτικές|testimonials?|reviews/i, 'κριτικές', t + ' ' + hd], [/πελάτες|clients|customers|trusted by|μας εμπιστεύ/i, 'πελάτες', hd], [/συνεργάτες|partners|υποστηρικτές|sponsors/i, 'συνεργάτες', hd], [/case stud|έργα|portfolio|projects|δουλειές/i, 'έργα', hd], [/βραβεί|award|πιστοποίη|certif|διαπίστευ/i, 'πιστοποιήσεις/βραβεία', t + ' ' + hd]];
        checks.forEach(function (c) { if (c[0].test(c[2])) sig.push(c[1]); });
        if (S.union.ratingSchema) sig.push('βαθμολογία σε δομημένα δεδομένα');
        if (S.union.reviewWidget) sig.push('widget κριτικών');
        var s = sig.length >= 3 ? 1 : sig.length === 2 ? 0.8 : sig.length === 1 ? 0.5 : 0.1;
        return { s: s, ev: sig.length ? ['Βρέθηκαν ενδείξεις για: ' + sig.join(', ') + '.'] : ['Δεν βρέθηκαν κριτικές, πελάτες, έργα ή πιστοποιήσεις.'] };
      }
    },
    {
      id: 'social', cat: 'trust', w: 3, name: 'Σύνδεσμοι κοινωνικών δικτύων',
      why: 'Οι σύνδεσμοι στα social δείχνουν ότι η επιχείρηση είναι ενεργή. Ένας σπασμένος σύνδεσμος κάνει το αντίθετο.',
      fix: 'Βάλε το ακριβές προφίλ σου (π.χ. facebook.com/όνομα) και όχι την αρχική του δικτύου.',
      run: function (S) {
        var ok = S.union.social, bad = S.union.socialBroken;
        if (bad.length) return { s: 0.2, ev: ['Σπασμένος σύνδεσμος: το «' + bad[0].name + '» πηγαίνει μόνο στην αρχική του δικτύου (' + short(bad[0].href, 40) + ').'] };
        if (!ok.length) return { s: 0.3, ev: ['Δεν βρέθηκαν σύνδεσμοι σε κοινωνικά δίκτυα.'] };
        var names = uniq(ok.map(function (x) { return x.name; }));
        return { s: 1, ev: ['Βρέθηκαν: ' + names.join(', ') + '.'] };
      }
    },
    {
      id: 'legal', cat: 'trust', w: 2, name: 'Στοιχεία εταιρείας (ΑΦΜ/ΓΕΜΗ)',
      why: 'Το ΑΦΜ ή ο αριθμός ΓΕΜΗ δείχνουν ότι πρόκειται για πραγματική, καταχωρημένη επιχείρηση.',
      fix: 'Πρόσθεσε στο footer επωνυμία, ΑΦΜ και ΓΕΜΗ (ή αριθμό μητρώου).',
      run: function (S) {
        var t = S.union.text;
        return /(Α\.?Φ\.?Μ\.?|ΓΕΜΗ|Γ\.Ε\.ΜΗ|VAT\s*(?:ID|No|number)?|company (?:no|number|reg)|reg\.? no|ΔΟΥ)/i.test(t)
          ? { s: 1, ev: ['Βρέθηκε αναφορά σε ΑΦΜ/ΓΕΜΗ/VAT.'] }
          : { s: 0.3, ev: ['Δεν βρέθηκαν ΑΦΜ, ΓΕΜΗ ή αριθμός μητρώου.'] };
      }
    },
    {
      id: 'fresh', cat: 'trust', w: 4, name: 'Επικαιρότητα',
      why: 'Ένα «© 2020» ή μια ειδοποίηση πανδημίας το 2026 δίνει την εντύπωση ότι η επιχείρηση έχει εγκαταλειφθεί.',
      fix: 'Ενημέρωσε το έτος στο footer, αφαίρεσε παλιές ειδοποιήσεις και ανάρτησε τακτικά νέα.',
      run: function (S) {
        var now = new Date(S.now), y = now.getFullYear(), ev = [], s = 1, any = false;
        var years = S.union.copyYears;
        if (years.length) {
          any = true; var yr = Math.max.apply(null, years), age = y - yr;
          if (age >= 3) { s -= 0.6; ev.push('Το footer γράφει «© ' + yr + '» (πριν ' + age + ' χρόνια).'); }
          else if (age === 2) { s -= 0.35; ev.push('Το footer γράφει «© ' + yr + '».'); }
          else ev.push('Το έτος στο footer είναι ' + yr + '.');
        }
        var ch = S.union.covidHits[0], sh = S.union.staleHits[0];
        if (ch) { any = true; s -= 0.4; ev.push(whereText(ch.path) + ' υπάρχει ακόμα αναφορά στην πανδημία: «' + ch.snippet + '»'); }
        if (sh && (!ch || sh.snippet !== ch.snippet)) { any = true; s -= 0.3; ev.push(whereText(sh.path) + ' υπάρχει ειδοποίηση που δεν έχει λήξει: «' + sh.snippet + '»'); }
        if (S.union.lastDate) {
          any = true; var yrs = (S.now - S.union.lastDate) / 31557600000;
          if (yrs > 3) { s -= 0.3; ev.push('Η πιο πρόσφατη ημερομηνία στις σελίδες είναι πριν ' + Math.floor(yrs) + ' χρόνια.'); }
          else ev.push('Πρόσφατη ημερομηνία ενημέρωσης: ' + new Date(S.union.lastDate).toISOString().slice(0, 10) + '.');
        }
        if (!any) return null;
        return { s: clamp(s, 0, 1), ev: ev };
      }
    },


    {
      id: 'news', cat: 'trust', w: 3, name: 'Νέα και ενημερώσεις',
      why: 'Μια ενότητα νέων που δεν ενημερώνεται δίνει την εντύπωση ότι η επιχείρηση έχει σταματήσει να δραστηριοποιείται.',
      fix: 'Ανάρτησε τακτικά (έστω μία φορά τον μήνα) ή αφαίρεσε την ενότητα αν δεν θα τη συντηρείς.',
      run: function (S) {
        var n = S.union.news; if (!n) return null;
        var mo = (S.now - n.latest) / 2629800000;
        var s = mo <= 12 ? 1 : mo <= 24 ? 0.6 : 0.2;
        return { s: s, ev: ['Η πιο πρόσφατη ανάρτηση στη σελίδα ' + n.path + ' είναι του ' + fmtMonth(n.latest) + ' (' + ageText(S.now, n.latest) + ').'] };
      }
    },

    // --- Εύρεση ---
    {
      id: 'canonical', cat: 'find', w: 3, name: 'Canonical URL',
      why: 'Δείχνει στη Google ποια είναι η κύρια διεύθυνση της σελίδας, ώστε να μη μετράει διπλότυπα.',
      fix: 'Πρόσθεσε <link rel="canonical" href="https://…"> με την τελική διεύθυνση κάθε σελίδας.',
      run: function (S) {
        var c = S.home.canonical;
        if (!c) return { s: 0.4, ev: ['Δεν βρέθηκε canonical.'] };
        var ch = hostOf(c);
        if (S.host && ch && ch !== S.host) return { s: 0.6, ev: ['Το canonical δείχνει σε άλλο domain (' + ch + ').'] };
        return { s: 1, ev: ['Canonical: ' + short(c, 70)] };
      }
    },
    {
      id: 'og', cat: 'find', w: 4, name: 'Προεπισκόπηση σε Facebook/LinkedIn (Open Graph)',
      why: 'Όταν κάποιος μοιράζεται τον σύνδεσμο, οι ετικέτες og ορίζουν τον τίτλο, το κείμενο και την εικόνα που θα φανούν.',
      fix: 'Πρόσθεσε og:title, og:description και og:image (εικόνα 1200×630, JPG ή PNG στο δικό σου domain).',
      run: function (S) {
        var o = S.home.og, ev = [], pts = 0;
        if (o.title) pts += 1; else ev.push('Λείπει το og:title.');
        if (o.description) pts += 1; else ev.push('Λείπει το og:description.');
        if (!o.image) ev.push('Λείπει το og:image.');
        else if (/\.(ico|svg)(\?|$)/i.test(o.image)) { pts += 0.3; ev.push('Το og:image είναι αρχείο ' + o.image.split('.').pop().split('?')[0].toUpperCase() + ' (' + short(o.image, 50) + '), που δεν εμφανίζεται σωστά ως εικόνα κοινοποίησης.'); }
        else if (/raw\.githubusercontent\.com|drive\.google\.com/i.test(o.image)) { pts += 0.7; ev.push('Το og:image φορτώνεται από ' + hostOf(o.image) + ' αντί για το δικό σου domain.'); }
        else pts += 1;
        var s = pts / 3;
        if (s >= PASS && !ev.length) ev.push('Υπάρχουν og:title, og:description και og:image.');
        return { s: clamp(s, 0, 1), ev: ev };
      }
    },
    {
      id: 'schema', cat: 'find', w: 4, name: 'Δομημένα δεδομένα (schema.org)',
      why: 'Λένε στη Google και στα AI εργαλεία ποια είναι η επιχείρηση, πού βρίσκεται και πώς επικοινωνείς.',
      fix: 'Πρόσθεσε JSON-LD τύπου Organization ή LocalBusiness με όνομα, τηλέφωνο, διεύθυνση και sameAs.',
      run: function (S) {
        var t = S.home.ldTypes;
        if (!t.length) return { s: 0, ev: ['Δεν βρέθηκαν δομημένα δεδομένα.'] };
        var org = t.some(ORG_LIKE);
        return org ? { s: 1, ev: ['Τύποι: ' + t.slice(0, 5).join(', ') + '.'] } : { s: 0.5, ev: ['Υπάρχουν δεδομένα (' + t.slice(0, 4).join(', ') + ') αλλά όχι για την επιχείρηση.'] };
      }
    },
    {
      id: 'alt', cat: 'find', w: 4, name: 'Περιγραφές εικόνων (alt)',
      why: 'Το alt βοηθά τους τυφλούς χρήστες και τη Google να καταλάβει τις εικόνες.',
      fix: 'Γράψε σύντομη περιγραφή για κάθε ουσιαστική εικόνα (όχι όνομα αρχείου, όχι «Carousel Image 1»).',
      run: function (S) {
        var im = S.home.imgs; if (!im.length) return null;
        var bad = 0, ex = [];
        im.forEach(function (i) {
          var a = i.alt;
          var fileLike = a && (/\.(jpe?g|png|gif|webp|svg)$/i.test(a.trim()) || /^(img|dsc|image|photo|picture|screenshot|carousel image|slide)[-_ ]?\d*$/i.test(a.trim()) || /^[\w-]+[-_]\d{4,}(x\d+)?$/.test(a.trim()) || /^(main photo|logo)$/i.test(a.trim()));
          if (a === null || fileLike) { bad++; if (ex.length < 3) ex.push(a === null ? '(χωρίς alt)' : '«' + short(a, 28) + '»'); }
        });
        var s = 1 - bad / im.length;
        return { s: s, ev: [(im.length - bad) + ' από ' + im.length + ' εικόνες έχουν σωστό alt.'].concat(bad ? ['Παραδείγματα προβλήματος: ' + ex.join(', ') + '.'] : []) };
      }
    },
    {
      id: 'noindex', cat: 'find', w: 3, name: 'Επιτρέπεται η ευρετηρίαση',
      why: 'Μια ετικέτα noindex κρύβει τη σελίδα από τη Google.',
      fix: 'Αφαίρεσε το noindex από το meta robots (και από κεφαλίδες server) αν θέλεις να βρίσκεσαι στη Google.',
      run: function (S) {
        var r = (S.home.robotsMeta || '') + ' ' + ((S.home.headers && S.home.headers['x-robots-tag']) || '');
        if (/noindex/i.test(r)) return { s: 0, ev: ['Η σελίδα ζητά να μην ευρετηριαστεί (noindex).'] };
        return { s: 1, ev: ['Δεν βρέθηκε noindex.'] };
      }
    },
    {
      id: 'sitemap', cat: 'find', w: 3, name: 'Χάρτης σελίδων (sitemap) και robots.txt',
      why: 'Το sitemap βοηθά τη Google να βρει όλες τις σελίδες. Το robots.txt δεν πρέπει να τη μπλοκάρει.',
      fix: 'Δημιούργησε /sitemap.xml και /robots.txt με γραμμή «Sitemap: https://…/sitemap.xml».',
      run: function (S) {
        var r = S.ctx.robots; if (!r) return null;
        var ev = [], s = 0;
        if (r.blocksAll) return { s: 0, ev: ['Το robots.txt μπλοκάρει όλους τους crawlers (Disallow: /).'] };
        if (r.robotsFound) { s += 0.3; ev.push('Υπάρχει robots.txt.'); } else ev.push('Δεν βρέθηκε robots.txt.');
        if (r.sitemapFound) { s += 0.7; ev.push('Βρέθηκε sitemap.'); } else ev.push('Δεν βρέθηκε sitemap.xml.');
        return { s: s, ev: ev };
      }
    },
    {
      id: 'linknames', cat: 'find', w: 2, name: 'Σύνδεσμοι με κείμενο',
      why: 'Σύνδεσμοι χωρίς κείμενο (μόνο εικονίδιο) δεν λένε τίποτα σε αναγνώστες οθόνης και στη Google.',
      fix: 'Πρόσθεσε κείμενο ή aria-label σε κάθε σύνδεσμο-εικονίδιο (π.χ. aria-label="Facebook").',
      run: function (S) {
        var bad = S.home.links.filter(function (l) { return !l.name && !l.hidden && l.href && l.href.charAt(0) !== '#'; });
        if (!bad.length) return { s: 1, ev: ['Όλοι οι σύνδεσμοι έχουν όνομα.'] };
        return { s: bad.length <= 2 ? 0.6 : 0.3, ev: [bad.length + ' ' + plural(bad.length, 'σύνδεσμος', 'σύνδεσμοι') + ' χωρίς κείμενο ή περιγραφή (π.χ. ' + short(bad[0].href, 45) + ').'] };
      }
    },
    {
      id: 'multilang', cat: 'find', w: 2, name: 'Πολλές γλώσσες',
      why: 'Αν οι μεταφράσεις φορτώνονται με JavaScript στην ίδια διεύθυνση, η Google συνήθως δεν τις ευρετηριάζει.',
      fix: 'Δώσε στην κάθε γλώσσα δική της διεύθυνση (/en/, /es/) και πρόσθεσε ετικέτες hreflang.',
      run: function (S) {
        var sw = S.home.langSwitch; if (sw.length < 2 && !S.home.hreflang) return null;
        if (S.home.hreflang) return { s: 1, ev: ['Υπάρχουν ετικέτες hreflang (' + S.home.hreflang + ').'] };
        return { s: 0.4, ev: ['Υπάρχει εναλλαγή γλώσσας (' + sw.slice(0, 3).join(', ') + ') αλλά όχι hreflang.'] };
      }
    },
    {
      id: 'pages', cat: 'find', w: 3, name: 'Συνέπεια ανάμεσα στις σελίδες',
      why: 'Κάθε σελίδα χρειάζεται δικό της τίτλο, περιγραφή και H1. Γενικοί τίτλοι όπως «Υπηρεσίες» δεν βοηθούν.',
      fix: 'Δώσε σε κάθε σελίδα μοναδικό τίτλο με λέξεις-κλειδιά και μοναδική περιγραφή.',
      run: function (S) {
        var pgs = S.pages.slice(1); if (!pgs.length) return null;
        var issues = [], total = 0;
        var seen = {};
        S.pages.forEach(function (p) { var k = norm(p.title); if (k) seen[k] = (seen[k] || 0) + 1; });
        pgs.forEach(function (p) {
          var path = (function () { try { return new URL(p.url).pathname || '/'; } catch (e) { return p.url; } })();
          var pi = [];
          total += 3;
          if (!p.title || len(p.title) < 15 || p.title.split(/\s+/).length < 2) pi.push('τίτλος «' + short(p.title || '—', 30) + '»');
          if (!p.desc) pi.push('χωρίς περιγραφή');
          if (!p.h1.length && !/contact|επικοινων/i.test(path)) pi.push('χωρίς H1');
          if (seen[norm(p.title)] > 1) pi.push('διπλός τίτλος');
          if (pi.length) issues.push(path + ': ' + pi.join(', '));
          S.pageIssues = (S.pageIssues || 0) + pi.length;
        });
        var count = S.pageIssues || 0;
        var s = clamp(1 - count / total, 0, 1);
        return { s: s, ev: issues.length ? issues.slice(0, 5) : ['Οι ' + pgs.length + ' άλλες σελίδες έχουν τίτλο, περιγραφή και H1.'] };
      }
    },

    // --- Επικοινωνία και ενέργεια ---
    {
      id: 'cta', cat: 'convert', w: 4, name: 'Κουμπί ενέργειας (CTA)',
      why: 'Ο επισκέπτης πρέπει να βλέπει καθαρά τι να κάνει μετά: να καλέσει, να κλείσει, να εγγραφεί.',
      fix: 'Βάλε ένα ευδιάκριτο κουμπί (π.χ. «Ζήτα προσφορά») ψηλά στην αρχική και επανάλαβέ το στο τέλος.',
      run: function (S) {
        var h = S.home;
        var btns = h.links.filter(function (l) { return (l.btn || false) && CTA_RE.test(l.name); });
        var words = h.links.filter(function (l) { return CTA_RE.test(l.name) && !l.hidden; });
        var bt = h.buttons.filter(function (b) { return CTA_RE.test(b); });
        if (btns.length || bt.length) return { s: 1, ev: ['Βρέθηκε κουμπί ενέργειας: «' + short((btns[0] && btns[0].name) || bt[0], 40) + '».'] };
        if (words.length) return { s: 0.6, ev: ['Υπάρχουν σύνδεσμοι ενέργειας (π.χ. «' + short(words[0].name, 40) + '») αλλά όχι ως κουμπί που ξεχωρίζει.'] };
        return { s: 0.2, ev: ['Δεν βρέθηκε καθαρή πρόσκληση για ενέργεια.'] };
      }
    },
    {
      id: 'click', cat: 'convert', w: 2, name: 'Κλήση/email με ένα άγγιγμα',
      why: 'Στο κινητό, ένας σύνδεσμος tel: ή mailto: επιτρέπει επικοινωνία με ένα πάτημα.',
      fix: 'Κάνε το τηλέφωνο σύνδεσμο (<a href="tel:+30…">) και το email σύνδεσμο mailto:.',
      run: function (S) {
        var u = S.union; if (!u.phones.length && !u.emails.length) return null;
        var ok = u.telLinks + u.mailLinks;
        if (ok) return { s: 1, ev: ['Υπάρχουν κλικαρίσιμοι σύνδεσμοι (' + u.telLinks + ' τηλ., ' + u.mailLinks + ' email).'] };
        return { s: 0.3, ev: ['Το τηλέφωνο/email φαίνεται ως απλό κείμενο, χωρίς σύνδεσμο.'] };
      }
    },
    {
      id: 'form', cat: 'convert', w: 4, name: 'Φόρμα επικοινωνίας',
      why: 'Μια σωστή φόρμα έχει ετικέτες στα πεδία και ενημέρωση/συναίνεση για τα δεδομένα.',
      fix: 'Πρόσθεσε ετικέτες στα πεδία και ένα «Αποδέχομαι την Πολιτική Απορρήτου» με σύνδεσμο.',
      run: function (S) {
        var fs = S.union.forms.filter(function (f) { return f.inputs > 0; });
        if (!fs.length) return null;
        var sc = 0, ev = [];
        fs.forEach(function (f) {
          var lab = f.inputs ? f.labeled / f.inputs : 1;
          var cons = (f.checkbox || f.privacy) ? 1 : 0;
          sc += 0.5 * lab + 0.5 * cons;
        });
        var s = sc / fs.length;
        var nc = fs.filter(function (f) { return !(f.checkbox || f.privacy); }).length;
        if (nc) ev.push(nc + ' από ' + fs.length + ' φόρμες χωρίς συναίνεση ή σύνδεσμο απορρήτου.');
        var nl = fs.filter(function (f) { return f.inputs && f.labeled < f.inputs; }).length;
        if (nl) ev.push(nl + ' φόρμες με πεδία χωρίς ετικέτα.');
        if (!ev.length) ev.push('Οι φόρμες έχουν ετικέτες και συναίνεση.');
        return { s: s, ev: ev };
      }
    },
    {
      id: 'pricing', cat: 'convert', w: 2, name: 'Τιμές ή «από Χ€»',
      why: 'Όταν φαίνεται έστω μια ένδειξη τιμής, ο επισκέπτης νιώθει ασφάλεια και ζητά προσφορά πιο εύκολα.',
      fix: 'Δείξε τιμές ή τουλάχιστον «από Χ€» και τι περιλαμβάνει κάθε πακέτο.',
      run: function (S) {
        var t = S.union.text;
        return /(€\s?\d|\d\s?€|\bEUR\b\s?\d|από\s+\d+\s?€|\$\s?\d)/i.test(t)
          ? { s: 1, ev: ['Εντοπίστηκε ένδειξη τιμής.'] }
          : { s: 0.3, ev: ['Δεν φαίνεται τιμή ούτε «από Χ€».'] };
      }
    },

    // --- Τεχνικά ---
    {
      id: 'viewport', cat: 'tech', w: 3, name: 'Προσαρμογή σε κινητό',
      why: 'Χωρίς ετικέτα viewport η σελίδα εμφανίζεται μικροσκοπική στο κινητό.',
      fix: 'Πρόσθεσε <meta name="viewport" content="width=device-width, initial-scale=1">.',
      run: function (S) {
        var v = S.home.viewport;
        return v && /width=device-width/i.test(v) ? { s: 1, ev: ['Υπάρχει ετικέτα viewport.'] } : { s: 0, ev: ['Λείπει η σωστή ετικέτα viewport.'] };
      }
    },
    {
      id: 'https', cat: 'tech', w: 3, name: 'Ασφαλής σύνδεση (HTTPS)',
      why: 'Οι browsers βάζουν προειδοποίηση «μη ασφαλές» σε σελίδες χωρίς HTTPS.',
      fix: 'Ενεργοποίησε πιστοποιητικό SSL και ανακατεύθυνε το http σε https.',
      run: function (S) {
        var u = S.home.url; if (!/^https?:/i.test(u)) return null;
        return /^https:/i.test(u) ? { s: 1, ev: ['Η σελίδα φορτώνει με HTTPS.'] } : { s: 0, ev: ['Η σελίδα φορτώνει με http, όχι https.'] };
      }
    },
    {
      id: 'placeholders', cat: 'tech', w: 4, name: 'Χωρίς σπασμένο κείμενο',
      why: 'Κείμενα όπως «[[cookie_link]]» ή «{title}» δείχνουν ότι κάτι δεν λειτουργεί και χαλούν την εντύπωση.',
      fix: 'Βρες το κείμενο στη σελίδα και αντικατάστησέ το με τον σωστό σύνδεσμο ή περιεχόμενο.',
      run: function (S) {
        var p = S.union.placeholders;
        return p.length ? { s: 0, ev: ['Εντοπίστηκε ημιτελές κείμενο: ' + p.slice(0, 3).map(function (x) { return '«' + short(x, 30) + '»'; }).join(', ') + '.'] } : { s: 1, ev: ['Δεν εντοπίστηκε σπασμένο κείμενο ή placeholder.'] };
      }
    },
    {
      id: 'perf', cat: 'tech', w: 3, name: 'Βάρος σελίδας',
      why: 'Βαριές σελίδες (πολλά scripts, βίντεο που παίζει μόνο του) καθυστερούν, ειδικά σε κινητό.',
      fix: 'Μείωσε scripts και εικόνες, αφαίρεσε το βίντεο υποβάθρου ή φόρτωσέ το μόνο όπου χρειάζεται.',
      run: function (S) {
        var h = S.home, s = 1, ev = [];
        var kb = Math.round((h.size || 0) / 1024);
        if (kb > 1500) { s -= 0.4; ev.push('Το HTML είναι ' + kb + ' KB.'); }
        else if (kb > 500) { s -= 0.15; ev.push('Το HTML είναι ' + kb + ' KB.'); }
        if (h.scripts > 25) { s -= 0.3; ev.push(h.scripts + ' εξωτερικά scripts.'); }
        if (h.styles > 10) { s -= 0.1; ev.push(h.styles + ' αρχεία CSS.'); }
        if (h.autoplayVideo) { s -= 0.2; ev.push('Βίντεο που ξεκινά αυτόματα (autoplay).'); }
        if (!ev.length) ev.push('Δεν εντοπίστηκαν προφανείς ενδείξεις βάρους (η ταχύτητα δεν μετρήθηκε).');
        return { s: clamp(s, 0, 1), ev: ev };
      }
    },
    {
      id: 'response', cat: 'tech', w: 2, name: 'Απόκριση server',
      why: 'Ένας αργός server χάνει επισκέπτες και βαθμολογείται χαμηλότερα.',
      fix: 'Έλεγξε hosting, caching και μέγεθος εικόνων αν ο χρόνος ξεπερνά τα 2 δευτερόλεπτα.',
      run: function (S) {
        var ms = S.home.ms; if (typeof ms !== 'number') return null;
        var st = S.home.status;
        if (st && st >= 400) return { s: 0.1, ev: ['Ο server απάντησε με κωδικό ' + st + '.'] };
        return { s: ms < 1000 ? 1 : ms < 2500 ? 0.7 : 0.4, ev: ['Η αρχική απάντησε σε ' + ms + ' ms.'] };
      }
    }
  ];

  // ---------- συγκέντρωση σελίδων ----------
  function buildSite(pages, ctx) {
    ctx = ctx || {};
    var home = pages[0];
    var union = { pText: '', heads: '', phones: [], emails: [], hasAddress: false, telLinks: 0, mailLinks: 0, social: [], socialBroken: [], privacyLinks: [], termsLinks: [], forms: [], placeholders: [], copyYears: [], text: '', covid: false, lastDate: null, ratingSchema: false, reviewWidget: false };
    pages.forEach(function (p) {
      union.phones = union.phones.concat(p.phones); union.emails = union.emails.concat(p.emails);
      union.hasAddress = union.hasAddress || p.hasAddress; union.telLinks += p.telLinks; union.mailLinks += p.mailLinks;
      union.social = union.social.concat(p.social); union.socialBroken = union.socialBroken.concat(p.socialBroken);
      union.privacyLinks = union.privacyLinks.concat(p.privacyLinks); union.termsLinks = union.termsLinks.concat(p.termsLinks);
      union.forms = union.forms.concat(p.forms); union.placeholders = union.placeholders.concat(p.placeholders);
      union.copyYears = union.copyYears.concat(p.copyYears); union.text += ' ' + p.text; union.pText += ' ' + (p.pText || '');
      union.heads += ' ' + p.h1.join(' ') + ' ' + p.h2.join(' ') + ' ' + p.links.map(function (l) { return l.name; }).join(' ');
      if (COVID_RE.test(p.text)) union.covid = true;
      if (p.lastDate && (!union.lastDate || p.lastDate > union.lastDate)) union.lastDate = p.lastDate;
      if (p.ratingSchema) union.ratingSchema = true;
      if (p.links.some(function (l) { return /trustpilot|elfsight|google\.com\/maps|search\.google\.com\/local|tripadvisor|yelp/i.test(l.href); })) union.reviewWidget = true;
    });
    union.covidHits = pages.filter(function (p) { return p.covidHit; }).map(function (p) { return { path: pathOf(p.url), snippet: p.covidHit }; });
    union.staleHits = pages.filter(function (p) { return p.staleHit; }).map(function (p) { return { path: pathOf(p.url), snippet: p.staleHit }; });
    if (union.covidHits.length || union.staleHits.length) union.covid = true;
    var nowT = ctx.now || Date.now(), news = null;
    pages.forEach(function (p) {
      if (!p.isNews) return;
      var all = p.textDates.concat(p.lastDate ? [p.lastDate] : []).filter(function (t) { return t <= nowT + 86400000; });
      if (!all.length) return;
      var mx = Math.max.apply(null, all);
      if (!news || mx > news.latest) news = { path: pathOf(p.url), latest: mx, count: all.length };
    });
    union.news = news;
    union.phones = uniq(union.phones); union.emails = uniq(union.emails);
    var host = hostOf(home.url || ctx.url || '');
    return { home: home, pages: pages, union: union, host: host, brand: deriveBrand(home, home.url || ctx.url), now: ctx.now || Date.now(), ctx: ctx };
  }


  // ---------- τι κινδυνεύεις (σύντομες εξηγήσεις, με επιφύλαξη) ----------
  var CONSEQ = {
    title: 'Στη Google και στα social η σελίδα εμφανίζεται με τίτλο που δεν λέει τι προσφέρεις, οπότε ενδεχομένως χάνεις κλικ.',
    desc: 'Χωρίς περιγραφή, η Google διαλέγει η ίδια ένα τυχαίο απόσπασμα για να δείξει κάτω από τον τίτλο.',
    h1: 'Ο επισκέπτης και η Google δεν βλέπουν καθαρά ποιο είναι το κύριο θέμα της σελίδας.',
    headings: 'Το κείμενο χωρίς υπότιτλους διαβάζεται δύσκολα και δείχνει λιγότερο οργανωμένο.',
    content: 'Με τόσο λίγο κείμενο, ο επισκέπτης δεν βρίσκει απαντήσεις και η Google δεν έχει τι να δείξει.',
    lang: 'Οι browsers και τα εργαλεία προσβασιμότητας ενδεχομένως δεν καταλαβαίνουν σε ποια γλώσσα είναι η σελίδα.',
    contact: 'Αν δεν φαίνεται εύκολα πώς επικοινωνείς, οι υποψήφιοι πελάτες ενδεχομένως φεύγουν χωρίς να ρωτήσουν.',
    emaildomain: 'Ένα δωρεάν email (gmail, mail.com) δίνει την εντύπωση μικρότερης εταιρείας και πέφτει πιο εύκολα σε spam.',
    privacy: 'Αν η σελίδα συλλέγει στοιχεία (φόρμα, cookies) χωρίς ενημέρωση, μπορεί να μην πληροί τις απαιτήσεις του GDPR· έλεγξέ το με νομικό.',
    proof: 'Οι νέοι πελάτες εμπιστεύονται περισσότερο κριτικές και παραδείγματα δουλειάς από τους ισχυρισμούς της ίδιας της εταιρείας.',
    social: 'Ένας σπασμένος σύνδεσμος στα social δείχνει ότι κάτι δεν συντηρείται.',
    legal: 'Χωρίς ΑΦΜ ή ΓΕΜΗ, ενδεχομένως δυσκολεύεται κάποιος να επιβεβαιώσει ότι η επιχείρηση είναι καταχωρημένη.',
    fresh: 'Ένα παλιό copyright ή μια ειδοποίηση του παρελθόντος μπορεί να κάνει τον επισκέπτη να νομίσει ότι η επιχείρηση δεν λειτουργεί πια.',
    news: 'Νέα που σταμάτησαν πριν χρόνια δίνουν την εντύπωση εγκατάλειψης.',
    canonical: 'Η Google ενδεχομένως μετρά την ίδια σελίδα με περισσότερες από μία διευθύνσεις.',
    og: 'Όταν κάποιος μοιράζεται τον σύνδεσμο σε Facebook ή LinkedIn, η προεπισκόπηση βγαίνει χωρίς σωστή εικόνα ή κείμενο.',
    schema: 'Η Google και τα εργαλεία AI ενδεχομένως δεν καταλαβαίνουν ξεκάθαρα ποια επιχείρηση είναι, πού βρίσκεται και πώς επικοινωνείς.',
    alt: 'Οι εικόνες δεν περιγράφονται για τους τυφλούς χρήστες και για τη Google.',
    noindex: 'Η σελίδα ενδεχομένως δεν εμφανίζεται καθόλου στη Google.',
    sitemap: 'Η Google μπορεί να δυσκολεύεται να βρει όλες τις σελίδες.',
    linknames: 'Οι αναγνώστες οθόνης δεν καταλαβαίνουν πού πηγαίνουν αυτοί οι σύνδεσμοι.',
    multilang: 'Οι μεταφράσεις που φορτώνουν με JavaScript ενδεχομένως δεν εμφανίζονται στη Google.',
    pages: 'Σελίδες με γενικούς τίτλους δεν βοηθούν να βρεθούν για συγκεκριμένες αναζητήσεις.',
    cta: 'Χωρίς ξεκάθαρο κουμπί, ο επισκέπτης δεν ξέρει ποιο είναι το επόμενο βήμα.',
    click: 'Στο κινητό, ο επισκέπτης πρέπει να αντιγράψει χειροκίνητα το τηλέφωνο ή το email.',
    form: 'Μια φόρμα χωρίς ενημέρωση για τα δεδομένα ενδεχομένως δεν πληροί το GDPR.',
    pricing: 'Όταν δεν φαίνεται καμία τιμή, πολλοί υποψήφιοι πελάτες ενδεχομένως δεν ρωτούν καθόλου.',
    viewport: 'Στο κινητό η σελίδα εμφανίζεται μικροσκοπική.',
    https: 'Οι browsers δείχνουν προειδοποίηση «μη ασφαλές» στους επισκέπτες.',
    placeholders: 'Το σπασμένο κείμενο δείχνει ότι κάτι δεν λειτουργεί και χαλά την εντύπωση.',
    perf: 'Οι βαριές σελίδες ενδεχομένως φορτώνουν αργά, ειδικά σε κινητό.',
    response: 'Ένας αργός server χάνει επισκέπτες.',
    cliches: 'Οι γενικές φράσεις υπάρχουν σε χιλιάδες sites και δεν ξεχωρίζουν την εταιρεία.',
    voice: 'Ο επισκέπτης ψάχνει τι κερδίζει ο ίδιος, όχι τι πιστεύει η εταιρεία για τον εαυτό της.',
    sentences: 'Οι πολύ μεγάλες προτάσεις κουράζουν και ο επισκέπτης σταματά να διαβάζει.',
    specifics: 'Χωρίς αριθμούς και παραδείγματα, οι ισχυρισμοί δεν είναι πιστευτοί.',
    repeat: 'Οι διπλές λέξεις και οι επαναλήψεις δείχνουν αυτόματη μετάφραση ή προχειρότητα.'
  };
  var TRIVIAL_STORY = { noindex: 1, https: 1, viewport: 1, perf: 1, response: 1, headings: 1, lang: 1, canonical: 1, repeat: 1, placeholders: 1, sentences: 1 };
  var SERVICE_PATH = /(service|υπηρεσ|προϊόν|προιον|product|menu|course|μαθημ|pricing|τιμ|nylc|certif|εξετασ|packages?|πακετ)/i;
  function pageReview(d, home, now) {
    var notes = [], path = pathOf(d.url), isContact = /contact|επικοινων/i.test(path + ' ' + d.title);
    var title = clean(d.title);
    if (d.words < 120 && !isContact && !d.isNews) notes.push('Μόνο ' + d.words + ' λέξεις' + (d.words < 60 ? ': πολύ λίγες για να εξηγήσουν την υπηρεσία.' : ': λίγες για να απαντήσουν στις ερωτήσεις ενός υποψήφιου πελάτη.'));
    if (SERVICE_PATH.test(path + ' ' + title) && !home) {
      var miss = [];
      if (!d.hasPrice) miss.push('τιμές ή «από Χ€»');
      if (!d.ctaAny && !d.forms.length) miss.push('κουμπί ή φόρμα για το επόμενο βήμα');
      if (miss.length) notes.push('Δεν φαίνονται: ' + miss.join(' και ') + '. Ένας υποψήφιος πελάτης συνήθως ψάχνει πρώτα πόσο κοστίζει και πώς θα προχωρήσει.');
    }
    if (!title || len(title) < 15 || title.split(/\s+/).length < 2) notes.push('Ο τίτλος («' + short(title || '—', 30) + '») δεν περιγράφει τη σελίδα.');
    if (!d.desc) notes.push('Δεν έχει περιγραφή για τη Google.');
    if (!d.h1.length && !isContact) notes.push('Δεν έχει κύριο τίτλο (H1).');
    if (d.covidHit) notes.push('Περιέχει αναφορά στην πανδημία: «' + d.covidHit + '»');
    else if (d.staleHit) notes.push('Περιέχει ειδοποίηση χωρίς ημερομηνία λήξης: «' + d.staleHit + '»');
    if (d.isNews) {
      var all = d.textDates.concat(d.lastDate ? [d.lastDate] : []);
      if (all.length) { var mx = Math.max.apply(null, all); notes.push('Η τελευταία ανάρτηση είναι του ' + fmtMonth(mx) + ' (' + ageText(now, mx) + ').'); }
    }
    return notes;
  }
  function trimDot(x) { return clean(x).replace(/[.\s]+$/, ''); }
  function buildStory(name, score, band, positives, negatives, quick, potential, pageNotes) {
    var paras = [];
    var strong = positives.filter(function (i) { return !TRIVIAL_STORY[i.id]; }).slice(0, 2);
    var p1 = 'Το ' + name + ' βαθμολογείται με ' + score + '/100 (' + band.label.toLowerCase() + '). ';
    if (strong.length) p1 += 'Αυτό που λειτουργεί καλά: ' + strong.map(function (i) { return i.name.toLowerCase().replace(/google/g, 'Google') + (i.evidence[0] ? ' (' + trimDot(i.evidence[0]) + ')' : ''); }).join(' και ') + '.';
    else p1 += 'Στους ελέγχους που έγιναν δεν ξεχωρίζει ακόμα κάποιο ισχυρό σημείο.';
    paras.push(p1);
    if (negatives.length) {
      var n0 = negatives[0], p2 = 'Το μεγαλύτερο κενό είναι: ' + n0.name.toLowerCase().replace(/google/g, 'Google') + '. ' + trimDot(n0.evidence[0] || '') + '. ' + (CONSEQ[n0.id] || '');
      var n1 = negatives[1]; if (n1) p2 += ' Ακολουθεί: ' + n1.name.toLowerCase().replace(/google/g, 'Google') + ' (' + trimDot(n1.evidence[0] || '') + ').';
      paras.push(p2);
      var hot = negatives.filter(function (i) { return (i.id === 'fresh' || i.id === 'news') && i.s < 0.5 && i !== n0 && i !== n1; })[0];
      if (hot) paras.push('Ξεχωρίζει και το εξής: ' + hot.evidence.map(trimDot).join('. ') + '. ' + (CONSEQ[hot.id] || ''));
      var q = quick.slice(0, 3).map(function (i, k) { return (k + 1) + ') ' + trimDot(i.fix); }).join('; ');
      paras.push('Οι πιο γρήγορες κινήσεις: ' + q + '. Αν γίνουν και οι πέντε πρώτες διορθώσεις, ο βαθμός μπορεί να ανέβει περίπου στο ' + potential + '.');
    }
    if (pageNotes && pageNotes.length > 1) {
      var thin = pageNotes.filter(function (x) { return x.notes.some(function (n) { return /^Μόνο \d+ λέξεις/.test(n); }); }).length;
      var nodesc = pageNotes.filter(function (x) { return x.notes.some(function (n) { return /περιγραφή για τη Google/.test(n); }); }).length;
      var bits = [];
      if (thin) bits.push(thin + ' έχουν πολύ λίγο κείμενο');
      if (nodesc) bits.push(nodesc + ' δεν έχουν περιγραφή για τη Google');
      if (bits.length) paras.push('Από τις ' + pageNotes.length + ' σελίδες που ελέγχθηκαν, ' + bits.join(' και ') + '.');
    }
    return paras.map(function (x) { return x.replace(/\(h1\)/gi, '(H1)'); });
  }

  function statusOf(s) { return s >= PASS ? 'pass' : s >= WARN ? 'warn' : 'fail'; }

  function analyzeSite(pageDocs, ctx) {
    // pageDocs: [{ doc, url, status, ms, size, headers, html }]
    ctx = ctx || {};
    var pages = pageDocs.map(function (p, i) { return extract(p.doc, { url: p.url, status: p.status, ms: p.ms, size: p.size, headers: p.headers, html: p.html, now: ctx.now || Date.now(), home: i === 0 }); });
    var S = buildSite(pages, ctx);
    var home = pages[0];
    var items = [], skipped = [], totalW = 0;
    CHECKS.forEach(function (c) {
      var r = c.run(S);
      if (!r) { skipped.push({ id: c.id, name: c.name, cat: c.cat }); return; }
      var s = clamp(r.s, 0, 1);
      items.push({ id: c.id, cat: c.cat, name: c.name, status: statusOf(s), s: s, w: c.w, evidence: r.ev || [], why: c.why, fix: c.fix });
      totalW += c.w;
    });
    var num = items.reduce(function (a, i) { return a + i.w * i.s; }, 0);
    var score = totalW ? Math.round(num / totalW * 100) : 0;
    items.forEach(function (i) { i.gain = Math.round((i.w * (1 - i.s) / totalW * 100) * 10) / 10; i.impact = i.w >= 4 ? 'high' : i.w >= 3 ? 'mid' : 'low'; i.conseq = i.status === 'pass' ? '' : (CONSEQ[i.id] || ''); });
    var cats = CATS.map(function (c) {
      var its = items.filter(function (i) { return i.cat === c.id; });
      var w = its.reduce(function (a, i) { return a + i.w; }, 0);
      var v = its.reduce(function (a, i) { return a + i.w * i.s; }, 0);
      return { id: c.id, name: c.name, score: w ? Math.round(v / w * 100) : null, n: its.length };
    }).filter(function (c) { return c.n > 0; });
    var positives = items.filter(function (i) { return i.status === 'pass'; }).sort(function (a, b) { return b.w - a.w; });
    var negatives = items.filter(function (i) { return i.status !== 'pass'; }).sort(function (a, b) { return b.gain - a.gain; });
    var quick = negatives.slice(0, 5);
    var potential = Math.min(100, Math.round(score + quick.reduce(function (a, i) { return a + i.gain; }, 0)));
    var band = score >= 80 ? { id: 'good', label: 'Πολύ καλή βάση' } : score >= 60 ? { id: 'ok', label: 'Καλή βάση με κενά' } : score >= 40 ? { id: 'mid', label: 'Χρειάζεται δουλειά' } : { id: 'low', label: 'Σοβαρά κενά' };

    var report = {
      meta: { url: home.url, host: S.host, title: home.title, brand: S.brand, analyzedAt: new Date(S.now).toISOString(), pages: pages.length, mode: ctx.mode || 'paste', hints: { title: home.title, h1: home.h1[0] || '', h2: home.h2.slice(0, 3).join(' '), desc: home.desc || '', brand: S.brand, text: (home.title + ' ' + (home.desc || '') + ' ' + home.h1.join(' ') + ' ' + S.union.text).slice(0, 4000), locality: localityOf(home) } },
      score: score, band: band, cats: cats, positives: positives, negatives: negatives, quickWins: quick, potential: potential, skipped: skipped,
      pages: pages.map(function (p, i) { return { url: p.url, title: p.title, titleLen: len(p.title), descLen: len(p.desc || ''), words: p.words, h1: p.h1.length, status: p.status, notes: pageReview(p, i === 0, S.now) }; }),
      fixes: buildFixes(S, items),
      summary: makeSummary(score, positives, negatives, potential),
      story: null,
      gbp: null
    };
    report.story = buildStory(S.brand, score, band, positives, negatives, quick, potential, report.pages.map(function (x) { return { url: x.url, notes: x.notes }; }));
    return report;
  }

  function makeSummary(score, pos, neg, potential) {
    var TRIVIAL = { noindex: 1, https: 1, viewport: 1, perf: 1, response: 1, headings: 1, lang: 1, canonical: 1, repeat: 1, placeholders: 1, sentences: 1 };
    var p = pos.filter(function (i) { return !TRIVIAL[i.id]; }).slice(0, 2).map(function (i) { return i.name.toLowerCase(); });
    var n = neg.slice(0, 2).map(function (i) { return i.name.toLowerCase(); });
    var t = '';
    p = p.map(function (x) { return x.replace(/google/g, 'Google'); }); n = n.map(function (x) { return x.replace(/google/g, 'Google'); });
    if (p.length) t += 'Δυνατά σημεία: ' + p.join(' και ') + '. ';
    if (n.length) t += 'Μεγαλύτερα κενά: ' + n.join(' και ') + '. ';
    if (neg.length) t += 'Με τις πέντε πρώτες διορθώσεις το σκορ μπορεί να φτάσει περίπου στο ' + potential + '.';
    return t.trim();
  }

  // ---------- έτοιμες διορθώσεις ----------
  function buildFixes(S, items) {
    var h = S.home, fixes = [], brand = S.brand, host = S.host;
    var byId = {}; items.forEach(function (i) { byId[i.id] = i; });
    var sugTitle;
    var h1 = h.h1[0];
    if (h1 && len(h1) <= 48 && norm(h1) !== norm(brand)) sugTitle = short(h1, 48) + ' | ' + brand;
    else sugTitle = '«Τι προσφέρεις» στην «πόλη σου» | ' + brand;
    var sugDesc = h.paras[0] ? short(h.paras[0], 155) : '«Ένα εύκολο όφελος για τον πελάτη σε 1–2 προτάσεις, με πρόσκληση: Ζήτα προσφορά / Κάλεσέ μας.»';

    if (byId.title && byId.title.status !== 'pass') fixes.push({ id: 'title', title: 'Πρόταση τίτλου σελίδας', lang: 'html', note: 'Προσάρμοσέ τον ώστε να λέει τι προσφέρεις και πού.', code: '<title>' + sugTitle + '</title>' });
    if (byId.desc && byId.desc.status !== 'pass') fixes.push({ id: 'desc', title: 'Πρόταση meta description', lang: 'html', note: 'Έγινε από το πρώτο ουσιαστικό κείμενο της σελίδας. Βελτίωσέ την με το κύριο όφελος.', code: '<meta name="description" content="' + sugDesc.replace(/"/g, '&quot;') + '">' });
    if (byId.og && byId.og.status !== 'pass') {
      fixes.push({
        id: 'og', title: 'Ετικέτες προεπισκόπησης (Open Graph)', lang: 'html', note: 'Η εικόνα να είναι JPG/PNG 1200×630 στο δικό σου domain.',
        code: ['<meta property="og:type" content="website">', '<meta property="og:site_name" content="' + brand + '">', '<meta property="og:title" content="' + (h.title || sugTitle).replace(/"/g, '&quot;') + '">', '<meta property="og:description" content="' + (h.desc || sugDesc).replace(/"/g, '&quot;') + '">', '<meta property="og:image" content="https://' + (host || 'το-domain-σου.gr') + '/og-image.jpg">', '<meta property="og:url" content="' + (h.url || 'https://' + (host || 'το-domain-σου.gr') + '/') + '">', '<meta name="twitter:card" content="summary_large_image">'].join('\n')
      });
    }
    if (byId.canonical && byId.canonical.status !== 'pass') fixes.push({ id: 'canonical', title: 'Canonical', lang: 'html', note: 'Βάλε την τελική διεύθυνση της κάθε σελίδας.', code: '<link rel="canonical" href="' + (h.url || 'https://' + (host || 'το-domain-σου.gr') + '/') + '">' });
    if (byId.schema && byId.schema.status !== 'pass') {
      var hasLocal = S.union.hasAddress && S.union.phones.length;
      var ldo = { '@context': 'https://schema.org', '@type': hasLocal ? 'LocalBusiness' : 'Organization', name: brand, url: h.url || ('https://' + host + '/'), description: h.desc || 'Σύντομη περιγραφή της επιχείρησης.' };
      if (S.union.phones[0]) ldo.telephone = S.union.phones[0];
      if (S.union.emails[0]) ldo.email = S.union.emails[0];
      ldo.address = { '@type': 'PostalAddress', streetAddress: '…', postalCode: '…', addressLocality: '…', addressCountry: 'GR' };
      var sa = uniq(S.union.social.map(function (x) { return x.href; })); if (sa.length) ldo.sameAs = sa;
      fixes.push({ id: 'schema', title: 'Δομημένα δεδομένα (JSON-LD)', lang: 'html', note: 'Συμπλήρωσε τα «…» με τα πραγματικά στοιχεία.', code: '<script type="application/ld+json">\n' + JSON.stringify(ldo, null, 2) + '\n</script>' });
    }
    if (byId.viewport && byId.viewport.status !== 'pass') fixes.push({ id: 'viewport', title: 'Ετικέτα viewport', lang: 'html', note: 'Μπαίνει μέσα στο <head>.', code: '<meta name="viewport" content="width=device-width, initial-scale=1">' });
    if (byId.lang && byId.lang.status !== 'pass') fixes.push({ id: 'lang', title: 'Γλώσσα σελίδας', lang: 'html', note: 'Στην ετικέτα <html>.', code: '<html lang="' + (h.greekRatio > 0.4 ? 'el' : 'en') + '">' });
    if (byId.sitemap && byId.sitemap.status !== 'pass') fixes.push({ id: 'robots', title: 'robots.txt', lang: 'text', note: 'Αποθήκευσέ το ως /robots.txt στη ρίζα του site.', code: 'User-agent: *\nAllow: /\n\nSitemap: https://' + (host || 'το-domain-σου.gr') + '/sitemap.xml' });
    return fixes;
  }

  // ---------- Google Business (από δεδομένα Places API) ----------
  function analyzeGbp(p) {
    if (!p) return null;
    var items = [];
    function add(id, name, s, w, ev, why, fix) { items.push({ id: id, cat: 'gbp', name: name, status: statusOf(s), s: s, w: w, evidence: ev, why: why, fix: fix }); }
    var r = typeof p.rating === 'number' ? p.rating : null, n = p.userRatingCount || 0;
    add('g_rating', 'Βαθμολογία στη Google', r === null ? 0 : r >= 4.5 ? 1 : r >= 4 ? 0.8 : r >= 3.5 ? 0.5 : 0.2, 4, [r === null ? 'Δεν υπάρχει βαθμολογία.' : 'Μέσος όρος ' + r.toFixed(1) + ' από 5.'], 'Η βαθμολογία επηρεάζει το αν θα σε επιλέξουν από τον χάρτη.', 'Απάντησε σε κάθε κριτική και ζήτα κριτική από ευχαριστημένους πελάτες.');
    add('g_reviews', 'Πλήθος κριτικών', n >= 100 ? 1 : n >= 30 ? 0.8 : n >= 10 ? 0.5 : n >= 1 ? 0.3 : 0, 5, [n + ' ' + plural(n, 'κριτική', 'κριτικές') + '.'], 'Οι περισσότερες κριτικές δίνουν εμπιστοσύνη και βοηθούν στη σειρά εμφάνισης.', 'Στόχος οι πρώτες 10–30 αληθινές κριτικές. Στείλε τον σύνδεσμο κριτικής μετά από κάθε υπηρεσία.');
    add('g_website', 'Ιστοσελίδα στο προφίλ', p.websiteUri ? 1 : 0, 3, [p.websiteUri ? 'Υπάρχει ιστοσελίδα: ' + p.websiteUri : 'Δεν υπάρχει ιστοσελίδα στο προφίλ.'], 'Ο σύνδεσμος στο site φέρνει επισκέπτες και επιβεβαιώνει την επιχείρηση.', 'Πρόσθεσε το site στο προφίλ Google Business.');
    add('g_phone', 'Τηλέφωνο στο προφίλ', p.nationalPhoneNumber ? 1 : 0, 3, [p.nationalPhoneNumber ? 'Τηλέφωνο: ' + p.nationalPhoneNumber : 'Δεν υπάρχει τηλέφωνο.'], 'Πολλοί πελάτες καλούν απευθείας από τον χάρτη.', 'Πρόσθεσε τηλέφωνο στο προφίλ.');
    add('g_hours', 'Ωράριο λειτουργίας', p.regularOpeningHours ? 1 : 0, 3, [p.regularOpeningHours ? 'Το ωράριο έχει οριστεί.' : 'Δεν έχει οριστεί ωράριο.'], 'Ένα λάθος ή ελλιπές ωράριο χάνει επισκέψεις.', 'Όρισε ωράριο και ειδικές ώρες για αργίες.');
    var ph = Array.isArray(p.photos) ? p.photos.length : (p.photoCount || 0);
    add('g_photos', 'Φωτογραφίες', ph >= 8 ? 1 : ph >= 4 ? 0.6 : ph >= 1 ? 0.3 : 0, 3, [ph + ' ' + plural(ph, 'φωτογραφία', 'φωτογραφίες') + (ph >= 10 ? '+' : '') + ' στο προφίλ.'], 'Τα προφίλ με φωτογραφίες παίρνουν περισσότερα κλικ και κλήσεις.', 'Ανέβασε φωτογραφίες χώρου, ομάδας, προϊόντων και του λογότυπου.');
    var cat = p.primaryTypeDisplayName && (p.primaryTypeDisplayName.text || p.primaryTypeDisplayName);
    add('g_category', 'Κύρια κατηγορία', cat ? 1 : 0.3, 3, [cat ? 'Κατηγορία: ' + cat : 'Δεν εντοπίστηκε κύρια κατηγορία.'], 'Η σωστή κατηγορία ορίζει σε ποιες αναζητήσεις θα εμφανιστείς.', 'Διάλεξε την πιο συγκεκριμένη κύρια κατηγορία και πρόσθεσε δευτερεύουσες.');
    if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') add('g_status', 'Κατάσταση επιχείρησης', 0, 4, ['Η επιχείρηση εμφανίζεται ως ' + p.businessStatus + '.'], 'Αν φαίνεται κλειστή, οι πελάτες δεν θα σε επιλέξουν.', 'Ενημέρωσε την κατάσταση στο προφίλ.');
    var tw = items.reduce(function (a, i) { return a + i.w; }, 0);
    var sc = Math.round(items.reduce(function (a, i) { return a + i.w * i.s; }, 0) / tw * 100);
    items.forEach(function (i) { i.gain = Math.round(i.w * (1 - i.s) / tw * 1000) / 10; i.impact = i.w >= 4 ? 'high' : 'mid'; });
    return {
      name: (p.displayName && (p.displayName.text || p.displayName)) || '', address: p.formattedAddress || '', mapsUri: p.googleMapsUri || '', score: sc,
      positives: items.filter(function (i) { return i.status === 'pass'; }),
      negatives: items.filter(function (i) { return i.status !== 'pass'; }).sort(function (a, b) { return b.gain - a.gain; }),
      note: 'Από το Places API της Google. Οι φωτογραφίες καταμετρούνται έως 10 και δεν φαίνονται προβολές, κλήσεις ή ερωτήματα αναζήτησης.'
    };
  }



  // ---------- αυτόματη εύρεση ανταγωνιστών ----------
  var OSM_CATS = [
    [/συμβουλ|consult/, ['office=consulting']],
    [/κατασκευη ιστοσελιδ|web design|web development|digital agency|διαφημιστικ/, ['office=it', 'office=advertising_agency']],
    [/αγγλικ|language school|φροντιστ|ξενων γλωσσων/, ['amenity=language_school', 'amenity=school']],
    [/εστιατορι|ταβερν|μεζεδ|restaurant|taverna/, ['amenity=restaurant']],
    [/καφε|cafe|coffee/, ['amenity=cafe']],
    [/ξενοδοχ|hotel|καταλυμ|δωματι|guest ?house|apartments/, ['tourism=hotel', 'tourism=guest_house', 'tourism=apartment']],
    [/οδοντιατρ|dentist|dental/, ['amenity=dentist']],
    [/δικηγορ|lawyer|law firm/, ['office=lawyer']],
    [/λογιστ|accountant|φοροτεχν/, ['office=accountant']],
    [/κομμωτηρ|hairdresser|barber/, ['shop=hairdresser']],
    [/γυμναστηρ|gym\b|fitness/, ['leisure=fitness_centre']],
    [/φαρμακει|pharmacy/, ['amenity=pharmacy']],
    [/κτηνιατρ|veterinar/, ['amenity=veterinary']],
    [/αρχιτεκτ|architect|μηχανικ/, ['office=architect', 'office=engineer']]
  ];
  function osmFilters(hints) {
    var t = normGr([hints && hints.title, hints && hints.h1, hints && hints.desc].join(' '));
    for (var i = 0; i < OSM_CATS.length; i++) { if (OSM_CATS[i][0].test(t)) return OSM_CATS[i][1]; }
    return [];
  }
  var STOP = new Set(('english espanol deutsch francais italiano και για στην στον στο στις στους των του της τους τον την από προς σας μας σου εσεις εμεις ειναι εχει εχουμε μπορει ολα ολες πιο πολυ οπως αυτο αυτη αυτα αυτες ενα μια μιας ενος στην στους ομως επισης καθε σχετικα υπηρεσιες επικοινωνια αρχικη the and for with your our you that this from are have').split(' ').map(function (w) { return normGr(w); }));
  function keywordQuery(text, brand, n) {
    var bt = normGr(brand).match(/\p{L}+/gu) || [], freq = {}, first = {};
    (String(text || '').match(/\p{L}{5,}/gu) || []).forEach(function (w) {
      var k = normGr(w); if (STOP.has(k) || bt.indexOf(k) >= 0) return;
      var st = k.slice(0, 6); freq[st] = (freq[st] || 0) + 1; if (!first[st]) first[st] = w;
    });
    return Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; }).slice(0, n || 4).map(function (k) { return first[k]; }).join(' ');
  }

  function softwareScore(hints) {
    hints = hints || {};
    var idt = normGr([hints.title, hints.h1, hints.h2, hints.desc].join(' ')), body = normGr((hints.text || '').slice(0, 3000));
    var a = (idt.match(/εφαρμογ|πλατφορμ|λογισμικ|software|saas|\bapp\b|συστημα\s+(?:κρατησ|διαχειρ|παραγγελ|τιμολογ|ραντεβ|πωλησ)|κρατησ\w*\s+online|online\s+κρατησ|εργαλειο\s+(?:για|διαχειρ)/g) || []).length;
    var b = (body.match(/εφαρμογ|πλατφορμ|λογισμικ|software|saas|συνδρομ|δωρεαν\s+δοκιμη|free\s+trial|\bdemo\b|εγγραφη|λογαριασμ|πακετα\s+(?:συνδρομ|τιμ)/g) || []).length;
    return { id: a, body: b };
  }
  function isSoftware(hints) { var x = softwareScore(hints); return (x.id >= 1 && x.id * 3 + x.body >= 5) || x.body >= 10; }
  function buildQuery(hints, brand, city) {
    hints = hints || {};
    function strip(x) {
      x = clean(x);
      if (brand) x = x.replace(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ');
      return clean(x.replace(/[|–—:]+/g, ' ').replace(/\s-\s/g, ' '));
    }
    if (isSoftware(hints)) {
      var idt = [hints.title, hints.h1, hints.h2, hints.desc].map(strip).join(' ') + ' ' + (hints.text || '').slice(0, 600);
      var kw = keywordQuery(idt, brand, 3);
      return clean((kw + ' λογισμικό εφαρμογή').trim());
    }
    var cand = [hints.h1, hints.title, hints.desc].map(strip).filter(function (x) { return len(x) >= 12; });
    var base = (cand[0] || '').split(/\s+/).slice(0, 8).join(' ');
    if (!base) base = keywordQuery((hints.text || '').slice(0, 1500), brand, 4);
    if (city && base && normGr(base).indexOf(normGr(city)) < 0) base += ' ' + city;
    return clean(base);
  }
  var BLOCK_HOSTS = [/(^|\.)(capterra|g2|softwareadvice|getapp|alternativeto|producthunt|sourceforge|trustradius|saashub|stackshare|crunchbase|github|gitlab)\.(com|net|co|io)$/i, /(^|\.)(facebook|fb|instagram|linkedin|youtube|youtu|tiktok|pinterest|wikipedia|wikimedia|tripadvisor|booking|airbnb|expedia|yelp|foursquare|trustpilot|glassdoor|indeed|reddit|quora|medium|amazon|ebay)\./i, /(^|\.)(x|twitter)\.com$/i, /(^|\.)google\./i, /(^|\.)(skroutz|vrisko|xo|11888|yellowpages|athinorama|efood|wolt|e-forologia|kariera|olx|bazaraki|spitogatos|xe|jooble)\.gr$/i, /(blogspot|wordpress|wixsite|weebly)\.com$/i, /(^|\.)(gov|edu)\.gr$/i, /(^|\.)europa\.eu$/i];
  var LISTICLE = /(top|best)\s*\d*|τα\s*\d+\s+καλυτερ|καλυτερα|οδηγοσ|κριτικεσ|reviews|\bvs\b|λιστα|συγκριση|τιμεσ/i;
  function filterCandidates(cands, excludeHost) {
    var ex = String(excludeHost || '').replace(/^www\./, ''), seen = {}, out = [];
    (cands || []).forEach(function (c) {
      var u; try { u = new URL(c.url); } catch (e) { return; }
      if (!/^https?:$/.test(u.protocol)) return;
      var h = u.hostname.replace(/^www\./, '');
      if (!h || h === ex || seen[h]) return;
      if (BLOCK_HOSTS.some(function (re) { return re.test(h); })) return;
      if (/\/(blog|news|article|articles|category|tag|forum|wiki|tags)\b/i.test(u.pathname) || LISTICLE.test(normGr(c.name || ''))) return;
      seen[h] = 1; out.push({ url: u.origin + '/', name: clean(c.name || h).slice(0, 80), source: c.source || '' });
    });
    return out;
  }

  // ---------- ανταγωνιστές ----------
  var CITIES = [[/αθηνα|athens|αγιου δημητριου|μαρουσι|περιστερι|πειραια|γλυφαδα|κηφισια/, 'Αθήνα'], [/θεσσαλονικ|thessaloniki/, 'Θεσσαλονίκη'], [/πατρα/, 'Πάτρα'], [/ηρακλει|κρητη|χανια|ρεθυμν/, 'Κρήτη'], [/ροδο|rhodes/, 'Ρόδος'], [/κερκυρα|corfu/, 'Κέρκυρα'], [/μυκον|σαντορινη|santorini|κυκλαδ/, 'Κυκλάδες'], [/λαρισα/, 'Λάρισα'], [/βολο/, 'Βόλος'], [/ιωαννινα/, 'Ιωάννινα']];
  function localityOf(h) {
    var ld = (h.ld || []).map(function (n) { return n && n.address && (n.address.addressLocality || ''); }).filter(Boolean)[0];
    return ld || '';
  }
  function guessCity(hints) {
    hints = hints || {};
    var t = normGr((hints.locality || '') + ' ' + (hints.text || ''));
    for (var i = 0; i < CITIES.length; i++) { if (CITIES[i][0].test(t)) return CITIES[i][1]; }
    return '';
  }
  function guessCategory(bench, hints) {
    hints = hints || {};
    if (isSoftware(hints)) return null;
    var idt = normGr([hints.title, hints.h1, hints.h2, hints.desc].join(' ')), body = normGr(hints.text || ''), best = null, bs = 0;
    bench.categories.forEach(function (c) {
      var re = new RegExp(c.re, 'g'), mi = idt.match(re), mb = body.match(re);
      var n = (mi ? mi.length : 0) * 3 + (mb ? mb.length : 0);
      if (c.id === 'consulting') n *= 3;
      if (n > bs) { bs = n; best = c.id; }
    });
    return bs >= 3 ? best : null;
  }
  function pickCompetitors(bench, cat, city, excludeHost, n, offset) {
    var ex = String(excludeHost || '').replace(/^www\./, '');
    var c = bench.sites.filter(function (x) { return x.cat === cat && hostOf(x.url) !== ex; });
    c = c.map(function (x, i) { return { x: x, i: i, pri: city && x.city === city ? 0 : 1 }; }).sort(function (a, b) { return a.pri - b.pri || a.i - b.i; }).map(function (o) { return o.x; });
    var off = c.length ? (offset || 0) % c.length : 0;
    c = c.slice(off).concat(c.slice(0, off));
    return c.slice(0, n || 2);
  }
  function compareMany(me, others) {
    function byId(rep) { var m = {}; rep.positives.concat(rep.negatives).forEach(function (i) { m[i.id] = i; }); return m; }
    var M = byId(me), O = others.map(byId), ids = {};
    [M].concat(O).forEach(function (m) { Object.keys(m).forEach(function (k) { ids[k] = 1; }); });
    var order = {}; CATS.forEach(function (c, i) { order[c.id] = i; });
    var rows = Object.keys(ids).map(function (id) {
      var ref = M[id] || O.map(function (o) { return o[id]; }).filter(Boolean)[0];
      return { id: id, name: ref.name, cat: ref.cat, w: ref.w, cells: [M[id]].concat(O.map(function (o) { return o[id]; })).map(function (c) { return c ? { status: c.status, s: c.s, ev: (c.evidence && c.evidence[0]) || '' } : null; }) };
    }).sort(function (x, y) { return (order[x.cat] - order[y.cat]) || (y.w - x.w); });
    var gaps = [], wins = [];
    rows.forEach(function (r) {
      var mine = r.cells[0]; if (!mine) return;
      var best = -1, bi = -1;
      r.cells.slice(1).forEach(function (c, i) { if (c && c.s > best) { best = c.s; bi = i; } });
      if (bi < 0) return;
      var d = best - mine.s;
      if (d >= 0.3) gaps.push({ row: r, rival: bi, diff: d }); else if (-d >= 0.3) wins.push({ row: r, rival: bi, diff: -d });
    });
    function key(g) { return g.row.w * g.diff; }
    gaps.sort(function (a, b) { return key(b) - key(a); }); wins.sort(function (a, b) { return key(b) - key(a); });
    return { rows: rows, gaps: gaps, wins: wins };
  }


  // ---------- κείμενο σύγκρισης ένα προς ένα ----------
  function narrate(me, rival, rivalName) {
    var diff = rival.score - me.score;
    var headline = diff > 0 ? rivalName + ' προηγείται κατά ' + diff + ' ' + plural(diff, 'πόντο', 'πόντους') + ' (' + rival.score + ' έναντι ' + me.score + ').'
      : diff < 0 ? 'Προηγείσαι κατά ' + (-diff) + ' ' + plural(-diff, 'πόντο', 'πόντους') + ' (' + me.score + ' έναντι ' + rival.score + ').' : 'Ισοβαθμείτε (' + me.score + ' και οι δύο).';
    var cr = me.cats.map(function (c) { var r = rival.cats.filter(function (x) { return x.id === c.id; })[0]; return r ? { name: c.name, me: c.score, rival: r.score, d: r.score - c.score } : null; }).filter(Boolean);
    var trailCats = cr.filter(function (x) { return x.d >= 10; }).sort(function (a, b) { return b.d - a.d; });
    var leadCats = cr.filter(function (x) { return x.d <= -10; }).sort(function (a, b) { return a.d - b.d; });
    var cmp = compareMany(me, [rival]);
    var fixOf = {}; me.negatives.forEach(function (i) { fixOf[i.id] = i.fix; });
    var gaps = cmp.gaps.slice(0, 5).map(function (g) { return { id: g.row.id, name: g.row.name, me: g.row.cells[0].ev, rival: g.row.cells[1].ev, fix: fixOf[g.row.id] || '' }; });
    var wins = cmp.wins.slice(0, 3).map(function (g) { return { id: g.row.id, name: g.row.name, me: g.row.cells[0].ev, rival: g.row.cells[1].ev }; });
    var verdict;
    var top = gaps.slice(0, 3).map(function (g) { return g.name.toLowerCase().replace(/google/g, 'Google'); });
    if (diff >= 10) verdict = rivalName + ' είναι πιο έτοιμος από σένα' + (top.length ? '. Οι πιο γρήγορες κινήσεις για να τον φτάσεις: ' + top.join(', ') + '.' : '.');
    else if (diff > -10) verdict = 'Είστε κοντά' + (top.length ? '. Η διαφορά κρίνεται κυρίως στα: ' + top.join(', ') + '.' : '.');
    else verdict = 'Είσαι μπροστά' + (top.length ? ', αλλά ο ανταγωνιστής έχει καλύτερο: ' + top.join(', ') + '.' : '.');
    return { name: rivalName, diff: diff, headline: headline, verdict: verdict, trailCats: trailCats, leadCats: leadCats, gaps: gaps, wins: wins };
  }
  function narrateAll(me, rivals, names) {
    var per = rivals.map(function (r, i) { return narrate(me, r, names[i]); });
    var count = {}, info = {};
    per.forEach(function (n) { n.gaps.forEach(function (g) { count[g.id] = (count[g.id] || 0) + 1; info[g.id] = info[g.id] || g; }); });
    var common = Object.keys(count).filter(function (k) { return count[k] === rivals.length; }).map(function (k) { return info[k]; });
    var winAll = {}, winInfo = {};
    per.forEach(function (n) { n.wins.forEach(function (g) { winAll[g.id] = (winAll[g.id] || 0) + 1; winInfo[g.id] = g; }); });
    var strong = Object.keys(winAll).filter(function (k) { return winAll[k] === rivals.length; }).map(function (k) { return winInfo[k]; });
    var text = [];
    var ahead = per.filter(function (n) { return n.diff > 0; }).length;
    if (!ahead) text.push('Είσαι μπροστά και από τους ' + rivals.length + ' ανταγωνιστές που συγκρίθηκαν.');
    else if (ahead === rivals.length) text.push((rivals.length > 1 ? 'Και οι ' + rivals.length + ' ανταγωνιστές' : 'Ο ανταγωνιστής') + ' έχουν υψηλότερο βαθμό από σένα.');
    else text.push('Ο ένας από τους ανταγωνιστές προηγείται και ο άλλος υστερεί σε σχέση με σένα.');
    return { per: per, common: common, strong: strong, text: text.join(' ') };
  }

  // ---------- σύγκριση ----------
  function compareReports(A, B) {
    var map = {};
    function put(rep, key) {
      rep.positives.concat(rep.negatives).forEach(function (i) { map[i.id] = map[i.id] || { id: i.id, name: i.name, cat: i.cat, w: i.w }; map[i.id][key] = { status: i.status, s: i.s, ev: i.evidence[0] || '' }; });
    }
    put(A, 'a'); put(B, 'b');
    var rows = Object.keys(map).map(function (k) {
      var r = map[k];
      var sa = r.a ? r.a.s : null, sb = r.b ? r.b.s : null;
      r.winner = (sa === null || sb === null) ? null : Math.abs(sa - sb) < 0.15 ? 'tie' : sa > sb ? 'a' : 'b';
      return r;
    });
    var order = {}; CATS.forEach(function (c, i) { order[c.id] = i; });
    rows.sort(function (x, y) { return (order[x.cat] - order[y.cat]) || (y.w - x.w); });
    var wa = rows.filter(function (r) { return r.winner === 'a'; }), wb = rows.filter(function (r) { return r.winner === 'b'; });
    var behindA = wb.slice().sort(function (x, y) { return y.w - x.w; });
    var aheadA = wa.slice().sort(function (x, y) { return y.w - x.w; });
    return { rows: rows, aWins: wa.length, bWins: wb.length, ties: rows.filter(function (r) { return r.winner === 'tie'; }).length, behindA: behindA, aheadA: aheadA };
  }


  // ---------- PageSpeed Insights (Google, δωρεάν) ----------
  function psiUrl(url, opts) {
    opts = opts || {};
    var p = ['url=' + encodeURIComponent(url), 'strategy=' + (opts.strategy || 'mobile'), 'locale=' + (opts.locale || 'el')];
    ['performance', 'accessibility', 'best-practices', 'seo'].forEach(function (c) { p.push('category=' + c); });
    if (opts.key) p.push('key=' + encodeURIComponent(opts.key));
    return 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?' + p.join('&');
  }
  var PSI_CATS = { performance: 'Απόδοση', accessibility: 'Προσβασιμότητα', 'best-practices': 'Καλές πρακτικές', seo: 'SEO' };
  function parsePagespeed(j) {
    var lr = j && j.lighthouseResult; if (!lr) return null;
    var cats = [];
    Object.keys(PSI_CATS).forEach(function (id) { var c = lr.categories && lr.categories[id]; if (c && typeof c.score === 'number') cats.push({ id: id, name: PSI_CATS[id], score: Math.round(c.score * 100) }); });
    var A = lr.audits || {};
    var defs = [['first-contentful-paint', 'Πρώτο περιεχόμενο (FCP)'], ['largest-contentful-paint', 'Κύριο περιεχόμενο (LCP)'], ['total-blocking-time', 'Χρόνος αναμονής (TBT)'], ['cumulative-layout-shift', 'Μετατόπιση σελίδας (CLS)'], ['speed-index', 'Speed Index']];
    var metrics = defs.map(function (d) { var a = A[d[0]]; return a ? { id: d[0], name: d[1], value: a.displayValue || '', status: a.score >= 0.9 ? 'pass' : a.score >= 0.5 ? 'warn' : 'fail' } : null; }).filter(Boolean);
    var opps = Object.keys(A).map(function (k) { return A[k]; }).filter(function (a) { return a && a.details && a.details.type === 'opportunity' && a.details.overallSavingsMs >= 150; })
      .sort(function (x, y) { return y.details.overallSavingsMs - x.details.overallSavingsMs; }).slice(0, 5)
      .map(function (a) { return { title: a.title, value: a.displayValue || (Math.round(a.details.overallSavingsMs) + ' ms'), ms: Math.round(a.details.overallSavingsMs) }; });
    var field = null, le = j.loadingExperience;
    if (le && le.metrics) {
      var f = le.metrics;
      var pick = function (k, name, unit, div) { return f[k] && typeof f[k].percentile === 'number' ? { name: name, value: (f[k].percentile / (div || 1)) + unit, category: f[k].category } : null; };
      field = [pick('LARGEST_CONTENTFUL_PAINT_MS', 'LCP', ' ms'), pick('INTERACTION_TO_NEXT_PAINT', 'INP', ' ms'), pick('CUMULATIVE_LAYOUT_SHIFT_SCORE', 'CLS', '', 100)].filter(Boolean);
      if (!field.length) field = null;
    }
    var perfCat = cats.filter(function (c) { return c.id === 'performance'; })[0];
    var perf = perfCat ? perfCat.score : null;
    return { performance: perf, band: perf === null ? null : perf >= 90 ? { id: 'good', label: 'Γρήγορο' } : perf >= 50 ? { id: 'mid', label: 'Μέτριο' } : { id: 'low', label: 'Αργό' }, cats: cats, metrics: metrics, opportunities: opps, field: field, finalUrl: lr.finalUrl || lr.requestedUrl || '' };
  }

  // ---------- είσοδος από browser (επικολλημένο HTML) ----------
  function analyzeHtml(html, opts) {
    opts = opts || {};
    var doc = new DOMParser().parseFromString(html, 'text/html');
    return analyzeSite([{ doc: doc, url: opts.url || '', html: html, size: html.length }], { mode: 'paste', now: opts.now });
  }

  return { __test: { datesIn: datesIn }, narrate: narrate, narrateAll: narrateAll, isSoftware: isSoftware, osmFilters: osmFilters, buildQuery: buildQuery, filterCandidates: filterCandidates, guessCategory: guessCategory, guessCity: guessCity, pickCompetitors: pickCompetitors, compareMany: compareMany, psiUrl: psiUrl, parsePagespeed: parsePagespeed, CATS: CATS, CHECKS: CHECKS, extract: extract, analyzeSite: analyzeSite, analyzeHtml: analyzeHtml, analyzeGbp: analyzeGbp, compareReports: compareReports, PASS: PASS, WARN: WARN };
});
