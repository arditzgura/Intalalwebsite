#!/usr/bin/env node
/**
 * build-seo.js — gjeneron faqe statike SEO për artikujt dhe pelhurat nga Firebase REST API.
 * Ekzekutohet nga GitHub Actions (nightly) ose manualisht: node scripts/build-seo.js
 *
 * Output:
 *   /artikull/<slug>/index.html   — faqe për çdo artikull
 *   /pelhura/<slug>/index.html    — faqe për çdo pelhurë
 *   sitemap.xml                   — sitemap i plotë
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

/* ── Config ─────────────────────────────────────────────────── */
const PROJECT_ID  = 'intal-webiste';
const API_KEY     = 'AIzaSyCi0nHVXYruuRE33NDOrGLVhRwl0nupUfI';
const BASE_URL    = 'https://intalal.com';
const ROOT        = path.join(__dirname, '..');
const TODAY       = new Date().toISOString().slice(0, 10);

/* ── Helpers ─────────────────────────────────────────────────── */
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse error: ' + data.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

async function fbGet(docId) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/konfigurimi/${docId}?key=${API_KEY}`;
  const res = await httpsGet(url);
  if (res.error) throw new Error(`Firebase error for ${docId}: ${JSON.stringify(res.error)}`);
  const val = res.fields && res.fields.value && res.fields.value.stringValue;
  if (!val) return null;
  return JSON.parse(val);
}

function slugify(str) {
  return (str || '')
    .toLowerCase()
    .replace(/ë/g, 'e').replace(/ç/g, 'c').replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function photoUrl(p) {
  if (!p) return '';
  return typeof p === 'string' ? p : (p.src || p.url || '');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/* ── Article page template ───────────────────────────────────── */
function articleHtml(art, slug) {
  const title  = esc(art.name || 'Artikull');
  const desc   = esc(art.desc || `Artikull ${art.name} nga Intal Albania — fabrikë shqiptare e të brendshmeve.`);
  const photo  = photoUrl((art.photos || [])[0]);
  const ogImg  = photo || `${BASE_URL}/og_image.png`;
  const canon  = `${BASE_URL}/artikull/${slug}`;
  const sizes  = (art.masat || art.sizes || []).join(', ');
  const colors = (art.ngjyrat || []).length;
  const comp   = (art.perberja || []).map(p => `${p.pct || p.value || ''}% ${p.material || p.name || ''}`).filter(Boolean).join(', ');

  return `<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Intal Underwear</title>
  <meta name="description" content="${desc}" />
  <link rel="canonical" href="${canon}" />
  <meta property="og:title" content="${title} — Intal Underwear" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:url" content="${canon}" />
  <meta property="og:type" content="product" />
  <meta property="og:image" content="${esc(ogImg)}" />
  <meta property="og:site_name" content="Intal Albania" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "${title.replace(/"/g, '\\"')}",
    "description": "${desc.replace(/"/g, '\\"')}",
    "brand": { "@type": "Brand", "name": "Intal Albania" },
    "sku": "${esc(art.code || slug)}",
    "image": "${esc(ogImg)}",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "seller": { "@type": "Organization", "name": "Intal Albania", "url": "${BASE_URL}" }
    }
  }
  </script>
  <link rel="stylesheet" href="/css/main.css">
  <link rel="icon" type="image/png" href="/favicon.png">
  <style>
    body{font-family:'Montserrat',sans-serif;margin:0;padding:0;background:#fafafa;color:#0a0a0a;}
    .seo-art{max-width:860px;margin:0 auto;padding:32px 16px 64px;}
    .seo-art-back{display:inline-flex;align-items:center;gap:6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#888;text-decoration:none;margin-bottom:24px;}
    .seo-art-back:hover{color:#C8003E;}
    .seo-art-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;}
    @media(max-width:640px){.seo-art-grid{grid-template-columns:1fr;}}
    .seo-art-img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;background:#f0f0f0;}
    .seo-art-img-placeholder{width:100%;aspect-ratio:1;border-radius:10px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:48px;}
    .seo-art-info{padding:8px 0;}
    .seo-art-code{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#aaa;margin-bottom:6px;}
    .seo-art-name{font-size:24px;font-weight:800;letter-spacing:-0.5px;margin:0 0 12px;}
    .seo-art-desc{font-size:14px;line-height:1.7;color:#444;margin-bottom:20px;}
    .seo-art-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;}
    .seo-art-label{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#888;margin-bottom:6px;font-weight:600;}
    .seo-art-chip{background:#f0f0f0;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:500;}
    .seo-art-cta{display:inline-block;background:#C8003E;color:#fff;text-decoration:none;border-radius:8px;padding:12px 28px;font-weight:700;font-size:13px;letter-spacing:0.5px;margin-top:8px;}
    .seo-art-cta:hover{background:#a8002e;}
  </style>
</head>
<body>
  <div class="seo-art">
    <a href="/artikujt" class="seo-art-back">← Kthehu te Artikujt</a>
    <div class="seo-art-grid">
      <div>
        ${photo
          ? `<img src="${esc(photo)}" alt="${title}" class="seo-art-img" loading="lazy">`
          : `<div class="seo-art-img-placeholder">👕</div>`}
      </div>
      <div class="seo-art-info">
        ${art.code ? `<p class="seo-art-code">Art: ${esc(art.code)}</p>` : ''}
        <h1 class="seo-art-name">${title}</h1>
        ${art.desc ? `<p class="seo-art-desc">${esc(art.desc)}</p>` : ''}
        ${sizes ? `<div class="seo-art-label">Masa</div><div class="seo-art-row">${sizes.split(', ').map(s=>`<span class="seo-art-chip">${esc(s)}</span>`).join('')}</div>` : ''}
        ${colors > 0 ? `<div class="seo-art-label">Ngjyra: ${colors}</div>` : ''}
        ${comp ? `<div class="seo-art-label">Përbërja</div><p style="font-size:13px;color:#555;">${esc(comp)}</p>` : ''}
        <a href="/artikujt" class="seo-art-cta">Shiko të gjithë artikujt</a>
      </div>
    </div>
  </div>
  <script>
    // Redirect to dynamic page keeping article open
    (function(){
      var slug = '${slug}';
      window.__seoSlug = slug;
    })();
  </script>
</body>
</html>`;
}

/* ── Fabric page template ────────────────────────────────────── */
function fabricHtml(fab, slug) {
  const title = esc(fab.name || 'Pelhurë');
  const desc  = esc(fab.desc || `Pelhurë ${fab.name} nga Intal Albania — material cilësor për prodhim të brendshmeve.`);
  const photo = photoUrl((fab.photos || [])[0]);
  const ogImg = photo || `${BASE_URL}/og_image.png`;
  const canon = `${BASE_URL}/pelhura/${slug}`;

  return `<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Pelhura | Intal Underwear</title>
  <meta name="description" content="${desc}" />
  <link rel="canonical" href="${canon}" />
  <meta property="og:title" content="${title} — Intal Underwear" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:url" content="${canon}" />
  <meta property="og:type" content="product" />
  <meta property="og:image" content="${esc(ogImg)}" />
  <meta property="og:site_name" content="Intal Albania" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "${title.replace(/"/g, '\\"')}",
    "description": "${desc.replace(/"/g, '\\"')}",
    "brand": { "@type": "Brand", "name": "Intal Albania" },
    "sku": "${esc(fab.code || slug)}",
    "image": "${esc(ogImg)}",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "seller": { "@type": "Organization", "name": "Intal Albania", "url": "${BASE_URL}" }
    }
  }
  </script>
  <link rel="stylesheet" href="/css/main.css">
  <link rel="icon" type="image/png" href="/favicon.png">
  <style>
    body{font-family:'Montserrat',sans-serif;margin:0;padding:0;background:#fafafa;color:#0a0a0a;}
    .seo-art{max-width:860px;margin:0 auto;padding:32px 16px 64px;}
    .seo-art-back{display:inline-flex;align-items:center;gap:6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#888;text-decoration:none;margin-bottom:24px;}
    .seo-art-back:hover{color:#C8003E;}
    .seo-art-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;}
    @media(max-width:640px){.seo-art-grid{grid-template-columns:1fr;}}
    .seo-art-img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;background:#f0f0f0;}
    .seo-art-img-placeholder{width:100%;aspect-ratio:1;border-radius:10px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:48px;}
    .seo-art-info{padding:8px 0;}
    .seo-art-code{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#aaa;margin-bottom:6px;}
    .seo-art-name{font-size:24px;font-weight:800;letter-spacing:-0.5px;margin:0 0 12px;}
    .seo-art-desc{font-size:14px;line-height:1.7;color:#444;margin-bottom:20px;}
    .seo-art-label{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#888;margin-bottom:6px;font-weight:600;}
    .seo-art-chip{background:#f0f0f0;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:500;}
    .seo-art-cta{display:inline-block;background:#C8003E;color:#fff;text-decoration:none;border-radius:8px;padding:12px 28px;font-weight:700;font-size:13px;letter-spacing:0.5px;margin-top:8px;}
    .seo-art-cta:hover{background:#a8002e;}
  </style>
</head>
<body>
  <div class="seo-art">
    <a href="/pelhura" class="seo-art-back">← Kthehu te Pelhurat</a>
    <div class="seo-art-grid">
      <div>
        ${photo
          ? `<img src="${esc(photo)}" alt="${title}" class="seo-art-img" loading="lazy">`
          : `<div class="seo-art-img-placeholder">🧶</div>`}
      </div>
      <div class="seo-art-info">
        ${fab.code ? `<p class="seo-art-code">Kodi: ${esc(fab.code)}</p>` : ''}
        <h1 class="seo-art-name">${title}</h1>
        ${fab.desc ? `<p class="seo-art-desc">${esc(fab.desc)}</p>` : ''}
        <a href="/pelhura" class="seo-art-cta">Shiko të gjitha pelhurat</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/* ── Sitemap ─────────────────────────────────────────────────── */
function buildSitemap(artSlugs, pelSlugs) {
  const staticUrls = [
    { loc: `${BASE_URL}/`,           priority: '1.0' },
    { loc: `${BASE_URL}/artikujt`,   priority: '0.9' },
    { loc: `${BASE_URL}/pelhura`,    priority: '0.8' },
    { loc: `${BASE_URL}/rreth-nesh`, priority: '0.7' },
  ];

  const artUrls = artSlugs.map(s => ({ loc: `${BASE_URL}/artikull/${s}`, priority: '0.6' }));
  const pelUrls = pelSlugs.map(s => ({ loc: `${BASE_URL}/pelhura/${s}`,  priority: '0.5' }));

  const all = [...staticUrls, ...artUrls, ...pelUrls];
  const rows = all.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n${rows}\n\n</urlset>\n`;
}

/* ── Main ────────────────────────────────────────────────────── */
async function main() {
  console.log('Fetching artikujt...');
  const artikujt = await fbGet('artikujt').catch(() => null) || [];
  console.log(`  → ${artikujt.length} artikuj`);

  console.log('Fetching pelhurat...');
  const pelhurat = await fbGet('pelhurat').catch(() => null) || [];
  console.log(`  → ${pelhurat.length} pelhura`);

  const artSlugs = [];
  const pelSlugs = [];
  const usedSlugs = new Set();

  function uniqueSlug(base, set) {
    let slug = base || 'artikull';
    let n = 0;
    let candidate = slug;
    while (set.has(candidate)) { n++; candidate = `${slug}-${n}`; }
    set.add(candidate);
    return candidate;
  }

  // Generate article pages
  const artDir = path.join(ROOT, 'artikull');
  ensureDir(artDir);
  for (const art of artikujt) {
    if (!art.name) continue;
    const base = slugify(art.name + (art.code ? '-' + art.code : ''));
    const slug = uniqueSlug(base, usedSlugs);
    artSlugs.push(slug);
    const dir = path.join(artDir, slug);
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), articleHtml(art, slug), 'utf8');
  }
  console.log(`Generated ${artSlugs.length} article pages → /artikull/`);

  // Generate fabric pages
  const pelDir = path.join(ROOT, 'pelhura-seo');
  // We write into a subfolder inside /pelhura/ but that clashes with pelhura.html
  // Instead write to /pelhura/<slug>/index.html — GitHub Pages serves dirs fine
  const pelSlugSet = new Set();
  for (const fab of pelhurat) {
    if (!fab.name) continue;
    const base = slugify(fab.name + (fab.code ? '-' + fab.code : ''));
    const slug = uniqueSlug(base, pelSlugSet);
    pelSlugs.push(slug);
    const dir = path.join(ROOT, 'pelhura', slug);
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), fabricHtml(fab, slug), 'utf8');
  }
  console.log(`Generated ${pelSlugs.length} fabric pages → /pelhura/<slug>/`);

  // Write sitemap
  const sitemap = buildSitemap(artSlugs, pelSlugs);
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap, 'utf8');
  console.log('Updated sitemap.xml');

  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
