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
function articleHtml(art, slug, suggestions) {
  const title   = esc(art.name || 'Artikull');
  const rawDesc = art.desc || `${art.name} nga Intal Albania — fabrikë shqiptare e të brendshmeve që nga 1994.`;
  const desc    = esc(rawDesc);
  const photos  = (art.photos || []).map(p => typeof p === 'string' ? p : (p.src || p.url || '')).filter(Boolean);
  const photo   = photos[0] || '';
  const ogImg   = photo || `${BASE_URL}/og_image.png`;
  const canon   = `${BASE_URL}/artikull/${slug}`;
  const sizes   = (art.masat || art.sizes || []);
  const ngjyrat = (art.ngjyrat || []);
  const comp    = (art.perberja || []).map(p => `<div class="comp-row"><span>${esc(p.material||p.name||'')}</span><span>${esc(String(p.perqindje||p.pct||p.value||''))}%</span></div>`).join('');

  const thumbsHtml = photos.length > 1
    ? photos.map((src, i) =>
        `<button class="thumb ${i===0?'active':''}" onclick="setPhoto(${i})" aria-label="Foto ${i+1}">` +
        `<img src="${esc(src)}" alt="${title} foto ${i+1}"></button>`
      ).join('')
    : '';

  const sizesHtml = sizes.length
    ? `<div class="section-label">MASAT</div><div class="chips-row">${sizes.map(s=>`<span class="chip">${esc(s)}</span>`).join('')}</div>`
    : '';

  const colorsHtml = ngjyrat.length
    ? `<div class="section-label">NGJYRAT</div><div class="colors-row">${ngjyrat.map(c=>`<span class="color-dot" style="background:${esc(c.hex||'#ccc')}" title="${esc(c.name||'')}"></span>`).join('')}</div>`
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
  {"@context":"https://schema.org","@type":"Product","name":"${title.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}","description":"${desc.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}","brand":{"@type":"Brand","name":"Intal Albania"},"sku":"${esc(art.code||slug)}","image":"${esc(ogImg)}","offers":{"@type":"Offer","availability":"https://schema.org/InStock","seller":{"@type":"Organization","name":"Intal Albania","url":"${BASE_URL}"}}}
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css">
  <link rel="stylesheet" href="/css/main.css">
  <link rel="icon" type="image/png" href="/favicon.png">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Montserrat',sans-serif;background:#fff;color:#0a0a0a;min-height:100vh;padding-top:64px;}

    /* ── Layout ── */
    .page{width:100%;padding:28px 3vw 60px;}

    /* ── Breadcrumb ── */
    .breadcrumb{font-size:11px;color:#aaa;letter-spacing:0.5px;margin-bottom:20px;display:flex;align-items:center;gap:6px;}
    .breadcrumb a{color:#aaa;text-decoration:none;}
    .breadcrumb a:hover{color:#C8003E;}
    .breadcrumb span{color:#888;}

    /* ── Product grid ── */
    .product-grid{display:grid;grid-template-columns:3fr clamp(60px,6vw,96px) 1.6fr;gap:16px clamp(8px,1.2vw,18px);align-items:start;}
    @media(max-width:900px){.product-grid{grid-template-columns:2fr clamp(52px,5vw,72px) 1.4fr;gap:12px 8px;}}
    @media(max-width:680px){.product-grid{grid-template-columns:1fr;gap:0;} .gallery{order:1;} .thumbs-col{order:2;flex-direction:row;margin-top:8px;gap:6px;} .info{order:3;margin-top:20px;}}

    /* ── Gallery ── */
    .gallery{}
    .main-img-wrap{position:relative;overflow:hidden;background:#fff;aspect-ratio:1;}
    .main-img-wrap img{width:100%;height:100%;object-fit:cover;display:block;transition:opacity .25s;}
    .main-img-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:72px;color:#ddd;}
    .gallery-nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.9);border:none;width:36px;height:36px;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.12);}
    .gallery-nav.prev{left:10px;}
    .gallery-nav.next{right:10px;}
    .gallery-nav:hover{background:#fff;}
    /* vertical thumbs column */
    .thumbs-col{display:flex;flex-direction:column;gap:6px;}
    .thumb{border:2px solid transparent;overflow:hidden;width:100%;aspect-ratio:1;cursor:pointer;padding:0;background:none;display:block;transition:border-color .15s;}
    .thumb.active{border-color:#C8003E;}
    .thumb img{width:100%;height:100%;object-fit:cover;display:block;}

    /* ── Info ── */
    .info{}
    .info-eyebrow{font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#aaa;margin-bottom:6px;}
    .info-name{font-size:20px;font-weight:800;letter-spacing:-0.3px;line-height:1.2;margin-bottom:4px;}
    @media(max-width:680px){.info-name{font-size:20px;}}
    .info-desc{font-size:12px;line-height:1.6;color:#555;margin:8px 0 16px;padding-bottom:16px;border-bottom:1px solid #ebebeb;}
    .section-label{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#aaa;font-weight:700;margin-bottom:8px;margin-top:14px;}
    .chips-row{display:flex;gap:6px;flex-wrap:wrap;}
    .chip{background:#fff;border:1.5px solid #e0e0e0;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:600;letter-spacing:0.5px;}
    .colors-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
    .color-dot{width:22px;height:22px;border-radius:50%;border:2px solid rgba(0,0,0,.1);display:inline-block;flex-shrink:0;}
    .comp-wrap{margin-top:14px;}
    .comp-row{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#fff;border-radius:6px;margin-bottom:3px;font-size:11px;font-weight:500;}
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
    .btn-wa{display:flex;align-items:center;justify-content:center;gap:8px;background:#25D366;color:#fff;text-decoration:none;border-radius:8px;padding:11px 16px;font-weight:700;font-size:12px;letter-spacing:0.5px;}
    .btn-wa:hover{background:#1eb85a;}
    .btn-wa svg{flex-shrink:0;}
    .btn-back{display:flex;align-items:center;justify-content:center;gap:6px;background:#fff;border:1.5px solid #e0e0e0;color:#0a0a0a;text-decoration:none;border-radius:8px;padding:10px 16px;font-weight:600;font-size:11px;letter-spacing:0.5px;}
    .btn-back:hover{border-color:#C8003E;color:#C8003E;}

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
          <a href="/artikujt" class="nav-link active">Artikujt</a>
          <a href="/pelhura" class="nav-link">Pelhura</a>
          <a href="/rreth-nesh" class="nav-link">Rreth Nesh</a>
        </div>
      </div>
      <a href="/" class="navbar-brand">Intal Underwear</a>
      <div class="navbar-right">
        <div class="lang-toggle">
          <span class="lang-opt active">AL</span>
          <span class="lang-sep">|</span>
          <span class="lang-opt">EN</span>
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
        <a href="/artikujt" class="menu-drawer-link" onclick="closeMenuDrawer()">Artikujt</a>
        <a href="/pelhura" class="menu-drawer-link" onclick="closeMenuDrawer()">Pelhura</a>
        <a href="/rreth-nesh" class="menu-drawer-link" onclick="closeMenuDrawer()">Rreth Nesh</a>
      </nav>
      <div class="menu-drawer-divider"></div>
      <p class="menu-drawer-eyebrow">NA KONTAKTONI</p>
      <div class="menu-drawer-contacts">
        <a class="menu-drawer-contact-item" href="tel:+355692776636">
          <div class="menu-drawer-icon"><i class="ri-phone-line"></i></div>
          <div><span class="menu-drawer-label">Telefon / WhatsApp</span><span class="menu-drawer-value">+355 692 776 636</span></div>
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

  <div class="page">

    <div class="breadcrumb">
      <a href="/">Kryefaqja</a>
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 12l4-4-4-4"/></svg>
      <a href="/artikujt">Artikujt</a>
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 12l4-4-4-4"/></svg>
      <span>${title}</span>
    </div>

    <div class="product-grid">

      <!-- Gallery -->
      <div class="gallery">
        <div class="main-img-wrap" id="main-img-wrap">
          ${photo
            ? `<img id="main-img" src="${esc(photo)}" alt="${title}" onclick="openLightbox(_idx)" style="cursor:zoom-in;">`
            : `<div class="main-img-placeholder">👕</div>`}
          ${photos.length > 1 ? `
          <button class="gallery-nav prev" onclick="stepPhoto(-1)" aria-label="Para">&#8592;</button>
          <button class="gallery-nav next" onclick="stepPhoto(1)" aria-label="Pas">&#8594;</button>` : ''}
        </div>
      </div>

      <!-- Vertical thumbnails -->
      ${thumbsHtml ? `<div class="thumbs-col" id="thumbs">${thumbsHtml}</div>` : '<div></div>'}

      <!-- Info -->
      <div class="info">
        ${art.code ? `<p class="info-eyebrow">Art: ${esc(art.code)}</p>` : ''}
        <h1 class="info-name">${title}</h1>
        ${art.desc ? `<p class="info-desc">${esc(rawDesc)}</p>` : '<div style="height:1px;background:#ebebeb;margin:16px 0 24px;"></div>'}

        ${sizesHtml}
        ${colorsHtml}
        ${comp ? `<div class="comp-wrap"><div class="section-label">PËRBËRJA</div>${comp}</div>` : ''}

        <div class="cta-group">
          <a href="https://wa.me/355692776636?text=Pershendetje%2C%20jam%20i%20interesuar%20per%20artikullin%3A%20${encodeURIComponent(art.name||'')}" class="btn-wa" target="_blank" rel="noopener">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Na Kontaktoni në WhatsApp
          </a>
          <a href="/artikujt" class="btn-back">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 12L6 8l4-4"/></svg>
            Shiko të gjithë artikujt
          </a>
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
          ${suggestions.map(s => `<a class="sugg-card" href="/artikull/${s.slug}">
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

  <!-- Footer -->
  <div class="simple-footer">
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
    <div class="contact-footer">
      <span class="contact-brand">Intal <strong>UNDERWEAR</strong></span>
      <span class="contact-copy">© <span id="cp-yr"></span> Intal Albania</span>
    </div>
  </div>

  <script src="/js/main.js"></script>
  <script>
    (function(){var y=new Date().getFullYear();['cp-yr','cp-yr-drawer'].forEach(function(id){var el=document.getElementById(id);if(el)el.textContent=y;});document.querySelectorAll('.cp-yr').forEach(function(el){el.textContent=y;});})();
    var _photos = ${photosJson};
    var _idx = 0;
    function setPhoto(i){
      _idx = ((i % _photos.length) + _photos.length) % _photos.length;
      var img = document.getElementById('main-img');
      if(img){ img.style.opacity='0'; setTimeout(function(){ img.src=_photos[_idx]; img.style.opacity='1'; }, 150); }
      document.querySelectorAll('.thumb').forEach(function(t,ti){ t.classList.toggle('active', ti===_idx); });
    }
    function stepPhoto(d){ setPhoto(_idx+d); }

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

  // Build slug map for all articles first (needed for suggestions)
  const artEntries = [];
  for (const art of artikujt) {
    if (!art.name) continue;
    const base = slugify(art.name + (art.code ? '-' + art.code : ''));
    const slug = uniqueSlug(base, usedSlugs);
    artSlugs.push(slug);
    artEntries.push({ art, slug });
  }

  // Generate article pages with suggestions
  const artDir = path.join(ROOT, 'artikull');
  ensureDir(artDir);
  for (const { art, slug } of artEntries) {
    const firstWord = (art.name || '').trim().split(/\s+/)[0].toLowerCase();
    const suggestions = artEntries
      .filter(e => e.slug !== slug && (e.art.name || '').trim().split(/\s+/)[0].toLowerCase() === firstWord)
      .slice(0, 8)
      .map(e => ({
        slug: e.slug,
        name: e.art.name,
        code: e.art.code || '',
        img: (e.art.photos && e.art.photos[0]) ? (typeof e.art.photos[0] === 'string' ? e.art.photos[0] : (e.art.photos[0].src || e.art.photos[0].url || '')) : ''
      }));
    const dir = path.join(artDir, slug);
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), articleHtml(art, slug, suggestions), 'utf8');
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
