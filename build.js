// Φτιάχνει ένα αυτόνομο αρχείο (dist/checkup.html) με ενσωματωμένη τη μηχανή ανάλυσης.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('analyzer.js', 'utf8').replace(/<\/script>/gi, '<\\/script>');
const out = html.replace(/<!--ANALYZER-->[\s\S]*?<!--\/ANALYZER-->/, '<script>\n' + js + '\n</script>');
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/checkup.html', out);
fs.writeFileSync('dist/index.html', out);
console.log('dist/checkup.html', Math.round(out.length / 1024) + ' KB');
