/* Supabase helpers — shared across all pages */

/* Rewrite Supabase Storage URLs to go through Cloudflare (intalal.com) */
function sbImgUrl(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace('https://qucwmmizqxudxvolfwkx.supabase.co', 'https://intalal.com');
}

async function sbUploadImg(file, path) {
  try {
    var bucket = 'foto-artikujt';
    // Encode only each path segment (preserve / separators for folder structure)
    var encodedPath = path.split('/').map(encodeURIComponent).join('/');
    var r = await fetch(_SB_URL + '/storage/v1/object/' + bucket + '/' + encodedPath, {
      method: 'POST',
      headers: {
        'apikey': _SB_KEY,
        'Authorization': 'Bearer ' + _SB_KEY,
        'Content-Type': file.type || 'image/jpeg',
        'x-upsert': 'true'
      },
      body: file
    });
    if (!r.ok) return null;
    return _SB_URL + '/storage/v1/object/public/' + bucket + '/' + encodedPath;
  } catch(e) { return null; }
}
var _SB_URL = 'https://qucwmmizqxudxvolfwkx.supabase.co';
var _SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1Y3dtbWl6cXh1ZHh2b2xmd2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNjIxODIsImV4cCI6MjA4OTYzODE4Mn0.xp5e-4X2IzgizknjYKmai8qOOrwM-_BO80v_QTI4viw';

async function sbGet(key) {
  try {
    var r = await fetch(_SB_URL + '/rest/v1/konfigurimi?key=eq.' + encodeURIComponent(key), {
      headers: { 'apikey': _SB_KEY, 'Authorization': 'Bearer ' + _SB_KEY }
    });
    var d = await r.json();
    return (d && d[0]) ? d[0].value : null;
  } catch(e) { return null; }
}

async function sbSet(key, value) {
  try {
    var check = await fetch(_SB_URL + '/rest/v1/konfigurimi?key=eq.' + encodeURIComponent(key), {
      headers: { 'apikey': _SB_KEY, 'Authorization': 'Bearer ' + _SB_KEY }
    });
    var existing = await check.json();
    var method = (existing && existing.length > 0) ? 'PATCH' : 'POST';
    var url = method === 'PATCH'
      ? _SB_URL + '/rest/v1/konfigurimi?key=eq.' + encodeURIComponent(key)
      : _SB_URL + '/rest/v1/konfigurimi';
    await fetch(url, {
      method: method,
      headers: {
        'apikey': _SB_KEY, 'Authorization': 'Bearer ' + _SB_KEY,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ key: key, value: value })
    });
  } catch(e) {}
}

/* Load localKey from Supabase if localStorage is missing/empty.
   Returns true if data was fetched from Supabase (caller should re-render). */
async function sbSyncLocal(sbKey, localKey) {
  try {
    var raw = localStorage.getItem(localKey);
    var parsed = raw ? JSON.parse(raw) : null;
    if (!parsed) {
      var remote = await sbGet(sbKey);
      if (remote) { localStorage.setItem(localKey, remote); return true; }
    } else {
      /* stale-while-revalidate: refresh in background */
      sbGet(sbKey).then(function(remote) {
        if (remote) {
          try {
            var fresh = JSON.parse(remote);
            if (fresh && fresh._saved) localStorage.setItem(localKey, remote);
          } catch(e) {}
        }
      }).catch(function(){});
    }
  } catch(e) {}
  return false;
}

/* Track an analytics event — batched locally, flushed once per session to reduce egress.
   type: 'pageView' | 'artOpen' | 'artPhoto'
   data: { page?, name? } */
function sbTrack(type, data) {
  try {
    var batchKey = 'intal_an_batch';
    var batch = [];
    try { batch = JSON.parse(localStorage.getItem(batchKey) || '[]'); } catch(e) {}
    batch.push({ type: type, data: data });
    localStorage.setItem(batchKey, JSON.stringify(batch));

    /* Flush at most once per browser session */
    if (sessionStorage.getItem('intal_an_flushed')) return;
    sessionStorage.setItem('intal_an_flushed', '1');

    setTimeout(async function() {
      try {
        var b = [];
        try { b = JSON.parse(localStorage.getItem(batchKey) || '[]'); } catch(e) {}
        if (!b.length) return;
        localStorage.removeItem(batchKey);
        var raw = await sbGet('analytics');
        var an = raw ? JSON.parse(raw) : {};
        var now = new Date().toISOString();
        b.forEach(function(item) {
          if (item.type === 'pageView') {
            if (!an.pages) an.pages = {};
            an.pages[item.data.page] = (an.pages[item.data.page] || 0) + 1;
            an.lastPublicVisit = now;
          } else if (item.type === 'artOpen') {
            if (!an.artClicks) an.artClicks = {};
            an.artClicks[item.data.name] = (an.artClicks[item.data.name] || 0) + 1;
          } else if (item.type === 'artPhoto') {
            if (!an.artViews) an.artViews = {};
            an.artViews[item.data.name] = (an.artViews[item.data.name] || 0) + 1;
          }
        });
        await sbSet('analytics', JSON.stringify(an));
      } catch(e) {}
    }, 3000);
  } catch(e) {}
}

var _SB_CACHE_TTL = 6 * 60 * 60 * 1000; /* 6 hours */

/* Fetch fresh data from Supabase only if cache is older than TTL.
   Returns true if Supabase was queried and returned data (caller should re-render). */
async function sbSyncCache() {
  try {
    var ts = parseInt(localStorage.getItem('intal_cache_ts') || '0', 10);
    if (Date.now() - ts < _SB_CACHE_TTL) return false; /* cache is fresh */

    var art = await sbGet('artikujt');
    var pel = await sbGet('pelhurat');
    var ks  = await sbGet('kategorisettings');
    var obj = {};
    try {
      var raw = localStorage.getItem('intal_cache_v1');
      if (raw) obj = JSON.parse(raw);
    } catch(e) {}
    if (art) { try { obj.artikujt = JSON.parse(art); } catch(e) {} }
    if (pel) { try { obj.pelhurat = JSON.parse(pel); } catch(e) {} }
    if (ks)  { try { obj.kategoriSettings = JSON.parse(ks); } catch(e) {} }
    if (art || pel || ks) {
      localStorage.setItem('intal_cache_v1', JSON.stringify(obj));
      localStorage.setItem('intal_cache_ts', Date.now().toString());
    }
    return !!(art || pel || ks);
  } catch(e) { return false; }
}
