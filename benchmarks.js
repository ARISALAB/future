/*
 * Λίστα ανταγωνιστών (curated). Πρόσθεσε δικά σου sites στον πίνακα `sites`.
 * cat: id κατηγορίας · city: πόλη (προαιρετικά, βοηθά στην επιλογή) · url: διεύθυνση.
 * Κάθε κατηγορία χρειάζεται τουλάχιστον 2 sites για αυτόματη σύγκριση.
 * `re`: λέξεις (χωρίς τόνους, ς→σ) που βοηθούν να μαντέψει η εφαρμογή την κατηγορία του site.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CheckupBench = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    categories: [
      { id: 'education', name: 'Εκπαίδευση και πιστοποιήσεις (π.χ. αγγλικά για ΑΣΕΠ)', re: 'αγγλικ|πιστοποιητικ|εξετασ|φροντιστ|ielts|toefl|nylc|ασεπ|γλωσσομαθει' },
      { id: 'consulting', name: 'Συμβουλευτική εστίασης και φιλοξενίας', re: 'συμβουλ|consult' },
      { id: 'restaurant', name: 'Εστιατόριο / ταβέρνα', re: 'εστιατορι|ταβερν|μεζεδ|μενου|τραπεζι|restaurant|taverna' }
    ],
    sites: [
      { cat: 'education', city: 'Αθήνα', name: 'Online.edu.gr', url: 'https://online.edu.gr/' },
      { cat: 'education', city: '', name: 'goLearn', url: 'https://www.golearn.gr/' },
      { cat: 'education', city: '', name: 'Εξετάσεις Αγγλικών OnLine', url: 'https://exetasisonline.gr/' },
      { cat: 'education', city: '', name: 'Tzaikou Language Centre', url: 'https://www.tzaikou.gr/' },
      { cat: 'education', city: 'Αθήνα', name: 'ΕΚΕΚ', url: 'https://ekek.gr/' },
      { cat: 'education', city: 'Αθήνα', name: 'EDU STANDARDS', url: 'https://www.edustandards.eu/' },
      { cat: 'consulting', city: '', name: 'Czinonas Consulting', url: 'https://czinonas.gr/' },
      { cat: 'consulting', city: '', name: 'Culinary Consulting', url: 'https://culinaryconsulting.gr/' },
      { cat: 'consulting', city: '', name: 'Harcos', url: 'https://www.harcos.gr/' },
      { cat: 'restaurant', city: 'Αθήνα', name: 'Γέρος του Μωριά', url: 'https://www.gerostoumoria-restaurant.com/el/' }
    ]
  };
});
