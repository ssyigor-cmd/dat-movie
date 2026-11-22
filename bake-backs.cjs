const fs = require('fs');
const backs = JSON.parse(fs.readFileSync('tvmaze-backs.json', 'utf8'));
let html = fs.readFileSync('ios.html', 'utf8');
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let count = 0;
for (const [title, urls] of Object.entries(backs)) {
  const re = new RegExp("(title: '" + esc(title) + "'.*?img: '[^']*')");
  if (!re.test(html)) { console.log('MISS', title); continue; }
  const inj = 'backs: [' + urls.map(u => "'" + u + "'").join(', ') + ']';
  html = html.replace(re, '$1, ' + inj);
  count++;
}
fs.writeFileSync('ios.html', html);
console.log('baked', count, 'entries');
