const weak = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Acme Services</title>
<meta property="og:title" content="Acme Services"><meta property="og:image" content="https://acme.gr/favicon.ico">
<meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body>
<header><a href="/"><img src="logo.png"></a><nav><a href="/"></a><a href="/about">Σχετικά</a><a href="/services">Υπηρεσίες</a><a href="/contact">Επικοινωνία</a></nav>
<a href="#" class="lang">English</a> <a href="#" class="lang">Español</a></header>
<video autoplay muted src="bg.mp4"></video>
<h2>Σχετικά με εμάς</h2><p>Στην Acme πιστεύουμε στην παροχή απαράμιλλης εξειδίκευσης και καινοτόμων λύσεων στους πελάτες μας στους τομείς της εστίασης και του τουρισμού. Στόχος μας είναι η βιώσιμη ανάπτυξη.</p>
<h2>Υπηρεσίες</h2><p>Συμβουλευτική και στρατηγικός σχεδιασμός.</p>
<img src="1.jpg" alt="Carousel Image 1"><img src="2.jpg"><img src="workplace-2303851_1920.jpg" alt="workplace-2303851_1920">
<footer><p>Γρίβα Διγενή 2, 17342 Αγίου Δημητρίου</p><p>Τηλέφωνο: 6983661460</p><p>Email: acme@mail.com</p>
<a href="https://facebook.com"></a><a href="https://instagram.com"></a>
<p>© 2020 Acme. Όλα τα δικαιώματα διατηρούνται.</p><p>Λόγω της πανδημίας Covid-19 τα μαθήματα γίνονται online.</p>
<p>Διαβάστε την [[cookie_link]] μας.</p></footer></body></html>`;

const good = `<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"><title>Συμβουλευτική Εστιατορίων στην Αθήνα | Beta Consulting</title>
<meta name="description" content="Συμβουλευτική για εστιατόρια και ξενοδοχεία: μενού, κοστολόγηση και ομάδα. Ζήτησε δωρεάν πρώτη συζήτηση.">
<link rel="canonical" href="https://beta.gr/"><meta property="og:title" content="Συμβουλευτική Εστιατορίων | Beta"><meta property="og:description" content="Μενού, κοστολόγηση, ομάδα.">
<meta property="og:image" content="https://beta.gr/og.jpg"><meta name="viewport" content="width=device-width, initial-scale=1">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Beta Consulting","telephone":"+30 210 1234567","address":{"@type":"PostalAddress","streetAddress":"Ερμού 5"}}</script></head><body>
<header><nav><a href="/">Αρχική</a><a href="/services">Υπηρεσίες</a></nav><a class="btn" href="/contact">Ζήτα προσφορά</a></header>
<h1>Συμβουλευτική για εστιατόρια που θέλουν περισσότερα κέρδη</h1>
<h2>Τι κάνουμε</h2><p>Βοηθάμε ιδιοκτήτες εστιατορίων να μειώσουν το κόστος και να αυξήσουν τις πωλήσεις με συγκεκριμένα βήματα: κοστολόγηση μενού, εκπαίδευση προσωπικού και οργάνωση κουζίνας. Δουλεύουμε δίπλα σου στην επιχείρηση.</p>
<h2>Πελάτες και κριτικές</h2><p>Δείτε τις αξιολογήσεις των πελατών μας και τα έργα μας. Διαθέτουμε πιστοποίηση HACCP και συνεργάτες σε όλη την Αττική. Πακέτα από 150€ τον μήνα με πλήρη ανάλυση, οδηγό εφαρμογής και υποστήριξη κατά τη διάρκεια της συνεργασίας. Κάθε συνεργασία ξεκινά με πλάνο δράσης, στόχους και μέτρηση αποτελεσμάτων. </p>
<h2>Πώς δουλεύουμε</h2><p>Πρώτη συνάντηση, ανάλυση, πλάνο, εφαρμογή και παρακολούθηση για τρεις μήνες. Στο τέλος παραδίδουμε αναφορά αποτελεσμάτων και οδηγίες συντήρησης, ώστε η επιχείρησή σου να συνεχίσει μόνη της με σιγουριά.</p>
<img src="a.jpg" alt="Ομάδα συμβούλων σε συνάντηση με ιδιοκτήτη εστιατορίου"><img src="b.jpg" alt="Κοστολόγηση μενού σε υπολογιστή">
<form><label for="n">Όνομα</label><input id="n"><label for="e">Email</label><input id="e"><textarea placeholder="Μήνυμα"></textarea><input type="checkbox"> Αποδέχομαι την <a href="/privacy">Πολιτική Απορρήτου</a><button>Αποστολή</button></form>
<footer><p>Ερμού 5, 10563 Αθήνα · <a href="tel:+302101234567">210 1234567</a> · <a href="mailto:info@beta.gr">info@beta.gr</a></p><p>ΑΦΜ 123456789 · ΓΕΜΗ 12345</p>
<a href="/privacy">Πολιτική Απορρήτου</a> <a href="/terms">Όροι Χρήσης</a> <a href="https://www.facebook.com/betaconsulting">Facebook</a> <a href="https://www.linkedin.com/company/beta">LinkedIn</a>
<p>© 2026 Beta Consulting</p></footer></body></html>`;

const page = (t, d, body) => `<!DOCTYPE html><html lang="el"><head><title>${t}</title>${d ? `<meta name="description" content="${d}">` : ''}<meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${body}</body></html>`;
module.exports = { weak, good, page };
