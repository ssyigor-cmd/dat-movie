/* Busca tmdb_id + backdrops + logo (pt-BR first) para os 20 títulos do demo.
   Uso: node fetch-tmdb-data.cjs <TMDB_API_KEY>
   Salva tmdb-baked.json. Não modifica ios.html. */
const fs = require('fs');

const TITLES = [
  'Severance', 'The Last of Us', 'Andor', 'House of the Dragon', 'The Bear',
  'Shogun', 'Fallout', 'Succession', 'Dark', 'Silo', 'Arcane', 'Slow Horses',
  'The Pitt', 'Adolescence', 'Alien: Earth', 'Poker Face', 'The Diplomat',
  'Station Eleven', 'Pantheon', 'Scavengers Reign'
];

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FILTER_LANG = ['en', 'pt'];

function pickSearchResult(results, title) {
  const target = norm(title);
  const exact = results.find((r) => norm(r.name) === target || norm(r.original_name) === target);
  if (exact) return exact;
  const partial = results.find((r) => norm(r.name).includes(target) || norm(r.original_name).includes(target));
  return partial || results[0] || null;
}

const PREFS = [
  { lang: 'pt', country: 'BR' },
  { lang: 'en', country: 'US' },
  { lang: 'pt', country: '*' },
  { lang: 'en', country: '*' },
  { lang: null, country: '*' }
];

const byCanonical = (a, b) =>
  (b.vote_average || 0) - (a.vote_average || 0) ||
  (b.vote_count || 0) - (a.vote_count || 0) ||
  (b.width || 0) - (a.width || 0);

function pickCanonicalLogo(logos) {
  if (!Array.isArray(logos) || !logos.length) return null;
  const valid = logos.filter((l) => l && l.file_path);
  if (!valid.length) return null;
  for (const pref of PREFS) {
    const group = valid.filter((l) => {
      if ((l.iso_639_1 ?? null) !== pref.lang) return false;
      if (pref.country === '*') return true;
      const country = l.iso_3166_1 ?? null;
      return country === null || country === pref.country;
    });
    if (group.length) {
      return 'https://image.tmdb.org/t/p/w500' + [...group].sort(byCanonical)[0].file_path;
    }
  }
  return 'https://image.tmdb.org/t/p/w500' + [...valid].sort(byCanonical)[0].file_path;
}

(async () => {
  const key = process.argv[2];
  if (!key) { console.error('Uso: node fetch-tmdb-data.cjs <TMDB_API_KEY>'); process.exit(1); }
  const base = 'https://api.themoviedb.org/3';
  const out = {};

  for (const title of TITLES) {
    try {
      const s = await fetch(`${base}/search/tv?api_key=${key}&language=pt-BR&query=${encodeURIComponent(title)}`);
      const sj = await s.json();
      if (sj.status_message) { console.log('SEARCH ERR', title, sj.status_message); continue; }
      const hit = pickSearchResult(sj.results || [], title);
      if (!hit) { console.log('NO HIT', title); continue; }

      const im = await fetch(`${base}/tv/${hit.id}/images?api_key=${key}&include_image_language=pt,en,null`);
      const ij = await im.json();
      const backdrops = (ij.backdrops || [])
        .filter((i) => i.iso_639_1 === null || FILTER_LANG.includes(i.iso_639_1))
        .filter((i, idx, arr) => arr.findIndex((o) => o.file_path === i.file_path) === idx)
        .sort((a, b) => (b.width || 0) - (a.width || 0))
        .slice(0, 6)
        .map((i) => 'https://image.tmdb.org/t/p/w1280' + i.file_path);

      const logo = pickCanonicalLogo(ij.logos || []);
      out[title] = { id: hit.id, name: hit.name, backs: backdrops, logo };
      console.log(title.padEnd(22), 'id', hit.id, '->', hit.name, '| backs', backdrops.length, '| logo', logo ? 'yes' : 'NO');
    } catch (e) {
      console.log('ERR', title, e.message);
    }
    await sleep(120);
  }

  fs.writeFileSync('tmdb-baked.json', JSON.stringify(out, null, 1));
  console.log('--- saved tmdb-baked.json ---');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
