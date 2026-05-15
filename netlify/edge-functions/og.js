/**
 * Netlify Edge Function — /og
 * Generates dynamic OG meta tags for social media sharing.
 * Bots get the OG HTML; real users are redirected to the actual page.
 *
 * Params:
 *   ?page=artikujt&gjinia=Meshkuj&kat=Mbathje
 *   ?page=artikujt&art=ARTICLE_ID
 *   ?page=pelhura&kat=KATNAME
 *   ?page=pelhura&art=PELHURE_ID
 */

const SB_URL = 'https://qucwmmizqxudxvolfwkx.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1Y3dtbWl6cXh1ZHh2b2xmd2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNjIxODIsImV4cCI6MjA4OTYzODE4Mn0.xp5e-4X2IzgizknjYKmai8qOOrwM-_BO80v_QTI4viw';
const SITE   = 'https://intalal.com';

async function sbFetch(key) {
  const r = await fetch(
    `${SB_URL}/rest/v1/konfigurimi?key=eq.${encodeURIComponent(key)}`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
  );
  const rows = await r.json();
  if (!rows || !rows[0]?.value) return null;
  return JSON.parse(rows[0].value);
}

function firstPhoto(list, filterFn) {
  for (const a of list) {
    if (filterFn && !filterFn(a)) continue;
    const photos = Array.isArray(a.photos) ? a.photos : [];
    const p = photos[0];
    if (!p) continue;
    const src = typeof p === 'string' ? p : (p.src || p.url || '');
    if (!src) continue;
    return src.startsWith('http') ? src : `${SITE}/${src.replace(/^\//, '')}`;
  }
  return `${SITE}/og_image.png`;
}

function slug(s) {
  return s.toLowerCase().replace(/\s+/g, '-');
}

function matchesSub(a, gjinia) {
  const subs = Array.isArray(a.sub) ? a.sub : (a.sub ? [a.sub] : []);
  return subs.some(s => s.toLowerCase() === gjinia.toLowerCase());
}

function matchesKat(a, kat) {
  const kats = Array.isArray(a.kat) ? a.kat : (a.kat ? [a.kat] : []);
  return kats.some(k => k.toLowerCase() === kat.toLowerCase());
}

export default async function handler(request) {
  const url    = new URL(request.url);
  const page   = url.searchParams.get('page')   || '';
  const gjinia = url.searchParams.get('gjinia') || '';
  const kat    = url.searchParams.get('kat')    || '';
  const art    = url.searchParams.get('art')    || '';

  let title    = 'Intal Underwear — Koleksioni i të Brendëshmes';
  let desc     = 'Cilësi shqiptare direkt nga fabrika. Meshkuj, Femra, Fëmijë.';
  let img      = `${SITE}/og_image.png`;
  let redirect = SITE;

  try {
    if (page === 'artikujt') {
      title    = 'Artikujt — Intal Underwear';
      desc     = 'Koleksioni i plotë i të brendëshmes — Meshkuj, Femra, Fëmijë. Cilësi shqiptare direkt nga fabrika.';
      redirect = `${SITE}/artikujt`;

      if (art) {
        const articles = await sbFetch('artikujt');
        const a = articles?.find(x => x.id === art);
        if (a) {
          title    = `${a.name || 'Artikull'} — Intal Underwear`;
          desc     = a.desc || 'Koleksioni i plotë i të brendëshmes — Intal Albania.';
          img      = firstPhoto([a]);
          redirect = `${SITE}/artikujt#~${encodeURIComponent(art)}`;
        }
      } else if (gjinia) {
        const articles = await sbFetch('artikujt');
        const label = kat ? `${kat} · ${gjinia}` : gjinia;
        title    = `${label} — Intal Underwear`;
        desc     = `Koleksioni i plotë i të brendëshmes — ${gjinia}${kat ? ' / ' + kat : ''}. Cilësi shqiptare direkt nga fabrika.`;
        redirect = `${SITE}/artikujt#${encodeURIComponent(slug(gjinia))}${kat ? '/' + encodeURIComponent(slug(kat)) : ''}`;
        if (articles) {
          img = firstPhoto(articles, a =>
            matchesSub(a, gjinia) && (!kat || matchesKat(a, kat))
          );
        }
      }

    } else if (page === 'pelhura') {
      title    = 'Pelhura — Intal Underwear';
      desc     = 'Pëlhurat tona premium — material cilësor për prodhim të brendëshmes. Intal Albania.';
      redirect = `${SITE}/pelhura`;

      if (art) {
        const pelhurat = await sbFetch('pelhurat');
        const a = pelhurat?.find(x => x.id === art);
        if (a) {
          title    = `${a.name || 'Pelhurë'} — Intal Underwear`;
          desc     = a.desc || 'Pelhura premium — material cilësor. Intal Albania.';
          img      = firstPhoto([a]);
          redirect = `${SITE}/pelhura#~${encodeURIComponent(art)}`;
        }
      } else if (kat) {
        const pelhurat = await sbFetch('pelhurat');
        title    = `${kat} — Pelhura Intal`;
        desc     = `Pelhura ${kat} — material premium për prodhim të brendëshmes. Intal Albania.`;
        redirect = `${SITE}/pelhura#${encodeURIComponent(slug(kat))}`;
        if (pelhurat) {
          img = firstPhoto(pelhurat, a => matchesKat(a, kat));
        }
      }
    }
  } catch (_) {
    // fallback to defaults on any error
  }

  const ogUrl = `${SITE}/og?${url.searchParams.toString()}`;

  const html = `<!DOCTYPE html>
<html lang="sq">
<head>
<meta charset="UTF-8">
<title>${escHtml(title)}</title>
<meta name="description"          content="${escHtml(desc)}">
<meta property="og:type"          content="website">
<meta property="og:title"         content="${escHtml(title)}">
<meta property="og:description"   content="${escHtml(desc)}">
<meta property="og:image"         content="${escHtml(img)}">
<meta property="og:url"           content="${escHtml(ogUrl)}">
<meta property="og:site_name"     content="Intal Underwear">
<meta name="twitter:card"         content="summary_large_image">
<meta name="twitter:title"        content="${escHtml(title)}">
<meta name="twitter:description"  content="${escHtml(desc)}">
<meta name="twitter:image"        content="${escHtml(img)}">
<link rel="icon" type="image/png" href="${SITE}/favicon.png">
<meta http-equiv="refresh"        content="0;url=${escHtml(redirect)}">
</head>
<body>
<script>window.location.replace(${JSON.stringify(redirect)});</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public,max-age=60' },
  });
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
