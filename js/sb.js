/* Supabase helpers — shared across all pages */
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

/* Also sync intal_cache_v1 (articles + pelhura) from Supabase konfigurimi */
async function sbSyncCache() {
  try {
    var raw = localStorage.getItem('intal_cache_v1');
    var cached = raw ? JSON.parse(raw) : null;
    var needFetch = !cached || !cached.artikujt || !cached.artikujt.length;
    if (needFetch) {
      var art  = await sbGet('artikujt');
      var pel  = await sbGet('pelhurat');
      var obj  = cached || {};
      if (art) { try { obj.artikujt  = JSON.parse(art);  } catch(e) {} }
      if (pel) { try { obj.pelhurat  = JSON.parse(pel);  } catch(e) {} }
      if (art || pel) localStorage.setItem('intal_cache_v1', JSON.stringify(obj));
      return true;
    } else {
      /* background refresh */
      (async function() {
        var art = await sbGet('artikujt');
        var pel = await sbGet('pelhurat');
        var obj = JSON.parse(localStorage.getItem('intal_cache_v1') || '{}');
        if (art) { try { obj.artikujt = JSON.parse(art); } catch(e) {} }
        if (pel) { try { obj.pelhurat = JSON.parse(pel); } catch(e) {} }
        localStorage.setItem('intal_cache_v1', JSON.stringify(obj));
      })().catch(function(){});
      return false;
    }
  } catch(e) { return false; }
}
