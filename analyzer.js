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
    var h1 = q('h1').map(function (e) { return clean(e.textContent); }).filter(Boolean);
    var h2 = q('h2').map(function (e) { return clean(e.textContent); }).filter(Boolean);

    // ορατό κείμενο
    var body = doc.body;
    var text = '';
    if (body) {
      var clone = body.cloneNode(true);
      Array.prototype.slice.call(clone.querySelectorAll('script,style,noscript,template,svg,iframe')).forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      text = clean(clone.textContent);
    }
    var words = text ? text.split(/\s+/).filter(function (w) { return len(w) > 1; }).length : 0;
    var greek = (text.match(/[\u0370-\u03FF\u1F00-\u1FFF]/g) || []).length;
    var latin = (text.match(/[A-Za-z]/g) || []).length;

    // παράγραφοι για πρόταση περιγραφής
    var paras = q('main p, article p, section p, p').map(function (p) { return clean(p.textContent); }).filter(function (t) { return len(t) >= 70 && len(t) <= 400; });

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
      h1: h1, h2: h2, text: text, words: words, greekRatio: greek + latin ? greek / (greek + latin) : 0,
      paras: paras, links: links, buttons: buttons, forms: forms, imgs: imgs,
      phones: uniq(phones), emails: uniq(emails), telLinks: telLinks, mailLinks: mailLinks, hasAddress: hasAddress,
      social: social, socialBroken: socialBroken, privacyLinks: privacyLinks, termsLinks: termsLinks,
      copyYears: copyYears, lastDate: lastDate, langSwitch: langSwitch, placeholders: uniq(placeholders),
      scripts: q('script[src]').length, styles: q('link[rel~="stylesheet"]').length,
      autoplayVideo: q('video[autoplay]').length > 0,
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
        if (S.union.covid) { any = true; s -= 0.4; ev.push('Εντοπίστηκε ακόμα αναφορά στην πανδημία (Covid).'); }
        if (S.union.lastDate) {
          any = true; var yrs = (S.now - S.union.lastDate) / 31557600000;
          if (yrs > 3) { s -= 0.3; ev.push('Η πιο πρόσφατη ημερομηνία στις σελίδες είναι πριν ' + Math.floor(yrs) + ' χρόνια.'); }
          else ev.push('Πρόσφατη ημερομηνία ενημέρωσης: ' + new Date(S.union.lastDate).toISOString().slice(0, 10) + '.');
        }
        if (!any) return null;
        return { s: clamp(s, 0, 1), ev: ev };
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
      id: 'placeholders', cat: 'tech', w: 4, name: 'Σπασμένο κείμενο ή placeholder',
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
    var union = { heads: '', phones: [], emails: [], hasAddress: false, telLinks: 0, mailLinks: 0, social: [], socialBroken: [], privacyLinks: [], termsLinks: [], forms: [], placeholders: [], copyYears: [], text: '', covid: false, lastDate: null, ratingSchema: false, reviewWidget: false };
    pages.forEach(function (p) {
      union.phones = union.phones.concat(p.phones); union.emails = union.emails.concat(p.emails);
      union.hasAddress = union.hasAddress || p.hasAddress; union.telLinks += p.telLinks; union.mailLinks += p.mailLinks;
      union.social = union.social.concat(p.social); union.socialBroken = union.socialBroken.concat(p.socialBroken);
      union.privacyLinks = union.privacyLinks.concat(p.privacyLinks); union.termsLinks = union.termsLinks.concat(p.termsLinks);
      union.forms = union.forms.concat(p.forms); union.placeholders = union.placeholders.concat(p.placeholders);
      union.copyYears = union.copyYears.concat(p.copyYears); union.text += ' ' + p.text;
      union.heads += ' ' + p.h1.join(' ') + ' ' + p.h2.join(' ') + ' ' + p.links.map(function (l) { return l.name; }).join(' ');
      if (COVID_RE.test(p.text)) union.covid = true;
      if (p.lastDate && (!union.lastDate || p.lastDate > union.lastDate)) union.lastDate = p.lastDate;
      if (p.ratingSchema) union.ratingSchema = true;
      if (p.links.some(function (l) { return /trustpilot|elfsight|google\.com\/maps|search\.google\.com\/local|tripadvisor|yelp/i.test(l.href); })) union.reviewWidget = true;
    });
    union.phones = uniq(union.phones); union.emails = uniq(union.emails);
    var host = hostOf(home.url || ctx.url || '');
    return { home: home, pages: pages, union: union, host: host, brand: deriveBrand(home, home.url || ctx.url), now: ctx.now || Date.now(), ctx: ctx };
  }

  function statusOf(s) { return s >= PASS ? 'pass' : s >= WARN ? 'warn' : 'fail'; }

  function analyzeSite(pageDocs, ctx) {
    // pageDocs: [{ doc, url, status, ms, size, headers, html }]
    ctx = ctx || {};
    var pages = pageDocs.map(function (p) { return extract(p.doc, { url: p.url, status: p.status, ms: p.ms, size: p.size, headers: p.headers, html: p.html }); });
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
    items.forEach(function (i) { i.gain = Math.round((i.w * (1 - i.s) / totalW * 100) * 10) / 10; i.impact = i.w >= 4 ? 'high' : i.w >= 3 ? 'mid' : 'low'; });
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
      meta: { url: home.url, host: S.host, title: home.title, brand: S.brand, analyzedAt: new Date(S.now).toISOString(), pages: pages.length, mode: ctx.mode || 'paste' },
      score: score, band: band, cats: cats, positives: positives, negatives: negatives, quickWins: quick, potential: potential, skipped: skipped,
      pages: pages.map(function (p) { return { url: p.url, title: p.title, titleLen: len(p.title), descLen: len(p.desc || ''), words: p.words, h1: p.h1.length, status: p.status }; }),
      fixes: buildFixes(S, items),
      summary: makeSummary(score, positives, negatives, potential),
      gbp: null
    };
    return report;
  }

  function makeSummary(score, pos, neg, potential) {
    var TRIVIAL = { noindex: 1, https: 1, viewport: 1, perf: 1, response: 1, headings: 1, lang: 1, canonical: 1 };
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

  // ---------- είσοδος από browser (επικολλημένο HTML) ----------
  function analyzeHtml(html, opts) {
    opts = opts || {};
    var doc = new DOMParser().parseFromString(html, 'text/html');
    return analyzeSite([{ doc: doc, url: opts.url || '', html: html, size: html.length }], { mode: 'paste', now: opts.now });
  }

  return { CATS: CATS, CHECKS: CHECKS, extract: extract, analyzeSite: analyzeSite, analyzeHtml: analyzeHtml, analyzeGbp: analyzeGbp, compareReports: compareReports, PASS: PASS, WARN: WARN };
});
