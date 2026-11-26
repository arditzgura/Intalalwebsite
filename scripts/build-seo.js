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

function clImg(url, w) {
  if (!url || url.indexOf('res.cloudinary.com') === -1) return url || '';
  if (url.indexOf('f_auto') !== -1) {
    if (!w || url.indexOf('w_') !== -1) return url;
    return url.replace('/image/upload/', '/image/upload/w_' + w + ',');
  }
  return url.replace('/image/upload/', '/image/upload/f_auto,q_auto' + (w ? ',w_' + w : '') + '/');
}

/* ── Përshkrimet ─────────────────────────────────────────────── */
const _pershkrimFile = path.join(__dirname, '..', 'pershkrimet.json');
const _pershkrimMap = {};
if (fs.existsSync(_pershkrimFile)) {
  const _list = JSON.parse(fs.readFileSync(_pershkrimFile, 'utf8'));
  for (const item of _list) if (item.code) _pershkrimMap[item.code] = item.pershkrim;
}

const _pershkrimPelhuraFile = path.join(__dirname, '..', 'pershkrimet_pelhura.json');
const _pershkrimPelhuraMap = {};
if (fs.existsSync(_pershkrimPelhuraFile)) {
  const _listP = JSON.parse(fs.readFileSync(_pershkrimPelhuraFile, 'utf8'));
  for (const item of _listP) if (item.name) _pershkrimPelhuraMap[item.name] = item.pershkrim;
}

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

function jesc(str) {
  return (str || '').replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'');
}

function photoUrl(p) {
  if (!p) return '';
  return typeof p === 'string' ? p : (p.src || p.url || '');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/* ── Alt text helper ─────────────────────────────────────────── */
function artAlt(art, photoIdx) {
  const name = art.name || 'Artikull';
  const mat  = (art.perberja || [])[0];
  const matStr = mat ? `, ${mat.material || mat.name || 'pambuk'} ${mat.perqindje || mat.pct || mat.value || '100'}%` : '';
  const subMap = { meshkuj:'për meshkuj', femra:'për femra', femije:'për fëmijë', fëmijë:'për fëmijë' };
  const rawSub = art.sub ? (Array.isArray(art.sub) ? art.sub[0] : art.sub) : '';
  const subStr = subMap[(rawSub||'').toLowerCase()] ? ', ' + subMap[(rawSub||'').toLowerCase()] : '';
  const idx = photoIdx || 0;
  const viewStr = idx === 0 ? ', pamje përpara' : `, foto ${idx + 1}`;
  return `${name}${matStr}${subStr}${viewStr}`;
}

/* ── Meta description builder ────────────────────────────────── */
function buildMetaDesc(art) {
  // Use AI description bullets from pershkrimet.json if available
  const pts = (art.pershkrim && art.pershkrim.length ? art.pershkrim : null)
           || (art.code && _pershkrimMap[art.code])
           || null;
  if (pts && pts.length >= 2) {
    // Combine first two bullets; trim to 155 chars at word boundary
    let d = pts[0] + ' ' + pts[1];
    if (d.length > 155) {
      d = d.slice(0, 152);
      const lastSpace = d.lastIndexOf(' ');
      if (lastSpace > 100) d = d.slice(0, lastSpace);
      d += '…';
    }
    return d;
  }
  // Fallback template
  const sub  = art.sub ? (Array.isArray(art.sub) ? art.sub[0] : art.sub) : '';
  const kat  = art.kat ? (Array.isArray(art.kat) ? art.kat[0] : art.kat) : '';
  const mat  = (art.perberja || [])[0];
  const matStr = mat ? `${mat.material || 'Pambuk'} ${mat.perqindje || mat.pct || mat.value || '100'}%` : '100% Pambuk';
  const sizes = (art.masat || art.sizes || []);
  const szStr = sizes.length ? `Masa: ${sizes.join(', ')}.` : '';
  let d = `${art.name || kat} për ${sub || 'të gjithë'}. ${matStr}. ${szStr} Prodhim shqiptar, shitje me shumicë — Intal Albania.`.replace(/\s{2,}/g, ' ').trim();
  if (d.length > 160) d = d.slice(0, 157) + '…';
  return d;
}

/* ── Article page template ───────────────────────────────────── */
function articleHtml(art, slug, suggestions, colorVariants) {
  const title   = esc(art.name || 'Artikull');
  const rawDesc = buildMetaDesc(art);
  const desc    = esc(rawDesc);
  const photos  = (art.photos || []).map(p => clImg(typeof p === 'string' ? p : (p.src || p.url || ''), 1200)).filter(Boolean);
  const photosTh = photos.map(p => clImg(p, 200));
  const photo   = photos[0] || '';
  const ogImg   = photo || `${BASE_URL}/og_image.png`;
  const canon   = `${BASE_URL}/artikull/${slug}/`;
  const sizes   = (art.masat || art.sizes || []);
  const ngjyrat = (art.ngjyrat || []);

  // Breadcrumb segments: gjinia + lloji
  const cap = s => s ? s.toUpperCase() : '';
  const rawSub = art.sub ? (Array.isArray(art.sub) ? art.sub[0] : art.sub) : '';
  const rawKat = art.kat ? (Array.isArray(art.kat) ? art.kat[0] : art.kat) : '';
  const sep = `<span class="bc-sep">/</span>`;
  const subHash = rawSub ? encodeURIComponent(rawSub.toLowerCase()) : '';
  const katHash = rawKat ? encodeURIComponent(rawKat.toLowerCase()) : '';
  const bcSub = rawSub ? `${sep}<a href="/artikujt#${subHash}">${cap(rawSub)}</a>` : '';
  const bcKat = rawKat ? `${sep}<a href="/artikujt#${subHash ? subHash+'/' : ''}${katHash}">${cap(rawKat)}</a>` : '';
  const breadcrumbHtml = `<div class="breadcrumb">
      <a href="/artikujt/">ARTIKUJT</a>
      ${bcSub}${bcKat}
    </div>`;
  const comp    = (art.perberja || []).map(p => `<div class="comp-row"><span>${esc(p.material||p.name||'')}</span><span>${esc(String(p.perqindje||p.pct||p.value||''))}%</span></div>`).join('');

  const thumbsHtml = photos.length > 1
    ? photos.map((src, i) =>
        `<button class="thumb ${i===0?'active':''}" onclick="if(window.innerWidth<=680){openLightbox(${i})}else{setPhoto(${i})}" aria-label="Foto ${i+1}">` +
        `<img src="${esc(photosTh[i]||src)}" alt="${esc(artAlt(art, i))}"></button>`
      ).join('')
    : '';

  const sizesHtml = sizes.length
    ? `<div class="section-label">MASAT</div><div class="chips-row">${sizes.map(s=>`<span class="chip">${esc(s)}</span>`).join('')}</div>`
    : '';

  const colorsHtml = ngjyrat.length
    ? `<div class="section-label">NGJYRAT</div><div class="colors-row">${ngjyrat.map((c,i)=>{
        const variant = colorVariants && colorVariants[i];
        const isCurrent = variant && variant.slug === slug;
        const cls = isCurrent ? ' active' : (!variant ? ' unavailable' : '');
        const dot = `<span class="color-dot${cls}" style="background:${esc(c.hex||'#ccc')}" title="${esc(c.name||'')}"></span>`;
        if (isCurrent || !variant) return dot;
        return `<a href="/artikull/${variant.slug}/" class="color-dot-link">${dot}</a>`;
      }).join('')}</div>`
    : '';

  const photosJson = JSON.stringify(photos);

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
    "@graph": [
      {
        "@type": "Product",
        "name": "${jesc(art.name||'')}",
        "description": "${jesc(rawDesc)}",
        "sku": "${jesc(art.code||slug)}",
        "image": ${photos.length ? JSON.stringify(photos) : `["${jesc(ogImg)}"]`},
        "url": "${BASE_URL}/artikull/${slug}/",
        "brand": {"@type": "Brand", "name": "Intal Albania"},
        "manufacturer": {
          "@type": "Organization",
          "name": "Intal Albania",
          "url": "${BASE_URL}",
          "address": {"@type": "PostalAddress", "addressLocality": "Tiranë", "addressCountry": "AL"}
        },
        "material": "${jesc(((art.perberja||[])[0]||{}).material||'Pambuk')} ${jesc(String(((art.perberja||[])[0]||{}).perqindje||((art.perberja||[])[0]||{}).pct||((art.perberja||[])[0]||{}).value||'100'))}%",
        "category": "Të brendshme",${sizes.length ? `\n        "size": ${JSON.stringify(sizes)},` : ''}${ngjyrat.length ? `\n        "color": "${jesc(ngjyrat.map(c=>c.name||'').filter(Boolean).join(', '))}",` : ''}
        "offers": {
          "@type": "Offer",
          "availability": "https://schema.org/InStock",
          "priceCurrency": "ALL",
          "seller": {"@type": "Organization", "name": "Intal Albania", "url": "${BASE_URL}"}
        }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {"@type": "ListItem", "position": 1, "name": "Artikujt", "item": "${BASE_URL}/artikujt/"}${rawSub ? `,\n          {"@type": "ListItem", "position": 2, "name": "${jesc(rawSub.charAt(0).toUpperCase()+rawSub.slice(1))}", "item": "${BASE_URL}/artikujt/${encodeURIComponent(rawSub.toLowerCase())}/"}` : ''}${rawKat ? `,\n          {"@type": "ListItem", "position": ${rawSub?3:2}, "name": "${jesc(rawKat.charAt(0).toUpperCase()+rawKat.slice(1))}", "item": "${BASE_URL}/artikujt/${rawSub?encodeURIComponent(rawSub.toLowerCase())+'/':''}${encodeURIComponent(rawKat.toLowerCase())}/"}` : ''},
          {"@type": "ListItem", "position": ${rawSub&&rawKat?4:rawSub||rawKat?3:2}, "name": "${jesc(art.name||slug)}", "item": "${BASE_URL}/artikull/${slug}/"}
        ]
      }
    ]
  }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css">
  <link rel="stylesheet" href="/css/main.css">
  <link rel="icon" type="image/png" href="/favicon.png">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Switzer',sans-serif;background:#fff;color:#0a0a0a;min-height:100vh;padding-top:64px;}

    /* ── Layout ── */
    .page{width:100%;padding:28px 3vw 60px;}
    .page-inner{max-width:1100px;margin:0 auto;}

    /* ── Breadcrumb ── */
    .breadcrumb{font-size:14px;color:#555;letter-spacing:0.3px;margin-bottom:10px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;}
    .breadcrumb a{color:#555;text-decoration:none;}
    .breadcrumb a:hover{color:#C8003E;}
    .breadcrumb span{color:#222;}
    .bc-sep{color:#999;font-weight:300;}

    /* ── Product grid ── */
    .product-grid{display:flex;gap:clamp(8px,1.2vw,18px);align-items:flex-start;}
    .thumbs-col{width:clamp(60px,6vw,96px);flex-shrink:0;display:flex;flex-direction:column;gap:6px;}
    .gallery{flex:3;min-width:0;}
    .info{flex:1.6;min-width:0;}
    @media(max-width:900px){.product-grid{gap:8px;} .thumbs-col{width:clamp(52px,5vw,72px);} .gallery{flex:2;} .info{flex:1.4;}}
    @media(max-width:680px){.product-grid{flex-direction:column;gap:0;} .thumbs-col{order:2;width:100%;flex-direction:row;margin-top:8px;gap:6px;} .gallery{order:1;} .info{order:3;margin-top:20px;} .gallery-nav{display:none;}}

    /* ── Gallery ── */
    .gallery{}
    .main-img-wrap{position:relative;background:#fff;max-height:calc(100vh - 160px);min-height:420px;overflow:hidden;}
    .main-img-wrap img{width:100%;height:auto;display:block;transition:opacity .25s;}
    .main-img-placeholder{width:100%;aspect-ratio:3/4;display:flex;align-items:center;justify-content:center;font-size:72px;color:#ddd;}
    .gallery-nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.9);border:none;width:36px;height:36px;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.12);}
    .gallery-nav.prev{left:10px;}
    .gallery-nav.next{right:10px;}
    .gallery-nav:hover{background:#fff;}
    /* vertical thumbs column */
    .thumb{border:2px solid transparent;overflow:hidden;width:100%;aspect-ratio:1;cursor:pointer;padding:0;background:none;display:block;transition:border-color .15s;}
    .thumb.active{border-color:#C8003E;}
    .thumb img{width:100%;height:100%;object-fit:cover;display:block;}

    /* ── Info ── */
    .info{}
    .info-eyebrow{font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#aaa;margin-bottom:6px;}
    .info-name{font-size:20px;font-weight:800;letter-spacing:-0.3px;line-height:1.2;margin-bottom:4px;}
    @media(max-width:680px){.info-name{font-size:20px;}}
    .info-desc{font-size:12px;line-height:1.6;color:#555;margin:8px 0 16px;padding-bottom:16px;border-bottom:1px solid #ebebeb;}
    .section-label{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#aaa;font-weight:700;margin-bottom:10px;margin-top:18px;}
    .chips-row{display:flex;gap:6px;flex-wrap:wrap;}
    .chip{background:#fff;border:1.5px solid #e0e0e0;border-radius:0;padding:5px 10px;font-size:11px;font-weight:600;letter-spacing:0.5px;}
    .colors-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
    .color-dot{width:28px;height:28px;border-radius:50%;border:1px solid rgba(0,0,0,.12);display:inline-block;flex-shrink:0;transition:outline .1s;}
    .color-dot.active{outline:2px solid #0a0a0a;outline-offset:2px;}
    .color-dot.unavailable{opacity:0.35;cursor:default;}
    .color-dot-link{display:inline-block;text-decoration:none;}
    .color-dot-link:hover .color-dot{outline:2px solid #0a0a0a;outline-offset:2px;}
    .comp-wrap{margin-top:14px;}
    .comp-row{display:flex;justify-content:flex-start;gap:14px;align-items:center;padding:3px 0;margin-bottom:2px;font-size:14px;font-weight:400;background:none;}
    .comp-row:last-child{margin-bottom:0;}

    /* ── Suggestions carousel ── */
    .suggestions{margin:32px 0 0;background:#fff;padding:36px 0 48px;position:relative;}
    .suggestions-title{text-align:center;font-size:13px;letter-spacing:5px;text-transform:uppercase;color:#0a0a0a;font-weight:600;margin-bottom:40px;}
    .sugg-carousel{position:relative;}
    .sugg-track-wrap{overflow:hidden;}
    .sugg-track{display:flex;gap:10px;transition:transform .45s cubic-bezier(.4,0,.2,1);user-select:none;}
    .sugg-card{flex:0 0 25%;min-width:0;text-decoration:none;color:inherit;display:block;cursor:pointer;}
    @media(min-width:1400px){.sugg-card{flex:0 0 16.667%;}}
    @media(min-width:1200px) and (max-width:1399px){.sugg-card{flex:0 0 20%;}}
    @media(max-width:900px){.sugg-card{flex:0 0 33.333%;}}
    @media(max-width:600px){.sugg-card{flex:0 0 50%;}}
    .sugg-card-img{aspect-ratio:1;overflow:hidden;background:#edeae6;}
    .sugg-card-img img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s;}
    .sugg-card:hover .sugg-card-img img{transform:scale(1.03);}
    .sugg-card-body{padding:14px 16px 0;}
    .sugg-card-name{font-size:12px;font-weight:500;line-height:1.45;color:#0a0a0a;}
    .sugg-card-sub{font-size:11px;color:#999;margin-top:2px;}
    .sugg-arr{position:absolute;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;z-index:2;padding:8px;color:#0a0a0a;display:flex;align-items:center;justify-content:center;}
    .sugg-arr.prev{left:10px;}
    .sugg-arr.next{right:10px;}
    .sugg-arr svg{width:18px;height:18px;}

    /* ── Lightbox ── */
    .lightbox{display:none;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9000;align-items:center;justify-content:center;}
    .lightbox.open{display:flex;}
    .lightbox-img{max-width:90vw;max-height:90vh;object-fit:contain;border-radius:4px;}
    .lightbox-close{position:absolute;top:18px;right:22px;background:none;border:none;color:#fff;font-size:32px;cursor:pointer;line-height:1;}
    .lightbox-prev,.lightbox-next{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.12);border:none;color:#fff;width:44px;height:44px;border-radius:50%;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;}
    .lightbox-prev{left:16px;}
    .lightbox-next{right:16px;}

    /* ── CTA buttons ── */
    .cta-group{display:flex;flex-direction:column;gap:8px;margin-top:18px;padding-top:16px;border-top:1px solid #ebebeb;}
    .btn-pair{display:flex;gap:0;border-radius:0;overflow:hidden;}
    .btn-kerkese{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:#0a0a0a;color:#fff;border:none;cursor:pointer;padding:9px 8px;font-family:inherit;font-weight:700;font-size:10px;letter-spacing:0.8px;text-transform:uppercase;white-space:nowrap;}
    .btn-kerkese:hover{background:#333;}
    .btn-share-half{flex:1;display:flex;align-items:center;justify-content:center;background:#f5f5f5;border:none;cursor:pointer;padding:9px 10px;color:#555;}
    .btn-share-half:hover{background:#e8e8e8;}
    .btn-wa-half{flex:1;display:flex;align-items:center;justify-content:center;background:#fff;color:#25D366;text-decoration:none;padding:9px 10px;}
    .btn-wa-half:hover{background:#f0faf5;}
    .btn-pair-divider{width:1px;background:rgba(0,0,0,.1);flex-shrink:0;}
    .btn-back{display:flex;align-items:center;justify-content:center;gap:6px;background:#fff;border:1.5px solid #d0d0d0;color:#999;text-decoration:none;border-radius:50px;padding:10px 20px;font-weight:600;font-size:11px;letter-spacing:0.5px;}
    .btn-back:hover{border-color:#aaa;color:#666;}
    /* Order modal */
    .order-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:8000;align-items:flex-end;justify-content:center;}
    .order-modal.open{display:flex;}
    .order-box{background:#fff;width:100%;max-width:480px;border-radius:16px 16px 0 0;padding:28px 24px 36px;max-height:90vh;overflow-y:auto;}
    .order-box h2{font-size:17px;font-weight:800;margin-bottom:20px;}
    .order-field{margin-bottom:14px;}
    .order-field label{display:block;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#888;margin-bottom:5px;}
    .order-field input,.order-field textarea{width:100%;border:1.5px solid #e0e0e0;border-radius:8px;padding:10px 12px;font-size:13px;font-family:inherit;outline:none;resize:none;}
    .order-field input:focus,.order-field textarea:focus{border-color:#C8003E;}
    .btn-send-order{width:100%;background:#C8003E;color:#fff;border:none;border-radius:8px;padding:13px;font-size:13px;font-weight:700;letter-spacing:0.5px;cursor:pointer;margin-top:4px;}
    .btn-send-order:hover{background:#a8002e;}
    .order-close{position:absolute;top:14px;right:18px;background:none;border:none;font-size:22px;cursor:pointer;color:#888;line-height:1;}
    .order-box-wrap{position:relative;}
    .back-top{display:inline-flex;align-items:center;gap:6px;color:#888;font-size:11px;font-weight:600;letter-spacing:0.5px;text-decoration:none;margin-bottom:8px;}
    .back-top:hover{color:#C8003E;}
    .art-pershkrim{margin-top:20px;padding-top:16px;border-top:1px solid #f0f0f0;}
    .art-pershkrim ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:7px;}
    .art-pershkrim li{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#555;line-height:1.5;}
    .art-pershkrim li::before{content:"•";color:#C8003E;font-size:14px;line-height:1.3;flex-shrink:0;}

  </style>
</head>
<body>

  <!-- Navbar -->
  <nav class="navbar" role="navigation" aria-label="Navigimi kryesor">
    <div class="navbar-inner">
      <div class="navbar-left">
        <button class="nav-hamburger" aria-label="Menu" onclick="openMenuDrawer()">
          <i class="ri-menu-line"></i>
        </button>
        <div class="nav-links">
          <a href="/" class="nav-link">Home</a>
          <a href="/artikujt/" class="nav-link active">Artikujt</a>
          <a href="/pelhura/" class="nav-link">Pelhura</a>
          <a href="/rreth-nesh/" class="nav-link">Rreth Nesh</a>
          <a href="/me-shumice/" class="nav-link">Me Shumicë</a>
        </div>
      </div>
      <a href="/" class="navbar-brand">Intal Underwear</a>
      <div class="navbar-right">
        <div class="navbar-search" id="navbar-search" onclick="toggleNavSearch(event)">
          <i class="ri-search-line"></i>
          <input type="search" id="navbar-search-input" placeholder="KËRKO" autocomplete="off" onclick="event.stopPropagation()">
        </div>
      </div>
    </div>
  </nav>

  <!-- Menu drawer -->
  <div class="menu-backdrop" id="menuBackdrop" onclick="closeMenuDrawer()"></div>
  <aside class="menu-drawer" id="menuDrawer" aria-label="Meniu">
    <div class="menu-drawer-header">
      <span class="menu-drawer-brand">Intal <strong>Underwear</strong></span>
      <button class="menu-drawer-close" onclick="closeMenuDrawer()" aria-label="Mbyll"><i class="ri-close-line"></i></button>
    </div>
    <div class="menu-drawer-body">
      <nav class="menu-drawer-nav">
        <a href="/" class="menu-drawer-link" onclick="closeMenuDrawer()">Home</a>
        <a href="/artikujt/" class="menu-drawer-link" onclick="closeMenuDrawer()">Artikujt</a>
        <a href="/pelhura/" class="menu-drawer-link" onclick="closeMenuDrawer()">Pelhura</a>
        <a href="/rreth-nesh/" class="menu-drawer-link" onclick="closeMenuDrawer()">Rreth Nesh</a>
        <a href="/me-shumice/" class="menu-drawer-link" onclick="closeMenuDrawer()">Me Shumicë</a>
      </nav>
      <div class="menu-drawer-divider"></div>
      <p class="menu-drawer-eyebrow">NA KONTAKTONI</p>
      <div class="menu-drawer-contacts">
        <a class="menu-drawer-contact-item" href="tel:+355692776636">
          <div class="menu-drawer-icon"><i class="ri-phone-line"></i></div>
          <div><span class="menu-drawer-label">Telefon / WhatsApp</span><span class="menu-drawer-value">+355 69 277 6636</span></div>
        </a>
        <a class="menu-drawer-contact-item" href="mailto:info@intal.com">
          <div class="menu-drawer-icon"><i class="ri-mail-line"></i></div>
          <div><span class="menu-drawer-label">Email</span><span class="menu-drawer-value">info@intal.com</span></div>
        </a>
      </div>
    </div>
    <div class="menu-drawer-footer">
      <span class="menu-drawer-copy">© <span id="cp-yr-drawer"></span> Intal Albania</span>
    </div>
  </aside>

  <main class="page">
  <div class="page-inner">

    <a href="/artikujt/" class="back-top">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 12L6 8l4-4"/></svg>
      MBRAPA
    </a>

    ${breadcrumbHtml}

    <div class="product-grid">

      <!-- Vertical thumbnails (first in DOM = left column) -->
      ${thumbsHtml ? `<div class="thumbs-col" id="thumbs">${thumbsHtml}</div>` : '<div style="width:clamp(60px,6vw,96px);flex-shrink:0;"></div>'}

      <!-- Gallery -->
      <div class="gallery">
        <div class="main-img-wrap" id="main-img-wrap">
          ${photo
            ? `<img id="main-img" src="${esc(photo)}" alt="${esc(artAlt(art, 0))}" onclick="openLightbox(_idx)" style="cursor:zoom-in;">`
            : `<div class="main-img-placeholder">👕</div>`}
          ${photos.length > 1 ? `
          <button class="gallery-nav prev" onclick="stepPhoto(-1)" aria-label="Para">&#8592;</button>
          <button class="gallery-nav next" onclick="stepPhoto(1)" aria-label="Pas">&#8594;</button>` : ''}
        </div>
      </div>

      <!-- Info -->
      <div class="info">
        ${art.code ? `<p class="info-eyebrow">Art: ${esc(art.code)}</p>` : ''}
        <h1 class="info-name">${title}</h1>
        <div style="height:1px;background:#ebebeb;margin:16px 0 24px;"></div>

        ${sizesHtml}
        ${colorsHtml}
        ${comp ? `<div class="comp-wrap"><div class="section-label">PËRBËRJA</div>${comp}</div>` : ''}

        <div class="cta-group">
          <div class="btn-pair">
            <button class="btn-kerkese" onclick="openOrderModal()">NA KONTAKTONI</button>
            <div class="btn-pair-divider"></div>
            <button class="btn-share-half" onclick="doShare()" aria-label="Share">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
            <div class="btn-pair-divider"></div>
            <a href="https://wa.me/355692776636?text=Pershendetje%2C%20jam%20i%20interesuar%20per%20artikullin%3A%20${encodeURIComponent(art.name||'')}" class="btn-wa-half" target="_blank" rel="noopener" aria-label="WhatsApp">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
          </div>
        ${(() => {
          const pts = (art.pershkrim && art.pershkrim.length ? art.pershkrim : null)
                   || (art.code && _pershkrimMap[art.code])
                   || null;
          if (!pts || !pts.length) return '';
          return `<div class="art-pershkrim"><ul>${pts.map(b=>`<li>${esc(b)}</li>`).join('')}</ul></div>`;
        })()}
        </div>
      </div>

    </div>
  </div>
  </div>

  <!-- Lightbox -->
  <div class="lightbox" id="lightbox" onclick="closeLightbox(event)">
    <button class="lightbox-close" onclick="closeLightbox()">&times;</button>
    <button class="lightbox-prev" onclick="lbStep(-1);event.stopPropagation()">&#8592;</button>
    <img class="lightbox-img" id="lb-img" src="" alt="">
    <button class="lightbox-next" onclick="lbStep(1);event.stopPropagation()">&#8594;</button>
  </div>

  <!-- Suggestions carousel -->
  ${(suggestions && suggestions.length) ? `<section class="suggestions">
    <p class="suggestions-title">Artikuj të ngjashëm</p>
    <div class="sugg-carousel" id="sugg-carousel">
      <button class="sugg-arr prev" id="sugg-prev" onclick="suggScroll(-1)" aria-label="Para">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="sugg-track-wrap" id="sugg-wrap">
        <div class="sugg-track" id="sugg-track">
          ${suggestions.map(s => `<a class="sugg-card" href="/artikull/${s.slug}/">
            <div class="sugg-card-img">${s.img ? `<img src="${s.img}" alt="${esc(s.name)}" loading="lazy" draggable="false">` : ''}</div>
            <div class="sugg-card-body">
              <div class="sugg-card-name">${esc(s.name)}</div>
              ${s.code ? `<div class="sugg-card-sub">Art. ${esc(s.code)}</div>` : ''}
            </div>
          </a>`).join('')}
        </div>
      </div>
      <button class="sugg-arr next" id="sugg-next" onclick="suggScroll(1)" aria-label="Pas">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
  </section>` : ''}

  </main>
  <!-- Footer -->
  <footer class="simple-footer">
    <div class="contact-locations">
      <a class="contact-loc" href="https://maps.google.com/?q=Rrobaqep%C3%ABsi+INTAL,+Rruga+Arbanes,+Vaqarr,+Tiran%C3%AB+1035" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;display:block;cursor:pointer;">
        <p class="contact-loc-name">Selia Kryesore</p>
        <p class="contact-loc-addr">Rrobaqepësi INTAL, Rruga Arbanes, Vaqarr, Tiranë 1035</p>
      </a>
      <a class="contact-loc" href="https://maps.google.com/?q=Intal,+Rruga+5+Maji+67%2F1,+Tiran%C3%AB+1032" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;display:block;cursor:pointer;">
        <p class="contact-loc-name">Dyqani</p>
        <p class="contact-loc-addr">Intal, Rruga 5 Maji 67/1, Tiranë 1032</p>
      </a>
    </div>
    <footer class="contact-footer">
      <span class="contact-brand">Intal <strong>UNDERWEAR</strong></span>
      <span class="contact-copy">© <span id="cp-yr"></span> Intal Albania</span>
    </footer>
  </footer>

  <script src="/js/main.js"></script>
  <script src="/js/analytics.js"></script>
  <script>
    (function(){var y=new Date().getFullYear();['cp-yr','cp-yr-drawer'].forEach(function(id){var el=document.getElementById(id);if(el)el.textContent=y;});document.querySelectorAll('.cp-yr').forEach(function(el){el.textContent=y;});})();
    window.toggleNavSearch=function(e){var w=document.getElementById('navbar-search'),inp=document.getElementById('navbar-search-input');if(!w)return;if(!w.classList.contains('open')){w.classList.add('open');setTimeout(function(){inp&&inp.focus();},260);}};
    document.addEventListener('click',function(e){var w=document.getElementById('navbar-search');if(w&&!w.contains(e.target))w.classList.remove('open');});
    document.addEventListener('DOMContentLoaded',function(){var inp=document.getElementById('navbar-search-input');if(inp){inp.addEventListener('keydown',function(e){if(e.key==='Enter'&&inp.value.trim()){window.location.href='/artikujt#kerkim/'+encodeURIComponent(inp.value.trim());}});}});
    try{sessionStorage.setItem('intal_last_art_id','${art.id||''}');}catch(e){}
    var _photos = ${photosJson};
    var _idx = 0;
    function setPhoto(i){
      _idx = ((i % _photos.length) + _photos.length) % _photos.length;
      var img = document.getElementById('main-img');
      if(img){ img.style.opacity='0'; setTimeout(function(){ img.src=_photos[_idx]; img.style.opacity='1'; }, 150); }
      document.querySelectorAll('.thumb').forEach(function(t,ti){ t.classList.toggle('active', ti===_idx); });
    }
    function stepPhoto(d){ setPhoto(_idx+d); }

    // Swipe on main image
    (function(){
      var wrap = document.getElementById('main-img-wrap');
      if(!wrap) return;
      var sx=0, sy=0, moved=false;
      wrap.addEventListener('touchstart',function(e){ sx=e.touches[0].clientX; sy=e.touches[0].clientY; moved=false; },{passive:true});
      wrap.addEventListener('touchmove',function(e){ moved=true; },{passive:true});
      wrap.addEventListener('touchend',function(e){
        if(!moved) return;
        var dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
        if(Math.abs(dx)>Math.abs(dy) && Math.abs(dx)>40){ stepPhoto(dx<0?1:-1); }
      });
    })();

    // Lightbox
    function openLightbox(i){
      _idx = i || 0;
      var lb = document.getElementById('lightbox');
      var lbImg = document.getElementById('lb-img');
      lbImg.src = _photos[_idx] || '';
      lb.classList.add('open');
      document.body.style.overflow='hidden';
    }
    function closeLightbox(e){
      if(e && e.target !== document.getElementById('lightbox') && !e.target.classList.contains('lightbox-close')) return;
      document.getElementById('lightbox').classList.remove('open');
      document.body.style.overflow='';
    }
    function lbStep(d){
      _idx = ((_idx+d) % _photos.length + _photos.length) % _photos.length;
      document.getElementById('lb-img').src = _photos[_idx];
      setPhoto(_idx);
    }
    // Swipe support for lightbox
    (function(){
      var lb = document.getElementById('lightbox');
      var _sx = 0;
      lb.addEventListener('touchstart', function(e){ _sx = e.touches[0].clientX; }, {passive:true});
      lb.addEventListener('touchend', function(e){
        var dx = e.changedTouches[0].clientX - _sx;
        if(Math.abs(dx) > 50) lbStep(dx < 0 ? 1 : -1);
      }, {passive:true});
    })();
    document.addEventListener('keydown', function(e){
      var lb = document.getElementById('lightbox');
      if(!lb.classList.contains('open')) return;
      if(e.key==='Escape') closeLightbox({target:lb});
      if(e.key==='ArrowLeft') lbStep(-1);
      if(e.key==='ArrowRight') lbStep(1);
    });

    // Suggestions carousel
    (function(){
      var track = document.getElementById('sugg-track');
      var wrap = document.getElementById('sugg-wrap');
      if(!track || !wrap) return;
      var pos = 0, GAP = 10;
      function cardW(){ return track.children[0] ? track.children[0].offsetWidth + GAP : wrap.offsetWidth / 4 + GAP; }
      function visCount(){ return Math.round(wrap.offsetWidth / cardW()); }
      function maxPos(){ return Math.max(0, track.children.length - visCount()); }
      function moveTo(p, animated){
        pos = Math.max(0, Math.min(p, maxPos()));
        track.style.transition = animated === false ? 'none' : 'transform .45s cubic-bezier(.4,0,.2,1)';
        track.style.transform = 'translateX(-' + (pos * cardW()) + 'px)';
      }
      window.suggScroll = function(d){ moveTo(pos + d, true); };
      window.addEventListener('resize', function(){ moveTo(pos, false); });

      // Mouse drag (live feedback while dragging)
      var dragStart = null, dragBase = 0, didDrag = false;
      track.addEventListener('mousedown', function(e){
        dragStart = e.clientX; dragBase = pos * cardW(); didDrag = false;
        track.style.transition = 'none';
        e.preventDefault();
      });
      window.addEventListener('mousemove', function(e){
        if(dragStart === null) return;
        var dx = e.clientX - dragStart;
        if(Math.abs(dx) > 4) didDrag = true;
        track.style.transform = 'translateX(-' + Math.max(0, dragBase - dx) + 'px)';
      });
      window.addEventListener('mouseup', function(e){
        if(dragStart === null) return;
        var dx = e.clientX - dragStart;
        dragStart = null;
        if(Math.abs(dx) > 50){ moveTo(pos + (dx < 0 ? 1 : -1), true); }
        else { moveTo(pos, true); }
      });
      track.addEventListener('click', function(e){ if(didDrag){ e.preventDefault(); } }, true);

      // Touch swipe
      var tx = null, tb = 0;
      track.addEventListener('touchstart', function(e){ tx = e.touches[0].clientX; tb = pos * cardW(); track.style.transition='none'; }, {passive:true});
      track.addEventListener('touchmove', function(e){
        if(tx===null) return;
        var dx = e.touches[0].clientX - tx;
        track.style.transform = 'translateX(-' + Math.max(0, tb - dx) + 'px)';
      }, {passive:true});
      track.addEventListener('touchend', function(e){
        if(tx===null) return;
        var dx = e.changedTouches[0].clientX - tx; tx = null;
        if(Math.abs(dx) > 40){ moveTo(pos + (dx < 0 ? 1 : -1), true); }
        else { moveTo(pos, true); }
      }, {passive:true});
    })();
  </script>

  <!-- Order modal -->
  <div class="order-modal" id="order-modal" onclick="if(event.target===this)closeOrderModal()">
    <div class="order-box order-box-wrap">
      <button class="order-close" onclick="closeOrderModal()">&times;</button>
      <h2>Dërgo Kërkesë</h2>
      <div class="order-field">
        <label>EMRI <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#bbb;">(opsional)</span></label>
        <input type="text" id="ord-name" placeholder="Emri juaj">
      </div>
      <div class="order-field">
        <label>TELEFON <span style="color:#C8003E;">*</span></label>
        <input type="tel" id="ord-phone" placeholder="Nr. i telefonit">
      </div>
      <div class="order-field">
        <label>MASA</label>
        <input type="text" id="ord-size" placeholder="p.sh. XL">
      </div>
      <div class="order-field">
        <label>SASIA</label>
        <input type="number" id="ord-qty" placeholder="1" min="1" value="1">
      </div>
      <div class="order-field">
        <label>MESAZH <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#bbb;">(opsional)</span></label>
        <textarea id="ord-msg" rows="3" placeholder="Specifikime shtesë..."></textarea>
      </div>
      <button class="btn-send-order" onclick="sendOrder()">DËRGO KËRKESËN</button>
    </div>
  </div>
  <script>
    var _artName = ${JSON.stringify(art.name||'')};
    function doShare(){
      if(navigator.share){navigator.share({title:_artName,url:window.location.href}).catch(function(){});}
      else{try{navigator.clipboard.writeText(window.location.href);}catch(e){} alert('Linku u kopjua!');}
    }
    function openOrderModal(){ document.getElementById('order-modal').classList.add('open'); document.body.style.overflow='hidden'; }
    function closeOrderModal(){ document.getElementById('order-modal').classList.remove('open'); document.body.style.overflow=''; }
    function sendOrder(){
      var phone = document.getElementById('ord-phone').value.trim();
      if(!phone){ document.getElementById('ord-phone').focus(); return; }
      var name = document.getElementById('ord-name').value.trim();
      var size = document.getElementById('ord-size').value.trim();
      var qty  = document.getElementById('ord-qty').value.trim();
      var msg  = document.getElementById('ord-msg').value.trim();
      var text = 'Porosi e re:\\n';
      text += 'Produkti: ' + _artName + '\\n';
      if(size) text += 'Masa: ' + size + '\\n';
      if(qty)  text += 'Sasia: ' + qty + '\\n';
      if(name) text += 'Emri: ' + name + '\\n';
      text += 'Telefon: ' + phone + '\\n';
      if(msg)  text += 'Shënim: ' + msg;
      window.open('https://wa.me/355692776636?text=' + encodeURIComponent(text), '_blank');
      closeOrderModal();
    }
  </script>
</body>
</html>`;
}

/* ── Fabric page template ────────────────────────────────────── */
function buildFabricMetaDesc(fab) {
  const pts = (fab.pershkrim && fab.pershkrim.length ? fab.pershkrim : null)
           || (fab.name && _pershkrimPelhuraMap[fab.name])
           || null;
  if (pts && pts.length >= 2) {
    let d = pts[0] + ' ' + pts[1];
    if (d.length > 155) {
      d = d.slice(0, 152);
      const lastSpace = d.lastIndexOf(' ');
      if (lastSpace > 100) d = d.slice(0, lastSpace);
      d += '…';
    }
    return d;
  }
  const mat  = (fab.perberja || [])[0];
  const matStr = mat ? `${mat.material || 'Pambuk'} ${mat.perqindje || mat.pct || mat.value || '100'}%` : '100% Pambuk';
  return `Pelhurë ${fab.name || ''} nga Intal Albania. ${matStr}. Material cilësor për prodhim të brendshmeve, shitje me shumicë.`.replace(/\s{2,}/g, ' ').trim();
}

function fabricHtml(fab, slug, suggestions) {
  const title  = esc(fab.name || 'Pelhurë');
  const rawDesc = buildFabricMetaDesc(fab);
  const desc   = esc(rawDesc);
  const photos = (fab.photos || []).map(p => clImg(typeof p === 'string' ? p : (p.src || p.url || ''), 1200)).filter(Boolean);
  const photosTh = photos.map(p => clImg(p, 200));
  const photo  = photos[0] || '';
  const ogImg  = photo || `${BASE_URL}/og_image.png`;
  const canon  = `${BASE_URL}/pelhura/${slug}/`;
  const ngjyrat = (fab.ngjyrat || []);
  const comp    = (fab.perberja || []).map(p => `<div class="comp-row"><span>${esc(p.material||p.name||'')}</span><span>${esc(String(p.perqindje||p.pct||p.value||''))}%</span></div>`).join('');
  const photosJson = JSON.stringify(photos);

  const thumbsHtml = photos.length > 1
    ? photos.map((src, i) =>
        `<button class="thumb ${i===0?'active':''}" onclick="if(window.innerWidth<=680){openLightbox(${i})}else{setPhoto(${i})}" aria-label="Foto ${i+1}">` +
        `<img src="${esc(photosTh[i]||src)}" alt="${title} foto ${i+1}"></button>`
      ).join('')
    : '';

  const colorsHtml = ngjyrat.length
    ? `<div class="section-label">NGJYRAT</div><div class="colors-row">${ngjyrat.map(c =>
        `<span class="color-dot" style="background:${esc(c.hex||'#ccc')}" title="${esc(c.name||'')}"></span>`
      ).join('')}</div>`
    : '';

  const katVal = fab.kat ? (Array.isArray(fab.kat) ? fab.kat.join(', ') : fab.kat) : '';

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
    "@graph": [
      {
        "@type": "Product",
        "name": "${jesc(fab.name||'')}",
        "description": "${jesc(rawDesc)}",
        "sku": "${jesc(fab.code||slug)}",
        "image": ${photos.length ? JSON.stringify(photos) : `["${jesc(ogImg)}"]`},
        "url": "${BASE_URL}/pelhura/${slug}/",
        "brand": {"@type": "Brand", "name": "Intal Albania"},
        "manufacturer": {
          "@type": "Organization",
          "name": "Intal Albania",
          "url": "${BASE_URL}",
          "address": {"@type": "PostalAddress", "addressLocality": "Tiranë", "addressCountry": "AL"}
        },
        "material": "${jesc(((fab.perberja||[])[0]||{}).material||'Pambuk')} ${jesc(String(((fab.perberja||[])[0]||{}).perqindje||((fab.perberja||[])[0]||{}).pct||((fab.perberja||[])[0]||{}).value||'100'))}%",
        "category": "Pelhurë tekstili",${ngjyrat.length ? `\n        "color": "${jesc(ngjyrat.map(c=>c.name||'').filter(Boolean).join(', '))}",` : ''}
        "offers": {
          "@type": "Offer",
          "availability": "https://schema.org/InStock",
          "seller": {"@type": "Organization", "name": "Intal Albania", "url": "${BASE_URL}"}
        }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {"@type": "ListItem", "position": 1, "name": "Pelhura", "item": "${BASE_URL}/pelhura/"},
          {"@type": "ListItem", "position": 2, "name": "${jesc(fab.name||slug)}", "item": "${BASE_URL}/pelhura/${slug}/"}
        ]
      }
    ]
  }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css">
  <link rel="stylesheet" href="/css/main.css">
  <link rel="icon" type="image/png" href="/favicon.png">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Switzer',sans-serif;background:#fff;color:#0a0a0a;min-height:100vh;padding-top:64px;}
    .page{width:100%;padding:28px 3vw 60px;}
    .page-inner{max-width:1100px;margin:0 auto;}
    .breadcrumb{font-size:14px;color:#555;letter-spacing:0.3px;margin-bottom:10px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;}
    .breadcrumb a{color:#555;text-decoration:none;}
    .breadcrumb a:hover{color:#C8003E;}
    .bc-sep{color:#999;font-weight:300;}
    .product-grid{display:flex;gap:clamp(8px,1.2vw,18px);align-items:flex-start;}
    .thumbs-col{width:clamp(60px,6vw,96px);flex-shrink:0;display:flex;flex-direction:column;gap:6px;}
    .gallery{flex:3;min-width:0;}
    .info{flex:1.6;min-width:0;}
    @media(max-width:900px){.product-grid{gap:8px;} .thumbs-col{width:clamp(52px,5vw,72px);} .gallery{flex:2;} .info{flex:1.4;}}
    @media(max-width:680px){.product-grid{flex-direction:column;gap:0;} .thumbs-col{order:2;width:100%;flex-direction:row;margin-top:8px;gap:6px;} .gallery{order:1;} .info{order:3;margin-top:20px;} .gallery-nav{display:none;}}
    .main-img-wrap{position:relative;background:#f5f5f5;max-height:calc(100vh - 160px);min-height:420px;overflow:hidden;}
    .main-img-wrap img{width:100%;height:auto;display:block;transition:opacity .25s;}
    .main-img-placeholder{width:100%;aspect-ratio:3/4;display:flex;align-items:center;justify-content:center;font-size:72px;color:#ddd;}
    .gallery-nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.9);border:none;width:36px;height:36px;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.12);}
    .gallery-nav.prev{left:10px;} .gallery-nav.next{right:10px;} .gallery-nav:hover{background:#fff;}
    .thumb{border:2px solid transparent;overflow:hidden;width:100%;aspect-ratio:1;cursor:pointer;padding:0;background:none;display:block;transition:border-color .15s;}
    .thumb.active{border-color:#C8003E;}
    .thumb img{width:100%;height:100%;object-fit:cover;display:block;}
    .info-eyebrow{font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#aaa;margin-bottom:6px;}
    .info-name{font-size:20px;font-weight:800;letter-spacing:-0.3px;line-height:1.2;margin-bottom:4px;}
    .section-label{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#aaa;font-weight:700;margin-bottom:10px;margin-top:18px;}
    .chips-row{display:flex;gap:6px;flex-wrap:wrap;}
    .chip{background:#fff;border:1.5px solid #e0e0e0;border-radius:0;padding:5px 10px;font-size:11px;font-weight:600;letter-spacing:0.5px;}
    .colors-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
    .color-dot{width:28px;height:28px;border-radius:50%;border:1px solid rgba(0,0,0,.12);display:inline-block;flex-shrink:0;}
    .comp-wrap{margin-top:14px;}
    .comp-row{display:flex;justify-content:flex-start;gap:14px;align-items:center;padding:3px 0;margin-bottom:2px;font-size:14px;font-weight:400;background:none;}
    .comp-row:last-child{margin-bottom:0;}
    .suggestions{margin:32px 0 0;background:#fff;padding:36px 0 48px;position:relative;}
    .suggestions-title{text-align:center;font-size:13px;letter-spacing:5px;text-transform:uppercase;color:#0a0a0a;font-weight:600;margin-bottom:40px;}
    .sugg-carousel{position:relative;}
    .sugg-track-wrap{overflow:hidden;}
    .sugg-track{display:flex;gap:10px;transition:transform .45s cubic-bezier(.4,0,.2,1);user-select:none;}
    .sugg-card{flex:0 0 25%;min-width:0;text-decoration:none;color:inherit;display:block;cursor:pointer;}
    @media(min-width:1400px){.sugg-card{flex:0 0 16.667%;}}
    @media(min-width:1200px) and (max-width:1399px){.sugg-card{flex:0 0 20%;}}
    @media(max-width:900px){.sugg-card{flex:0 0 33.333%;}}
    @media(max-width:600px){.sugg-card{flex:0 0 50%;}}
    .sugg-card-img{aspect-ratio:1;overflow:hidden;background:#edeae6;}
    .sugg-card-img img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s;}
    .sugg-card:hover .sugg-card-img img{transform:scale(1.03);}
    .sugg-card-body{padding:14px 16px 0;}
    .sugg-card-name{font-size:12px;font-weight:500;line-height:1.45;color:#0a0a0a;}
    .sugg-card-sub{font-size:11px;color:#999;margin-top:2px;}
    .sugg-arr{position:absolute;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;z-index:2;padding:8px;color:#0a0a0a;display:flex;align-items:center;justify-content:center;}
    .sugg-arr.prev{left:10px;} .sugg-arr.next{right:10px;} .sugg-arr svg{width:18px;height:18px;}
    .lightbox{display:none;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9000;align-items:center;justify-content:center;}
    .lightbox.open{display:flex;}
    .lightbox-img{max-width:90vw;max-height:90vh;object-fit:contain;border-radius:4px;}
    .lightbox-close{position:absolute;top:18px;right:22px;background:none;border:none;color:#fff;font-size:32px;cursor:pointer;line-height:1;}
    .lightbox-prev,.lightbox-next{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.12);border:none;color:#fff;width:44px;height:44px;border-radius:50%;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;}
    .lightbox-prev{left:16px;} .lightbox-next{right:16px;}
    .cta-group{display:flex;flex-direction:column;gap:8px;margin-top:18px;padding-top:16px;border-top:1px solid #ebebeb;}
    .btn-pair{display:flex;gap:0;border-radius:0;overflow:hidden;}
    .btn-kerkese{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:#0a0a0a;color:#fff;border:none;cursor:pointer;padding:9px 8px;font-family:inherit;font-weight:700;font-size:10px;letter-spacing:0.8px;text-transform:uppercase;white-space:nowrap;}
    .btn-kerkese:hover{background:#333;}
    .btn-share-half{flex:1;display:flex;align-items:center;justify-content:center;background:#f5f5f5;border:none;cursor:pointer;padding:9px 10px;color:#555;}
    .btn-share-half:hover{background:#e8e8e8;}
    .btn-wa-half{flex:1;display:flex;align-items:center;justify-content:center;background:#fff;color:#25D366;text-decoration:none;padding:9px 10px;}
    .btn-wa-half:hover{background:#f0faf5;}
    .btn-pair-divider{width:1px;background:rgba(0,0,0,.1);flex-shrink:0;}
    .order-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:8000;align-items:flex-end;justify-content:center;}
    .order-modal.open{display:flex;}
    .order-box{background:#fff;width:100%;max-width:480px;border-radius:16px 16px 0 0;padding:28px 24px 36px;max-height:90vh;overflow-y:auto;}
    .order-box h2{font-size:17px;font-weight:800;margin-bottom:20px;}
    .order-field{margin-bottom:14px;}
    .order-field label{display:block;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#888;margin-bottom:5px;}
    .order-field input,.order-field textarea{width:100%;border:1.5px solid #e0e0e0;border-radius:8px;padding:10px 12px;font-size:13px;font-family:inherit;outline:none;resize:none;}
    .order-field input:focus,.order-field textarea:focus{border-color:#C8003E;}
    .btn-send-order{width:100%;background:#C8003E;color:#fff;border:none;border-radius:8px;padding:13px;font-size:13px;font-weight:700;letter-spacing:0.5px;cursor:pointer;margin-top:4px;}
    .btn-send-order:hover{background:#a8002e;}
    .order-close{position:absolute;top:14px;right:18px;background:none;border:none;font-size:22px;cursor:pointer;color:#888;line-height:1;}
    .order-box-wrap{position:relative;}
    .back-top{display:inline-flex;align-items:center;gap:6px;color:#888;font-size:11px;font-weight:600;letter-spacing:0.5px;text-decoration:none;margin-bottom:8px;}
    .back-top:hover{color:#C8003E;}
    .pel-pershkrim{margin-top:20px;padding-top:16px;border-top:1px solid #f0f0f0;}
    .pel-pershkrim ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:7px;}
    .pel-pershkrim li{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#555;line-height:1.5;}
    .pel-pershkrim li::before{content:"•";color:#C8003E;font-size:14px;line-height:1.3;flex-shrink:0;}
  </style>
</head>
<body>

  <!-- Navbar -->
  <nav class="navbar" role="navigation" aria-label="Navigimi kryesor">
    <div class="navbar-inner">
      <div class="navbar-left">
        <button class="nav-hamburger" aria-label="Menu" onclick="openMenuDrawer()">
          <i class="ri-menu-line"></i>
        </button>
        <div class="nav-links">
          <a href="/" class="nav-link">Home</a>
          <a href="/artikujt/" class="nav-link">Artikujt</a>
          <a href="/pelhura/" class="nav-link active">Pelhura</a>
          <a href="/rreth-nesh/" class="nav-link">Rreth Nesh</a>
          <a href="/me-shumice/" class="nav-link">Me Shumicë</a>
        </div>
      </div>
      <a href="/" class="navbar-brand">Intal Underwear</a>
      <div class="navbar-right">
        <div class="navbar-search" id="navbar-search" onclick="toggleNavSearch(event)">
          <i class="ri-search-line"></i>
          <input type="search" id="navbar-search-input" placeholder="KËRKO" autocomplete="off" onclick="event.stopPropagation()">
        </div>
      </div>
    </div>
  </nav>

  <!-- Menu drawer -->
  <div class="menu-backdrop" id="menuBackdrop" onclick="closeMenuDrawer()"></div>
  <aside class="menu-drawer" id="menuDrawer" aria-label="Meniu">
    <div class="menu-drawer-header">
      <span class="menu-drawer-brand">Intal <strong>Underwear</strong></span>
      <button class="menu-drawer-close" onclick="closeMenuDrawer()" aria-label="Mbyll"><i class="ri-close-line"></i></button>
    </div>
    <div class="menu-drawer-body">
      <nav class="menu-drawer-nav">
        <a href="/" class="menu-drawer-link" onclick="closeMenuDrawer()">Home</a>
        <a href="/artikujt/" class="menu-drawer-link" onclick="closeMenuDrawer()">Artikujt</a>
        <a href="/pelhura/" class="menu-drawer-link" onclick="closeMenuDrawer()">Pelhura</a>
        <a href="/rreth-nesh/" class="menu-drawer-link" onclick="closeMenuDrawer()">Rreth Nesh</a>
        <a href="/me-shumice/" class="menu-drawer-link" onclick="closeMenuDrawer()">Me Shumicë</a>
      </nav>
      <div class="menu-drawer-divider"></div>
      <p class="menu-drawer-eyebrow">NA KONTAKTONI</p>
      <div class="menu-drawer-contacts">
        <a class="menu-drawer-contact-item" href="tel:+355692776636">
          <div class="menu-drawer-icon"><i class="ri-phone-line"></i></div>
          <div><span class="menu-drawer-label">Telefon / WhatsApp</span><span class="menu-drawer-value">+355 69 277 6636</span></div>
        </a>
        <a class="menu-drawer-contact-item" href="mailto:info@intal.com">
          <div class="menu-drawer-icon"><i class="ri-mail-line"></i></div>
          <div><span class="menu-drawer-label">Email</span><span class="menu-drawer-value">info@intal.com</span></div>
        </a>
      </div>
    </div>
    <div class="menu-drawer-footer">
      <span class="menu-drawer-copy">© <span id="cp-yr-drawer"></span> Intal Albania</span>
    </div>
  </aside>

  <main class="page">
  <div class="page-inner">

    <a href="/pelhura/" class="back-top">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 12L6 8l4-4"/></svg>
      MBRAPA
    </a>

    <div class="breadcrumb">
      <a href="/pelhura/">PELHURA</a>
      ${katVal ? `<span class="bc-sep">/</span><a href="/pelhura#${encodeURIComponent(katVal.toLowerCase())}">${katVal.toUpperCase()}</a>` : ''}
    </div>

    <div class="product-grid">

      <!-- Vertical thumbnails -->
      ${thumbsHtml ? `<div class="thumbs-col" id="thumbs">${thumbsHtml}</div>` : '<div style="width:clamp(60px,6vw,96px);flex-shrink:0;"></div>'}

      <!-- Gallery -->
      <div class="gallery">
        <div class="main-img-wrap" id="main-img-wrap">
          ${photo
            ? `<img id="main-img" src="${esc(photo)}" alt="${title}" onclick="openLightbox(_idx)" style="cursor:zoom-in;">`
            : `<div class="main-img-placeholder">🧶</div>`}
          ${photos.length > 1 ? `
          <button class="gallery-nav prev" onclick="stepPhoto(-1)" aria-label="Para">&#8592;</button>
          <button class="gallery-nav next" onclick="stepPhoto(1)" aria-label="Pas">&#8594;</button>` : ''}
        </div>
      </div>

      <!-- Info -->
      <div class="info">
        ${fab.code ? `<p class="info-eyebrow">Kodi: ${esc(fab.code)}</p>` : ''}
        <h1 class="info-name">${title}</h1>
        <div style="height:1px;background:#ebebeb;margin:16px 0 24px;"></div>

        ${colorsHtml}
        ${comp ? `<div class="comp-wrap"><div class="section-label">PËRBËRJA</div>${comp}</div>` : ''}

        <div class="cta-group">
          <div class="btn-pair">
            <button class="btn-kerkese" onclick="openOrderModal()">NA KONTAKTONI</button>
            <div class="btn-pair-divider"></div>
            <button class="btn-share-half" onclick="doShare()" aria-label="Share">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
            <div class="btn-pair-divider"></div>
            <a href="https://wa.me/355692776636?text=Pershendetje%2C%20jam%20i%20interesuar%20per%20pelhuren%3A%20${encodeURIComponent(fab.name||'')}" class="btn-wa-half" target="_blank" rel="noopener" aria-label="WhatsApp">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
          </div>
          ${(() => {
            const pts = (fab.name && _pershkrimPelhuraMap[fab.name]) || null;
            if (!pts || !pts.length) return '';
            return `<div class="pel-pershkrim"><ul>${pts.map(b=>`<li>${esc(b)}</li>`).join('')}</ul></div>`;
          })()}
        </div>
      </div>

    </div>
  </div>
  </div>

  <!-- Lightbox -->
  <div class="lightbox" id="lightbox" onclick="closeLightbox(event)">
    <button class="lightbox-close" onclick="closeLightbox()">&times;</button>
    <button class="lightbox-prev" onclick="lbStep(-1);event.stopPropagation()">&#8592;</button>
    <img class="lightbox-img" id="lb-img" src="" alt="">
    <button class="lightbox-next" onclick="lbStep(1);event.stopPropagation()">&#8594;</button>
  </div>

  <!-- Suggestions carousel -->
  ${(suggestions && suggestions.length) ? `<section class="suggestions">
    <p class="suggestions-title">Pelhura të ngjashme</p>
    <div class="sugg-carousel" id="sugg-carousel">
      <button class="sugg-arr prev" id="sugg-prev" onclick="suggScroll(-1)" aria-label="Para">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="sugg-track-wrap" id="sugg-wrap">
        <div class="sugg-track" id="sugg-track">
          ${suggestions.map(s => `<a class="sugg-card" href="/pelhura/${s.slug}/">
            <div class="sugg-card-img">${s.img ? `<img src="${s.img}" alt="${esc(s.name)}" loading="lazy" draggable="false">` : ''}</div>
            <div class="sugg-card-body">
              <div class="sugg-card-name">${esc(s.name)}</div>
              ${s.code ? `<div class="sugg-card-sub">${esc(s.code)}</div>` : ''}
            </div>
          </a>`).join('')}
        </div>
      </div>
      <button class="sugg-arr next" id="sugg-next" onclick="suggScroll(1)" aria-label="Pas">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
  </section>` : ''}

  </main>
  <!-- Footer -->
  <footer class="simple-footer">
    <div class="contact-locations">
      <a class="contact-loc" href="https://maps.google.com/?q=Rrobaqep%C3%ABsi+INTAL,+Rruga+Arbanes,+Vaqarr,+Tiran%C3%AB+1035" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;display:block;cursor:pointer;">
        <p class="contact-loc-name">Selia Kryesore</p>
        <p class="contact-loc-addr">Rrobaqepësi INTAL, Rruga Arbanes, Vaqarr, Tiranë 1035</p>
      </a>
      <a class="contact-loc" href="https://maps.google.com/?q=Intal,+Rruga+5+Maji+67%2F1,+Tiran%C3%AB+1032" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;display:block;cursor:pointer;">
        <p class="contact-loc-name">Dyqani</p>
        <p class="contact-loc-addr">Intal, Rruga 5 Maji 67/1, Tiranë 1032</p>
      </a>
    </div>
    <footer class="contact-footer">
      <span class="contact-brand">Intal <strong>UNDERWEAR</strong></span>
      <span class="contact-copy">© <span id="cp-yr"></span> Intal Albania</span>
    </footer>
  </footer>

  <script src="/js/main.js"></script>
  <script src="/js/analytics.js"></script>
  <script>
    (function(){var y=new Date().getFullYear();['cp-yr','cp-yr-drawer'].forEach(function(id){var el=document.getElementById(id);if(el)el.textContent=y;});document.querySelectorAll('.cp-yr').forEach(function(el){el.textContent=y;});})();
    window.toggleNavSearch=function(e){var w=document.getElementById('navbar-search'),inp=document.getElementById('navbar-search-input');if(!w)return;if(!w.classList.contains('open')){w.classList.add('open');setTimeout(function(){inp&&inp.focus();},260);}};
    document.addEventListener('click',function(e){var w=document.getElementById('navbar-search');if(w&&!w.contains(e.target))w.classList.remove('open');});
    document.addEventListener('DOMContentLoaded',function(){var inp=document.getElementById('navbar-search-input');if(inp){inp.addEventListener('keydown',function(e){if(e.key==='Enter'&&inp.value.trim()){window.location.href='/pelhura#kerkim/'+encodeURIComponent(inp.value.trim());}});}});
    var _photos = ${photosJson};
    var _idx = 0;
    function setPhoto(i){
      _idx = ((i % _photos.length) + _photos.length) % _photos.length;
      var img = document.getElementById('main-img');
      if(img){ img.style.opacity='0'; setTimeout(function(){ img.src=_photos[_idx]; img.style.opacity='1'; }, 150); }
      document.querySelectorAll('.thumb').forEach(function(t,ti){ t.classList.toggle('active', ti===_idx); });
    }
    function stepPhoto(d){ setPhoto(_idx+d); }
    (function(){
      var wrap = document.getElementById('main-img-wrap');
      if(!wrap) return;
      var sx=0, sy=0, moved=false;
      wrap.addEventListener('touchstart',function(e){ sx=e.touches[0].clientX; sy=e.touches[0].clientY; moved=false; },{passive:true});
      wrap.addEventListener('touchmove',function(e){ moved=true; },{passive:true});
      wrap.addEventListener('touchend',function(e){
        if(!moved) return;
        var dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
        if(Math.abs(dx)>Math.abs(dy) && Math.abs(dx)>40){ stepPhoto(dx<0?1:-1); }
      });
    })();
    function openLightbox(i){
      _idx = i || 0;
      var lb = document.getElementById('lightbox');
      var lbImg = document.getElementById('lb-img');
      lbImg.src = _photos[_idx] || '';
      lb.classList.add('open');
      document.body.style.overflow='hidden';
    }
    function closeLightbox(e){
      if(e && e.target !== document.getElementById('lightbox') && !e.target.classList.contains('lightbox-close')) return;
      document.getElementById('lightbox').classList.remove('open');
      document.body.style.overflow='';
    }
    function lbStep(d){
      _idx = ((_idx+d) % _photos.length + _photos.length) % _photos.length;
      document.getElementById('lb-img').src = _photos[_idx];
      setPhoto(_idx);
    }
    (function(){
      var lb = document.getElementById('lightbox');
      var _sx = 0;
      lb.addEventListener('touchstart', function(e){ _sx = e.touches[0].clientX; }, {passive:true});
      lb.addEventListener('touchend', function(e){
        var dx = e.changedTouches[0].clientX - _sx;
        if(Math.abs(dx) > 50) lbStep(dx < 0 ? 1 : -1);
      }, {passive:true});
    })();
    document.addEventListener('keydown', function(e){
      var lb = document.getElementById('lightbox');
      if(!lb.classList.contains('open')) return;
      if(e.key==='Escape') closeLightbox({target:lb});
      if(e.key==='ArrowLeft') lbStep(-1);
      if(e.key==='ArrowRight') lbStep(1);
    });
    (function(){
      var track = document.getElementById('sugg-track');
      var wrap = document.getElementById('sugg-wrap');
      if(!track || !wrap) return;
      var pos = 0, GAP = 10;
      function cardW(){ return track.children[0] ? track.children[0].offsetWidth + GAP : wrap.offsetWidth / 4 + GAP; }
      function visCount(){ return Math.round(wrap.offsetWidth / cardW()); }
      function maxPos(){ return Math.max(0, track.children.length - visCount()); }
      function moveTo(p, animated){
        pos = Math.max(0, Math.min(p, maxPos()));
        track.style.transition = animated === false ? 'none' : 'transform .45s cubic-bezier(.4,0,.2,1)';
        track.style.transform = 'translateX(-' + (pos * cardW()) + 'px)';
      }
      window.suggScroll = function(d){ moveTo(pos + d, true); };
      window.addEventListener('resize', function(){ moveTo(pos, false); });
      var dragStart = null, dragBase = 0, didDrag = false;
      track.addEventListener('mousedown', function(e){ dragStart = e.clientX; dragBase = pos * cardW(); didDrag = false; track.style.transition = 'none'; e.preventDefault(); });
      window.addEventListener('mousemove', function(e){ if(dragStart === null) return; var dx = e.clientX - dragStart; if(Math.abs(dx) > 4) didDrag = true; track.style.transform = 'translateX(-' + Math.max(0, dragBase - dx) + 'px)'; });
      window.addEventListener('mouseup', function(e){ if(dragStart === null) return; var dx = e.clientX - dragStart; dragStart = null; if(Math.abs(dx) > 50){ moveTo(pos + (dx < 0 ? 1 : -1), true); } else { moveTo(pos, true); } });
      track.addEventListener('click', function(e){ if(didDrag){ e.preventDefault(); } }, true);
      var tx = null, tb = 0;
      track.addEventListener('touchstart', function(e){ tx = e.touches[0].clientX; tb = pos * cardW(); track.style.transition='none'; }, {passive:true});
      track.addEventListener('touchmove', function(e){ if(tx===null) return; var dx = e.touches[0].clientX - tx; track.style.transform = 'translateX(-' + Math.max(0, tb - dx) + 'px)'; }, {passive:true});
      track.addEventListener('touchend', function(e){ if(tx===null) return; var dx = e.changedTouches[0].clientX - tx; tx = null; if(Math.abs(dx) > 40){ moveTo(pos + (dx < 0 ? 1 : -1), true); } else { moveTo(pos, true); } }, {passive:true});
    })();
  </script>

  <!-- Order modal -->
  <div class="order-modal" id="order-modal" onclick="if(event.target===this)closeOrderModal()">
    <div class="order-box order-box-wrap">
      <button class="order-close" onclick="closeOrderModal()">&times;</button>
      <h2>Dërgo Kërkesë</h2>
      <div class="order-field">
        <label>EMRI <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#bbb;">(opsional)</span></label>
        <input type="text" id="ord-name" placeholder="Emri juaj">
      </div>
      <div class="order-field">
        <label>TELEFON <span style="color:#C8003E;">*</span></label>
        <input type="tel" id="ord-phone" placeholder="Nr. i telefonit">
      </div>
      <div class="order-field">
        <label>SASIA</label>
        <input type="number" id="ord-qty" placeholder="1" min="1" value="1">
      </div>
      <div class="order-field">
        <label>MESAZH <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#bbb;">(opsional)</span></label>
        <textarea id="ord-msg" rows="3" placeholder="Specifikime shtesë..."></textarea>
      </div>
      <button class="btn-send-order" onclick="sendOrder()">DËRGO KËRKESËN</button>
    </div>
  </div>
  <script>
    var _pelName = ${JSON.stringify(fab.name||'')};
    function doShare(){
      if(navigator.share){navigator.share({title:_pelName,url:window.location.href}).catch(function(){});}
      else{try{navigator.clipboard.writeText(window.location.href);}catch(e){} alert('Linku u kopjua!');}
    }
    function openOrderModal(){ document.getElementById('order-modal').classList.add('open'); document.body.style.overflow='hidden'; }
    function closeOrderModal(){ document.getElementById('order-modal').classList.remove('open'); document.body.style.overflow=''; }
    function sendOrder(){
      var phone = document.getElementById('ord-phone').value.trim();
      if(!phone){ document.getElementById('ord-phone').focus(); return; }
      var name = document.getElementById('ord-name').value.trim();
      var qty  = document.getElementById('ord-qty').value.trim();
      var msg  = document.getElementById('ord-msg').value.trim();
      var text = 'Kerkese per pelhure:\\n';
      text += 'Pelhura: ' + _pelName + '\\n';
      if(qty)  text += 'Sasia: ' + qty + '\\n';
      if(name) text += 'Emri: ' + name + '\\n';
      text += 'Telefon: ' + phone + '\\n';
      if(msg)  text += 'Sheenim: ' + msg;
      window.open('https://wa.me/355692776636?text=' + encodeURIComponent(text), '_blank');
      closeOrderModal();
    }
  </script>
</body>
</html>`;
}

/* ── Catalog page shared nav/footer ─────────────────────────── */
function catalogNavFooter(activeLink = 'artikujt') {
  const isActive = (key) => activeLink === key ? ' active' : '';
  return {
    nav: `  <!-- Navbar -->
  <nav class="navbar" role="navigation" aria-label="Navigimi kryesor">
    <div class="navbar-inner">
      <div class="navbar-left">
        <button class="nav-hamburger" aria-label="Menu" onclick="openMenuDrawer()">
          <i class="ri-menu-line"></i>
        </button>
        <div class="nav-links">
          <a href="/" class="nav-link">Home</a>
          <a href="/artikujt/" class="nav-link${isActive('artikujt')}">Artikujt</a>
          <a href="/pelhura/" class="nav-link${isActive('pelhura')}">Pelhura</a>
          <a href="/rreth-nesh/" class="nav-link">Rreth Nesh</a>
          <a href="/me-shumice/" class="nav-link">Me Shumicë</a>
        </div>
      </div>
      <a href="/" class="navbar-brand">Intal Underwear</a>
      <div class="navbar-right">
        <div class="navbar-search" id="navbar-search" onclick="toggleNavSearch(event)">
          <i class="ri-search-line"></i>
          <input type="search" id="navbar-search-input" placeholder="KËRKO" autocomplete="off" onclick="event.stopPropagation()">
        </div>
      </div>
    </div>
  </nav>
  <div class="menu-backdrop" id="menuBackdrop" onclick="closeMenuDrawer()"></div>
  <aside class="menu-drawer" id="menuDrawer" aria-label="Meniu">
    <div class="menu-drawer-header">
      <span class="menu-drawer-brand">Intal <strong>Underwear</strong></span>
      <button class="menu-drawer-close" onclick="closeMenuDrawer()" aria-label="Mbyll"><i class="ri-close-line"></i></button>
    </div>
    <div class="menu-drawer-body">
      <nav class="menu-drawer-nav">
        <a href="/" class="menu-drawer-link" onclick="closeMenuDrawer()">Home</a>
        <a href="/artikujt/" class="menu-drawer-link" onclick="closeMenuDrawer()">Artikujt</a>
        <a href="/pelhura/" class="menu-drawer-link" onclick="closeMenuDrawer()">Pelhura</a>
        <a href="/rreth-nesh/" class="menu-drawer-link" onclick="closeMenuDrawer()">Rreth Nesh</a>
        <a href="/me-shumice/" class="menu-drawer-link" onclick="closeMenuDrawer()">Me Shumicë</a>
      </nav>
      <div class="menu-drawer-divider"></div>
      <p class="menu-drawer-eyebrow">NA KONTAKTONI</p>
      <div class="menu-drawer-contacts">
        <a class="menu-drawer-contact-item" href="tel:+355692776636">
          <div class="menu-drawer-icon"><i class="ri-phone-line"></i></div>
          <div><span class="menu-drawer-label">Telefon / WhatsApp</span><span class="menu-drawer-value">+355 69 277 6636</span></div>
        </a>
        <a class="menu-drawer-contact-item" href="mailto:info@intalal.com">
          <div class="menu-drawer-icon"><i class="ri-mail-line"></i></div>
          <div><span class="menu-drawer-label">Email</span><span class="menu-drawer-value">info@intalal.com</span></div>
        </a>
      </div>
    </div>
    <div class="menu-drawer-footer">
      <span class="menu-drawer-copy">© <span id="cp-yr-drawer"></span> Intal Albania</span>
    </div>
  </aside>`,
    footer: `  <footer class="simple-footer">
    <div class="contact-locations">
      <a class="contact-loc" href="https://maps.google.com/?q=Rrobaqep%C3%ABsi+INTAL,+Rruga+Arbanes,+Vaqarr,+Tiran%C3%AB+1035" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;display:block;cursor:pointer;">
        <p class="contact-loc-name">Selia Kryesore</p>
        <p class="contact-loc-addr">Rrobaqepësi INTAL, Rruga Arbanes, Vaqarr, Tiranë 1035</p>
      </a>
      <a class="contact-loc" href="https://maps.google.com/?q=Intal,+Rruga+5+Maji+67%2F1,+Tiran%C3%AB+1032" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;display:block;cursor:pointer;">
        <p class="contact-loc-name">Pika e shitjes</p>
        <p class="contact-loc-addr">Intal, Rruga 5 Maji 67/1, Tiranë 1032</p>
      </a>
    </div>
    <footer class="contact-footer">
      <span class="contact-brand">Intal <strong>UNDERWEAR</strong></span>
      <span class="contact-copy">© <span id="cp-yr"></span> Intal Albania</span>
    </footer>
  </footer>`,
    script: `  <script src="/js/main.js"></script>
  <script src="/js/analytics.js"></script>
  <script>
    (function(){var y=new Date().getFullYear();['cp-yr','cp-yr-drawer'].forEach(function(id){var el=document.getElementById(id);if(el)el.textContent=y;});})();
    window.toggleNavSearch=function(e){var w=document.getElementById('navbar-search'),inp=document.getElementById('navbar-search-input');if(!w)return;if(!w.classList.contains('open')){w.classList.add('open');setTimeout(function(){inp&&inp.focus();},260);}};
    document.addEventListener('click',function(e){var w=document.getElementById('navbar-search');if(w&&!w.contains(e.target))w.classList.remove('open');});
    document.addEventListener('DOMContentLoaded',function(){var inp=document.getElementById('navbar-search-input');if(inp){inp.addEventListener('keydown',function(e){if(e.key==='Enter'&&inp.value.trim()){window.location.href='/artikujt/#kerkim/'+encodeURIComponent(inp.value.trim());}});}});
  </script>`
  };
}

function catalogCss() {
  return `    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Switzer',sans-serif;background:#fff;color:#0a0a0a;min-height:100vh;padding-top:64px;}
    .cat-page{max-width:1200px;margin:0 auto;padding:28px 20px 80px;}
    .breadcrumb{font-size:13px;color:#555;margin-bottom:16px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;}
    .breadcrumb a{color:#555;text-decoration:none;}
    .breadcrumb a:hover{color:#C8003E;}
    .bc-sep{color:#999;font-weight:300;}
    .cat-h1{font-size:clamp(22px,3vw,32px);font-weight:800;letter-spacing:-0.5px;margin-bottom:12px;}
    .cat-intro{font-size:14px;line-height:1.6;color:#555;max-width:640px;margin-bottom:32px;}
    .cat-sublinks{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:32px;}
    .cat-sublink{padding:7px 14px;border:1.5px solid #e0e0e0;font-size:11px;font-weight:600;letter-spacing:0.5px;text-decoration:none;color:#0a0a0a;text-transform:uppercase;transition:all .15s;}
    .cat-sublink:hover,.cat-sublink.active{background:#0a0a0a;color:#fff;border-color:#0a0a0a;}
    .art-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:28px 20px;}
    @media(max-width:1000px){.art-grid{grid-template-columns:repeat(3,1fr);}}
    @media(max-width:680px){.art-grid{grid-template-columns:repeat(2,1fr);gap:16px 10px;}}
    .art-card{text-decoration:none;color:inherit;display:block;}
    .art-card-img{aspect-ratio:3/4;overflow:hidden;background:#f0f0f0;}
    .art-card-img img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s;}
    .art-card:hover .art-card-img img{transform:scale(1.04);}
    .art-card-body{padding:10px 0 0;}
    .art-card-name{font-size:12px;font-weight:600;line-height:1.4;color:#0a0a0a;}
    .art-card-code{font-size:10px;color:#999;margin-top:3px;}
    .cat-section{margin-top:40px;}
    .cat-section-title{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#aaa;font-weight:700;margin-bottom:20px;padding-bottom:8px;border-bottom:1px solid #f0f0f0;}`;
}

/* ── Catalog page template ───────────────────────────────────── */
function catalogPageHtml(opts) {
  const { title, desc, canon, h1, intro, breadcrumb, sublinks, sections, ldJson } = opts;
  const nf = catalogNavFooter();

  const sublinksHtml = (sublinks && sublinks.length)
    ? `<div class="cat-sublinks">${sublinks.map(sl =>
        `<a href="${esc(sl.href)}" class="cat-sublink${sl.active?' active':''}">${esc(sl.label)}</a>`
      ).join('')}</div>`
    : '';

  let contentHtml = '';
  for (const sec of (sections || [])) {
    const cardsHtml = sec.items.map(item => {
      const img = item.img ? `<img src="${esc(item.img)}" alt="${esc(item.alt||item.name)}" loading="lazy">` : '';
      return `<a class="art-card" href="${esc(item.href)}">
        <div class="art-card-img">${img}</div>
        <div class="art-card-body">
          <div class="art-card-name">${esc(item.name)}</div>
          ${item.code ? `<div class="art-card-code">Art. ${esc(item.code)}</div>` : ''}
        </div>
      </a>`;
    }).join('');
    const secTitle = sec.title ? `<div class="cat-section-title">${esc(sec.title)}</div>` : '';
    const secId = sec.id ? ` id="${sec.id}"` : '';
    contentHtml += `<div class="cat-section"${secId}>${secTitle}<div class="art-grid">${cardsHtml}</div></div>`;
  }

  return `<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${esc(canon)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${esc(canon)}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${BASE_URL}/og_image.png" />
  <meta property="og:site_name" content="Intal Albania" />
  ${ldJson ? `<script type="application/ld+json">\n  ${ldJson}\n  </script>` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css">
  <link rel="stylesheet" href="/css/main.css">
  <link rel="icon" type="image/png" href="/favicon.png">
  <style>
${catalogCss()}
  </style>
</head>
<body>

${nf.nav}

  <main>
    <div class="cat-page">
      <div class="breadcrumb">${breadcrumb || ''}</div>
      <h1 class="cat-h1">${esc(h1)}</h1>
      <p class="cat-intro">${esc(intro)}</p>
      ${sublinksHtml}
      ${contentHtml}
    </div>
  </main>

${nf.footer}
${nf.script}
</body>
</html>`;
}

/* ── Sub/kat normalization maps ──────────────────────────────── */
const SUB_LABELS = {
  meshkuj: 'Meshkuj',
  femra: 'Femra',
  femije: 'Fëmijë',
  'fëmijë': 'Fëmijë',
  stinore: 'Stinore',
};
const SUB_URL = {
  meshkuj: 'meshkuj',
  femra: 'femra',
  femije: 'femije',
  'fëmijë': 'femije',
  stinore: 'stinore',
};
const KAT_LABELS = {
  bluze: 'Bluza',
  fanella: 'Fanella',
  kanatjere: 'Kanatjere',
  'kemisha nate': 'Këmisha nate',
  pizhame: 'Pizhame',
  mbathje: 'Mbathje',
  benevrek: 'Benevrek',
  fustane: 'Fustane',
  'kostume verore': 'Kostume verore',
  bokse: 'Bokse',
  korse: 'Korse',
  tuta: 'Tuta',
};

function normSub(s) { return (s||'').toLowerCase().replace(/ë/g,'e').replace(/ç/g,'c').trim(); }
function normKat(k) { return (k||'').toLowerCase().replace(/ë/g,'e').replace(/ç/g,'c').trim(); }

function getArtSub(art) {
  const s = art.sub;
  if (!s || (Array.isArray(s) && s.length === 0)) return null;
  const raw = Array.isArray(s) ? s[0] : s;
  return normSub(raw);
}

function getArtKat(art) {
  const k = art.kat;
  if (!k || (Array.isArray(k) && k.length === 0)) return null;
  const raw = Array.isArray(k) ? k[0] : k;
  return normKat(raw);
}

/* ── Category page generator ─────────────────────────────────── */
function generateCategoryPages(artEntries) {
  const catUrls = [];

  // Group: sub → kat → entries
  const bySubKat = {};
  for (const entry of artEntries) {
    const sub = getArtSub(entry.art);
    const kat = getArtKat(entry.art);
    if (!sub || !SUB_URL[sub]) continue;
    const subKey = SUB_URL[sub];
    if (!bySubKat[subKey]) bySubKat[subKey] = {};
    const katKey = kat ? slugify(kat) : '__none__';
    if (!bySubKat[subKey][katKey]) bySubKat[subKey][katKey] = { kat, entries: [] };
    bySubKat[subKey][katKey].entries.push(entry);
  }

  // Also group: sub → all entries
  const bySub = {};
  for (const entry of artEntries) {
    const sub = getArtSub(entry.art);
    if (!sub || !SUB_URL[sub]) continue;
    const subKey = SUB_URL[sub];
    if (!bySub[subKey]) bySub[subKey] = [];
    bySub[subKey].push(entry);
  }

  // Generate top-level sub pages: /artikujt/meshkuj/, /artikujt/femra/, /artikujt/femije/
  for (const [subKey, entries] of Object.entries(bySub)) {
    if (entries.length < 2) continue;
    const label = SUB_LABELS[subKey] || subKey;
    const canon = `${BASE_URL}/artikujt/${subKey}/`;
    const title = `Të brendshme për ${label.toLowerCase()} | Intal Albania`;
    const desc = `Koleksioni i plotë i të brendshmeve për ${label.toLowerCase()} — bluza, fanella, kanatjere, mbathje dhe më shumë. Prodhim Intal Albania, shitje me shumicë.`;
    const h1 = `Të brendshme për ${label}`;
    const intro = `Koleksioni i të brendshmeve për ${label.toLowerCase()} prodhuar nga Intal Albania — fabrikë shqiptare me mbi 30 vite eksperiencë. Pambuk 100%, disponibël me shumicë.`;

    // Build sub-category links (only those with ≥2 products)
    const sublinks = [];
    const katKeys = Object.keys(bySubKat[subKey] || {}).filter(k => k !== '__none__' && bySubKat[subKey][k].entries.length >= 2);
    for (const katKey of katKeys) {
      const { kat } = bySubKat[subKey][katKey];
      const katLabel = KAT_LABELS[kat] || (kat ? kat.charAt(0).toUpperCase() + kat.slice(1) : katKey);
      sublinks.push({ href: `/artikujt/${subKey}/${katKey}/`, label: katLabel });
    }

    // Sections: group by kat
    const sections = [];
    const orderedKats = [...katKeys, '__none__'].filter(k => bySubKat[subKey] && bySubKat[subKey][k] && bySubKat[subKey][k].entries.length >= 1);
    for (const katKey of orderedKats) {
      if (!bySubKat[subKey] || !bySubKat[subKey][katKey]) continue;
      const { kat, entries: katEntries } = bySubKat[subKey][katKey];
      const katLabel = kat ? (KAT_LABELS[kat] || (kat.charAt(0).toUpperCase() + kat.slice(1))) : '';
      sections.push({
        title: katLabel,
        items: katEntries.map(e => ({
          href: `/artikull/${e.slug}/`,
          name: e.art.name || '',
          code: e.art.code || '',
          img: clImg(photoUrl((e.art.photos || [])[0]), 400),
          alt: artAlt(e.art, 0),
        }))
      });
    }

    const breadcrumb = `<a href="/artikujt/">ARTIKUJT</a><span class="bc-sep">/</span><span>${label.toUpperCase()}</span>`;
    const subLdJson = JSON.stringify({"@context":"https://schema.org","@graph":[{"@type":"CollectionPage","name":title,"description":desc,"url":canon},{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Artikujt","item":`${BASE_URL}/artikujt/`},{"@type":"ListItem","position":2,"name":label,"item":canon}]}]});
    const html = catalogPageHtml({ title, desc, canon, h1, intro, breadcrumb, sublinks, sections, ldJson: subLdJson });
    const dir = path.join(ROOT, 'artikujt', subKey);
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
    catUrls.push({ loc: canon, priority: '0.75' });
    console.log(`  Category: /artikujt/${subKey}/  (${entries.length} art.)`);

    // Generate sub-category pages: /artikujt/meshkuj/bluze/, etc.
    for (const katKey of katKeys) {
      const { kat, entries: katEntries } = bySubKat[subKey][katKey];
      if (katEntries.length < 2) continue;
      const katLabel = KAT_LABELS[kat] || (kat ? kat.charAt(0).toUpperCase() + kat.slice(1) : katKey);
      const katCanon = `${BASE_URL}/artikujt/${subKey}/${katKey}/`;
      const katTitle = `${katLabel} pambuku për ${label.toLowerCase()} me shumicë | Intal Albania`;
      const katDesc = `${katLabel} pambuku për ${label.toLowerCase()} — prodhim Intal Albania, Tiranë. Cilësi e lartë, shitje me shumicë, masa të plota.`;
      const katH1 = `${katLabel} për ${label}`;
      const katIntro = `${katLabel} pambuku për ${label.toLowerCase()} prodhuar nga fabrika Intal Albania. Disponibël me shumicë, direkt nga prodhuesi.`;
      const katBreadcrumb = `<a href="/artikujt/">ARTIKUJT</a><span class="bc-sep">/</span><a href="/artikujt/${subKey}/">${label.toUpperCase()}</a><span class="bc-sep">/</span><span>${katLabel.toUpperCase()}</span>`;
      const katLdJson = JSON.stringify({"@context":"https://schema.org","@graph":[{"@type":"CollectionPage","name":katTitle,"description":katDesc,"url":katCanon},{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Artikujt","item":`${BASE_URL}/artikujt/`},{"@type":"ListItem","position":2,"name":label,"item":`${BASE_URL}/artikujt/${subKey}/`},{"@type":"ListItem","position":3,"name":katLabel,"item":katCanon}]}]});
      const katHtml = catalogPageHtml({
        title: katTitle,
        desc: katDesc,
        canon: katCanon,
        h1: katH1,
        intro: katIntro,
        breadcrumb: katBreadcrumb,
        sublinks: [],
        ldJson: katLdJson,
        sections: [{ title: '', items: katEntries.map(e => ({
          href: `/artikull/${e.slug}/`,
          name: e.art.name || '',
          code: e.art.code || '',
          img: clImg(photoUrl((e.art.photos || [])[0]), 400),
          alt: artAlt(e.art, 0),
        }))}],
      });
      const katDir = path.join(ROOT, 'artikujt', subKey, katKey);
      ensureDir(katDir);
      fs.writeFileSync(path.join(katDir, 'index.html'), katHtml, 'utf8');
      catUrls.push({ loc: katCanon, priority: '0.70' });
      console.log(`    Sub-cat: /artikujt/${subKey}/${katKey}/  (${katEntries.length} art.)`);
    }
  }

  return catUrls;
}

/* ── Artikujt catalog page ───────────────────────────────────── */
function generateArtikujtPage(artEntries) {
  const canon = `${BASE_URL}/artikujt/`;
  const title = 'Artikujt — Koleksioni i të brendshmeve | Intal Albania';
  const desc = 'Koleksioni i plotë i të brendshmeve Intal Albania — Meshkuj, Femra, Fëmijë. Pambuk 100%, shitje me shumicë direkt nga fabrika shqiptare.';
  const h1 = 'Koleksioni i të brendshmeve';
  const intro = 'Të gjitha artikujt e Intal Albania — bluza, fanella, kanatjere, mbathje dhe more. Prodhim shqiptar me mbi 30 vite eksperiencë, pambuk 100%, shitje me shumicë.';

  const sublinks = [
    { href: '/artikujt/meshkuj/', label: 'Meshkuj' },
    { href: '/artikujt/femra/', label: 'Femra' },
    { href: '/artikujt/femije/', label: 'Fëmijë' },
    { href: '#sec-stinore', label: 'Stinore' },
  ];

  // Group by sub for sections
  const groups = {};
  for (const entry of artEntries) {
    const sub = getArtSub(entry.art);
    const subKey = (sub && SUB_URL[sub]) ? SUB_URL[sub] : 'tjera';
    const label = SUB_LABELS[subKey] || SUB_LABELS[sub] || subKey;
    if (!groups[subKey]) groups[subKey] = { label, items: [] };
    groups[subKey].items.push(entry);
  }

  const orderedSubs = ['meshkuj', 'femra', 'femije', 'stinore', 'tjera'];
  const sections = [];
  for (const subKey of orderedSubs) {
    if (!groups[subKey] || groups[subKey].items.length === 0) continue;
    sections.push({
      title: groups[subKey].label,
      id: subKey === 'stinore' ? 'sec-stinore' : undefined,
      items: groups[subKey].items.map(e => ({
        href: `/artikull/${e.slug}/`,
        name: e.art.name || '',
        code: e.art.code || '',
        img: clImg(photoUrl((e.art.photos || [])[0]), 400),
        alt: artAlt(e.art, 0),
      }))
    });
  }

  const breadcrumb = `<span>ARTIKUJT</span>`;
  const artLdJson = JSON.stringify({"@context":"https://schema.org","@graph":[{"@type":"CollectionPage","name":title,"description":desc,"url":canon},{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Artikujt","item":canon}]}]});
  const html = catalogPageHtml({ title, desc, canon, h1, intro, breadcrumb, sublinks, sections, ldJson: artLdJson });
  const dir = path.join(ROOT, 'artikujt');
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  console.log(`Generated /artikujt/index.html (${artEntries.length} artikuj)`);
}

/* ── Pelhura catalog page ────────────────────────────────────── */
function generatePelhuraPage(pelEntries) {
  const canon = `${BASE_URL}/pelhura/`;
  const title = 'Pelhura — Materialet e prodhimit | Intal Albania';
  const desc = 'Pelhurat e Intal Albania: ribana 30/1 dhe suprem print. Material pambuku natyral për prodhim të brendshmeve cilësore. Shitje me shumicë.';
  const h1 = 'Pelhurat e prodhimit';
  const intro = 'Materialet tona — ribana pambuku 30/1 dhe suprem print — janë baza e çdo artikulli Intal. Disponibël me shumicë për qepësi dhe prodhues.';
  const nf = catalogNavFooter('pelhura');

  const cardsHtml = pelEntries.map(({ fab, slug }) => {
    const img = clImg(photoUrl((fab.photos || [])[0]), 400);
    return `<a class="art-card" href="/pelhura/${slug}/">
      <div class="art-card-img">${img ? `<img src="${esc(img)}" alt="${esc(fab.name||'')}" loading="lazy">` : ''}</div>
      <div class="art-card-body">
        <div class="art-card-name">${esc(fab.name||'')}</div>
        ${fab.code ? `<div class="art-card-code">${esc(fab.code)}</div>` : ''}
      </div>
    </a>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${canon}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${canon}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${BASE_URL}/og_image.png" />
  <meta property="og:site_name" content="Intal Albania" />
  <script type="application/ld+json">
  {"@context":"https://schema.org","@graph":[{"@type":"CollectionPage","name":"${jesc(title)}","description":"${jesc(desc)}","url":"${canon}"},{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Pelhura","item":"${canon}"}]}]}
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css">
  <link rel="stylesheet" href="/css/main.css">
  <link rel="icon" type="image/png" href="/favicon.png">
  <style>
${catalogCss()}
  </style>
</head>
<body>
${nf.nav}
  <main>
    <div class="cat-page">
      <div class="breadcrumb"><span>PELHURA</span></div>
      <h1 class="cat-h1">${esc(h1)}</h1>
      <p class="cat-intro">${esc(intro)}</p>
      <div class="cat-section"><div class="art-grid">${cardsHtml}</div></div>
    </div>
  </main>
${nf.footer}
${nf.script}
</body>
</html>`;

  fs.writeFileSync(path.join(ROOT, 'pelhura', 'index.html'), html, 'utf8');
  console.log(`Generated /pelhura/index.html (${pelEntries.length} pelhura)`);
}

/* ── Homepage static showcase inject ────────────────────────── */
function injectHomepageShowcase(artEntries) {
  const idxPath = path.join(ROOT, 'index.html');
  let src = fs.readFileSync(idxPath, 'utf8');

  // Pick up to 12 featured articles: 4 meshkuj + 4 femra + 4 femije
  const pick = (sub, n) => artEntries
    .filter(e => { const s = getArtSub(e.art); return s && SUB_URL[s] === sub; })
    .slice(0, n);
  const featured = [...pick('meshkuj', 4), ...pick('femra', 4), ...pick('femije', 4)];

  const cardsHtml = featured.map(({ art, slug }) => {
    const img = clImg(photoUrl((art.photos || [])[0]), 600);
    const imgTag = img ? `<img src="${esc(img)}" alt="${esc(artAlt(art, 0))}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;">` : '';
    const sub = getArtSub(art);
    const subLabel = (sub && SUB_LABELS[SUB_URL[sub]]) || '';
    return `      <a href="/artikull/${slug}/" class="showcase-card" style="text-decoration:none;color:inherit;display:block;">
        <div style="aspect-ratio:3/4;overflow:hidden;background:#f0f0f0;">${imgTag}</div>
        <div style="padding:10px 0 0;">
          <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">${esc(subLabel)}</div>
          <div style="font-size:13px;font-weight:600;">${esc(art.name||'')}</div>
        </div>
      </a>`;
  }).join('\n');

  const staticBlock = `\n      <!-- static-showcase-start -->\n${cardsHtml}\n      <!-- static-showcase-end -->`;

  // Replace existing static block or the placeholder comment
  if (src.includes('<!-- static-showcase-start -->')) {
    src = src.replace(/<!-- static-showcase-start -->[\s\S]*?<!-- static-showcase-end -->/, staticBlock.trim());
  } else {
    src = src.replace('<!-- rendered dynamically -->', staticBlock);
  }

  fs.writeFileSync(idxPath, src, 'utf8');
  console.log(`Injected ${featured.length} static products into homepage showcase`);
}

/* ── Old slug redirect map ───────────────────────────────────── */
const ART_REDIRECTS = {
  'kanatjere-crz-318':      'kanatjere-crz-318-e-bardhe',
  'kanatjere-lovly-301-2':  'kanatjere-lovly-301-bezhe',
  'kanatjere-riga-316-1':   'kanatjere-riga-316-e-zeze',
  'kanatjere-stela-140-1':  'kanatjere-stela-140-bezhe',
  'kanatjere-stela-140-2':  'kanatjere-stela-140-e-zeze',
  'kemisha-lovly-502-1':    'kemisha-lovly-502-bezhe',
  'bokse-stela-136-1':      'bokse-stela-136-bezhe',
  'bokse-stela-136-2':      'bokse-stela-136-e-zeze',
  'mbathje-crz-101-1':      'mbathje-crz-101-bezhe',
};

function redirectHtml(newUrl) {
  return `<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="UTF-8">
  <meta name="robots" content="noindex,nofollow">
  <meta http-equiv="refresh" content="0; url=${newUrl}">
  <link rel="canonical" href="${newUrl}">
  <title>Ridrejtim — Intal Albania</title>
</head>
<body>
  <p>Faqja u zhvendos. <a href="${newUrl}">Kliko këtu</a> nëse nuk ridrejtohet automatikisht.</p>
</body>
</html>`;
}

/* ── Generate redirect pages ─────────────────────────────────── */
function generateRedirects(newArtSlugSet, pelEntries) {
  let count = 0;
  // Article old-slug redirects
  for (const [oldSlug, newSlug] of Object.entries(ART_REDIRECTS)) {
    if (!newArtSlugSet.has(newSlug)) {
      console.warn(`  ⚠ Redirect target not found: /artikull/${newSlug}/`);
      continue;
    }
    const dir = path.join(ROOT, 'artikull', oldSlug);
    if (!fs.existsSync(dir)) {
      ensureDir(dir);
      fs.writeFileSync(path.join(dir, 'index.html'), redirectHtml(`${BASE_URL}/artikull/${newSlug}/`), 'utf8');
      count++;
    }
  }

  // Pelhura duplicate redirects: slugs ending in -N where base exists
  const pelCanonicals = new Set();
  const pelDups = [];
  for (const { slug } of pelEntries) {
    const m = slug.match(/^(.+)-(\d+)$/);
    if (m && pelEntries.some(e => e.slug === m[1])) {
      pelDups.push({ dup: slug, canonical: m[1] });
    } else {
      pelCanonicals.add(slug);
    }
  }
  for (const { dup, canonical } of pelDups) {
    const dir = path.join(ROOT, 'pelhura', dup);
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), redirectHtml(`${BASE_URL}/pelhura/${canonical}/`), 'utf8');
    count++;
  }

  console.log(`Generated ${count} redirect pages`);
  return { pelDups };
}

/* ── 404.html ────────────────────────────────────────────────── */
function generate404() {
  const nf = catalogNavFooter();
  const html = `<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,nofollow">
  <title>Faqja nuk u gjet — Intal Albania</title>
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css">
  <link rel="icon" type="image/png" href="/favicon.png">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Switzer',sans-serif;background:#fff;color:#0a0a0a;min-height:100vh;padding-top:64px;}
    .err-page{max-width:600px;margin:80px auto;padding:0 24px;text-align:center;}
    .err-code{font-size:96px;font-weight:900;color:#f0f0f0;line-height:1;margin-bottom:16px;}
    .err-title{font-size:24px;font-weight:700;margin-bottom:12px;}
    .err-desc{font-size:14px;color:#666;line-height:1.6;margin-bottom:36px;}
    .err-links{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;}
    .err-link{padding:10px 20px;border:1.5px solid #e0e0e0;font-size:12px;font-weight:600;letter-spacing:0.5px;text-decoration:none;color:#0a0a0a;text-transform:uppercase;transition:all .15s;}
    .err-link:hover{background:#0a0a0a;color:#fff;border-color:#0a0a0a;}
    .err-link.primary{background:#0a0a0a;color:#fff;border-color:#0a0a0a;}
    .err-link.primary:hover{background:#333;}
  </style>
</head>
<body>
${nf.nav}
  <main>
    <div class="err-page">
      <div class="err-code">404</div>
      <h1 class="err-title">Faqja nuk u gjet</h1>
      <p class="err-desc">Faqja që kërkoni nuk ekziston ose është zhvendosur. Provoni të navigoni nga menuja ose shkoni te katalogu i artikujve.</p>
      <div class="err-links">
        <a href="/" class="err-link">Ballina</a>
        <a href="/artikujt/" class="err-link primary">Artikujt</a>
        <a href="/pelhura/" class="err-link">Pelhura</a>
        <a href="/rreth-nesh/" class="err-link">Rreth Nesh</a>
        <a href="/artikujt/meshkuj/" class="err-link">Meshkuj</a>
        <a href="/artikujt/femra/" class="err-link">Femra</a>
        <a href="/artikujt/femije/" class="err-link">Fëmijë</a>
      </div>
    </div>
  </main>
${nf.footer}
${nf.script}
</body>
</html>`;
  fs.writeFileSync(path.join(ROOT, '404.html'), html, 'utf8');
  console.log('Generated 404.html');
}

/* ── Sitemap ─────────────────────────────────────────────────── */
function buildSitemap(artEntries, pelEntries, catUrls, pelDups) {
  const pelDupSlugs = new Set((pelDups || []).map(d => d.dup));

  const staticUrls = [
    { loc: `${BASE_URL}/`,             lastmod: TODAY, priority: '1.0' },
    { loc: `${BASE_URL}/artikujt/`,   lastmod: TODAY, priority: '0.9' },
    { loc: `${BASE_URL}/pelhura/`,    lastmod: TODAY, priority: '0.8' },
    { loc: `${BASE_URL}/rreth-nesh/`,  lastmod: TODAY, priority: '0.7' },
    { loc: `${BASE_URL}/me-shumice/`, lastmod: TODAY, priority: '0.8' },
  ];

  // Category URLs with lastmod
  const catUrlsWithDate = (catUrls || []).map(u => ({ ...u, lastmod: TODAY }));

  // Article URLs: no lastmod (no updatedAt in Firestore), with image:image
  const artUrls = artEntries.map(({ art, slug }) => {
    const img = clImg(photoUrl((art.photos || [])[0]), 1200);
    const imgBlock = img ? `\n    <image:image>\n      <image:loc>${esc(img)}</image:loc>\n      <image:title>${esc(art.name||slug)}</image:title>\n    </image:image>` : '';
    return { loc: `${BASE_URL}/artikull/${slug}/`, priority: '0.6', imgBlock };
  });

  // Fabric URLs: no lastmod, no duplicates
  const pelUrls = pelEntries
    .filter(({ slug }) => !pelDupSlugs.has(slug))
    .map(({ fab, slug }) => {
      const img = clImg(photoUrl((fab.photos || [])[0]), 1200);
      const imgBlock = img ? `\n    <image:image>\n      <image:loc>${esc(img)}</image:loc>\n      <image:title>${esc(fab.name||slug)}</image:title>\n    </image:image>` : '';
      return { loc: `${BASE_URL}/pelhura/${slug}/`, priority: '0.5', imgBlock };
    });

  const rows = [
    ...staticUrls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`),
    ...catUrlsWithDate.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`),
    ...artUrls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <priority>${u.priority}</priority>${u.imgBlock}\n  </url>`),
    ...pelUrls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <priority>${u.priority}</priority>${u.imgBlock}\n  </url>`),
  ].join('\n\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

${rows}

</urlset>
`;
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

  // Pre-count how many articles share the same code (to know if color suffix needed)
  const codeCounts = {};
  for (const art of artikujt) {
    if (art.code) codeCounts[art.code] = (codeCounts[art.code] || 0) + 1;
  }

  // Build slug map for all articles first (needed for suggestions)
  const artEntries = [];
  for (const art of artikujt) {
    if (!art.name) continue;
    const base = slugify(art.name + (art.code ? '-' + art.code : ''));
    // Use color name in slug when colorIndex is set AND article has multiple variants
    let colorSuffix = '';
    const hasVariants = art.code && (codeCounts[art.code] || 0) > 1;
    if (hasVariants && art.colorIndex !== undefined && art.colorIndex !== null) {
      const colorEntry = art.ngjyrat && art.ngjyrat[Number(art.colorIndex)];
      if (colorEntry && colorEntry.name) colorSuffix = '-' + slugify(colorEntry.name);
    }
    const slug = uniqueSlug(base + colorSuffix, usedSlugs);
    artSlugs.push(slug);
    artEntries.push({ art, slug });
  }

  // Group variants by code; use colorIndex when present, fallback to insertion order
  const codeGroups = {}; // code → { [ngjyratIndex]: {art, slug} }
  const codeGroupsPos = {}; // tracks next fallback position per code
  for (const { art, slug } of artEntries) {
    if (!art.code) continue;
    if (!codeGroups[art.code]) { codeGroups[art.code] = {}; codeGroupsPos[art.code] = 0; }
    const idx = (art.colorIndex !== undefined && art.colorIndex !== null)
      ? Number(art.colorIndex)
      : codeGroupsPos[art.code];
    codeGroups[art.code][idx] = { art, slug };
    codeGroupsPos[art.code]++;
  }

  // ── Suggestion logic (4 nivele) ─────────────────────────────
  const MIN_SUGGESTIONS = 4;
  const MAX_SUGGESTIONS = 8;

  // Harta e llojeve të afërta (bazuar në art.kat)
  const RELATED_TYPES = {
    'bluze':          ['fanella', 'kanatjere'],
    'fanella':        ['bluze', 'kanatjere'],
    'kanatjere':      ['bluze', 'fanella'],
    'kemisha nate':   ['pizhame'],
    'pizhame':        ['kemisha nate'],
    'mbathje':        ['benevrek'],
    'benevrek':       ['mbathje'],
    'fustane':        ['kostume verore'],
    'kostume verore': ['fustane'],
    'dimer':          ['vere'],
    'vere':           ['dimer'],
  };

  // Normalizon string: lowercase + heq diakritikë
  function norm(s) {
    return (s || '').toLowerCase()
      .replace(/ë/g,'e').replace(/ç/g,'c').trim();
  }

  // Nxjerr llojet nga art.kat (array ose string); fallback: fjala e parë e emrit
  function artTypes(art) {
    const k = art.kat;
    if (!k || (Array.isArray(k) && k.length === 0)) {
      return [norm((art.name || '').trim().split(/\s+/)[0])];
    }
    return (Array.isArray(k) ? k : [k]).map(norm).filter(Boolean);
  }

  // Nxjerr gjininë nga art.sub (array ose string)
  function artGenders(art) {
    const s = art.sub;
    if (!s || (Array.isArray(s) && s.length === 0)) return [''];
    return (Array.isArray(s) ? s : [s]).map(norm).filter(Boolean);
  }

  // Numëron fjalë të përbashkëta mes dy emrave (për renditje brenda nivelit)
  function commonWords(nameA, nameB) {
    const wa = norm(nameA).split(/\s+/).filter(Boolean);
    const wb = norm(nameB).split(/\s+/).filter(Boolean);
    return wa.filter(w => wb.includes(w)).length;
  }

  function sortBySimilarity(entries, refName) {
    return entries.slice().sort((a, b) =>
      commonWords(b.art.name, refName) - commonWords(a.art.name, refName)
    );
  }

  function getRelatedArticles(entry, allEntries) {
    const myTypes   = artTypes(entry.art);
    const myGenders = artGenders(entry.art);
    const seen      = new Set([entry.slug]);
    const result    = [];

    function add(list) {
      for (const e of list) {
        if (seen.has(e.slug)) continue;
        seen.add(e.slug);
        result.push(e);
        if (result.length >= MAX_SUGGESTIONS) return;
      }
    }

    const others = allEntries.filter(e => e.slug !== entry.slug);

    // Niveli 1: i njëjti lloj + e njëjta gjini
    add(sortBySimilarity(others.filter(e => {
      const t = artTypes(e.art), g = artGenders(e.art);
      return myTypes.some(x => t.includes(x)) && myGenders.some(x => g.includes(x));
    }), entry.art.name));

    // Niveli 2: lloj i afërt + e njëjta gjini (plotëso deri në MIN)
    if (result.length < MIN_SUGGESTIONS) {
      const rel = myTypes.flatMap(t => RELATED_TYPES[t] || []);
      add(sortBySimilarity(others.filter(e => {
        const t = artTypes(e.art), g = artGenders(e.art);
        return rel.some(x => t.includes(x)) && myGenders.some(x => g.includes(x));
      }), entry.art.name));
    }

    // Niveli 3: i njëjti lloj, gjini tjetër
    if (result.length < MIN_SUGGESTIONS) {
      add(sortBySimilarity(others.filter(e =>
        myTypes.some(x => artTypes(e.art).includes(x))
      ), entry.art.name));
    }

    // Niveli 4 fallback: e njëjta gjini, çdo lloj
    if (result.length < MIN_SUGGESTIONS) {
      add(others.filter(e =>
        myGenders.some(x => artGenders(e.art).includes(x))
      ));
    }

    return result;
  }

  // Generate article pages with suggestions
  const artDir = path.join(ROOT, 'artikull');
  ensureDir(artDir);

  // Remove stale article folders (old numeric slugs like -1, -2 no longer in new slug set)
  const newSlugSet = new Set(artSlugs);
  if (fs.existsSync(artDir)) {
    for (const existing of fs.readdirSync(artDir)) {
      if (existing === 'slugs.json') continue;
      if (!newSlugSet.has(existing)) {
        const stale = path.join(artDir, existing);
        if (fs.statSync(stale).isDirectory()) {
          fs.rmSync(stale, { recursive: true, force: true });
          console.log(`  Removed stale: /artikull/${existing}/`);
        }
      }
    }
  }
  for (const entry of artEntries) {
    const { art, slug } = entry;
    const related  = getRelatedArticles(entry, artEntries);
    const suggestions = related.map(e => ({
      slug: e.slug,
      name: e.art.name,
      code: e.art.code || '',
      img:  photoUrl(e.art.photos && e.art.photos[0])
    }));
    const dir = path.join(artDir, slug);
    ensureDir(dir);
    const colorVariants = art.code && codeGroups[art.code] ? codeGroups[art.code] : null;
    fs.writeFileSync(path.join(dir, 'index.html'), articleHtml(art, slug, suggestions, colorVariants), 'utf8');
  }
  // Write slug map: id → slug (for artikujt.html to resolve collisions)
  const artSlugMap = {};
  for (const { art, slug } of artEntries) {
    if (art.id) artSlugMap[String(art.id)] = slug;
  }
  fs.writeFileSync(path.join(artDir, 'slugs.json'), JSON.stringify(artSlugMap), 'utf8');
  console.log(`Generated ${artSlugs.length} article pages → /artikull/`);

  // Generate fabric pages
  // Build slug entries first, then render with suggestions
  const pelSlugSet = new Set();
  const pelSlugMap = {}; // id → slug
  const pelEntries = []; // { fab, slug }
  for (const fab of pelhurat) {
    if (!fab.name) continue;
    const base = slugify(fab.name + (fab.code ? '-' + fab.code : ''));
    const slug = uniqueSlug(base, pelSlugSet);
    pelSlugs.push(slug);
    if (fab.id) pelSlugMap[fab.id] = slug;
    pelEntries.push({ fab, slug });
  }

  for (let i = 0; i < pelEntries.length; i++) {
    const { fab, slug } = pelEntries[i];
    // Suggestions: up to 8 other pelhura (adjacent in list, excluding self)
    const suggs = [];
    for (let j = 1; suggs.length < 8 && j < pelEntries.length; j++) {
      const other = pelEntries[(i + j) % pelEntries.length];
      if (other.slug === slug) continue;
      const img = clImg(photoUrl((other.fab.photos || [])[0]), 400);
      suggs.push({ slug: other.slug, name: other.fab.name || '', code: other.fab.code || '', img });
    }
    const dir = path.join(ROOT, 'pelhura', slug);
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), fabricHtml(fab, slug, suggs), 'utf8');
  }
  const pelBaseDir = path.join(ROOT, 'pelhura');
  ensureDir(pelBaseDir);
  fs.writeFileSync(path.join(pelBaseDir, 'slugs.json'), JSON.stringify(pelSlugMap), 'utf8');
  console.log(`Generated ${pelSlugs.length} fabric pages → /pelhura/<slug>/`);

  // Generate catalog & category pages (Faza 3)
  generateArtikujtPage(artEntries);
  generatePelhuraPage(pelEntries);
  const catUrls = generateCategoryPages(artEntries);
  injectHomepageShowcase(artEntries);

  // Faza 4: redirects, 404, sitemap with images
  const newArtSlugSet = new Set(artSlugs);
  const { pelDups } = generateRedirects(newArtSlugSet, pelEntries);
  generate404();

  // Write sitemap (with image sitemap, no lastmod for products)
  const sitemap = buildSitemap(artEntries, pelEntries, catUrls, pelDups);
  const pelCanonCount = pelEntries.filter(({ slug }) => !pelDups.some(d => d.dup === slug)).length;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap, 'utf8');
  console.log(`Updated sitemap.xml (${4 + catUrls.length + artSlugs.length + pelCanonCount} URLs, me image sitemap)`);

  console.log('Done.');

  // ── Kontroll automatik i URL-ve ──────────────────────────────
  checkLinks(artSlugs, pelSlugs);
}

function checkLinks(artSlugs, pelSlugs) {
  const errors = [];
  const artSet = new Set(artSlugs.map(s => `/artikull/${s}/`));
  const pelSet = new Set(pelSlugs.map(s => `/pelhura/${s}/`));

  // Kontrollo sitemap
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  for (const m of sitemap.matchAll(/<loc>(https:\/\/intalal\.com([^<]+))<\/loc>/g)) {
    const path_ = m[2];
    if (!path_.endsWith('/')) errors.push(`sitemap: URL pa /: ${m[1]}`);
  }

  // Kontrollo faqet e gjeneruara: canonical dhe lidhje të brendshme
  const internalRe = /href="(\/(?:artikull|pelhura|artikujt|pelhura|rreth-nesh)[^"#?]*)"/g;
  const canonRe = /<link rel="canonical" href="https:\/\/intalal\.com([^"]+)"/g;

  for (const slug of artSlugs) {
    const html = fs.readFileSync(path.join(ROOT, 'artikull', slug, 'index.html'), 'utf8');
    for (const m of html.matchAll(canonRe)) {
      if (!m[1].endsWith('/')) errors.push(`/artikull/${slug}/ canonical pa /: ${m[1]}`);
    }
    for (const m of html.matchAll(internalRe)) {
      const href = m[1];
      if (href.startsWith('/artikull/') || href.startsWith('/pelhura/')) {
        if (!href.endsWith('/')) errors.push(`/artikull/${slug}/: lidhje pa /: ${href}`);
      }
    }
  }

  if (errors.length) {
    console.error('\n⚠ GABIME URL (trailing slash):');
    errors.forEach(e => console.error('  ' + e));
    process.exit(1);
  } else {
    console.log('✓ URL check: të gjitha URL-të kanë /');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
