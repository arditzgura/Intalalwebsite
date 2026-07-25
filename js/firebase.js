/* Firebase helpers — zëvendëson sb.js */

var _FB_CONFIG = {
  apiKey: "AIzaSyCi0nHVXYruuRE33NDOrGLVhRwl0nupUfI",
  authDomain: "intal-webiste.firebaseapp.com",
  projectId: "intal-webiste",
  storageBucket: "intal-webiste.firebasestorage.app",
  messagingSenderId: "624321141008",
  appId: "1:624321141008:web:6f80ededf8b727161ced95"
};

/* Inicializohet menjëherë */
if (!firebase.apps || !firebase.apps.length) {
  firebase.initializeApp(_FB_CONFIG);
}
var _fbDb = firebase.firestore();

function _fbInit() { return _fbDb; }

/* ---- Cloudinary image helper (e njëjta si me Supabase) ---- */
function sbImgUrl(url) {
  return url || '';
}

/* ---- CRUD bazë ---- */
async function sbGet(key) {
  try {
    var db = _fbInit();
    var snap = await db.collection('konfigurimi').doc(key).get();
    if (!snap.exists) return null;
    return snap.data().value || null;
  } catch(e) { return null; }
}

async function sbSet(key, value) {
  try {
    var db = _fbInit();
    await db.collection('konfigurimi').doc(key).set({ value: value }, { merge: true });
    /* Pastro cache-in që faqja publike të marrë të dhënat e reja */
    if (key === 'artikujt' || key === 'pelhurat' || key === 'kategorisettings') {
      try { localStorage.removeItem('intal_cache_ts'); } catch(e) {}
    }
  } catch(e) {}
}

/* ---- Cache sync (6 orë TTL) ---- */
var _SB_CACHE_TTL = 6 * 60 * 60 * 1000;

async function sbSyncCache() {
  try {
    var ts = parseInt(localStorage.getItem('intal_cache_ts') || '0', 10);
    var existing = {};
    try { existing = JSON.parse(localStorage.getItem('intal_cache_v1') || '{}'); } catch(e) {}
    var hasData = existing.artikujt && existing.artikujt.length > 0;
    if (hasData && Date.now() - ts < _SB_CACHE_TTL) return false;

    var art = await sbGet('artikujt');
    var pel = await sbGet('pelhurat');
    var ks  = await sbGet('kategorisettings');
    var obj = {};
    try { var raw = localStorage.getItem('intal_cache_v1'); if (raw) obj = JSON.parse(raw); } catch(e) {}
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

async function sbSyncLocal(fbKey, localKey) {
  try {
    var raw = localStorage.getItem(localKey);
    var parsed = raw ? JSON.parse(raw) : null;
    if (!parsed) {
      var remote = await sbGet(fbKey);
      if (remote) { localStorage.setItem(localKey, remote); return true; }
    } else {
      sbGet(fbKey).then(function(remote) {
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

/* ---- Analytics (batch, 1 herë për sesion) ---- */
function sbTrack(type, data) {
  try {
    var batchKey = 'intal_an_batch';
    var batch = [];
    try { batch = JSON.parse(localStorage.getItem(batchKey) || '[]'); } catch(e) {}
    batch.push({ type: type, data: data });
    localStorage.setItem(batchKey, JSON.stringify(batch));

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

/* ---- Upload foto në Cloudinary ---- */
var _CL_CLOUD = 'djfrquwex';
var _CL_PRESET = 'intal_upload';

async function sbUploadImg(file, path) {
  try {
    var fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', _CL_PRESET);
    var r = await fetch('https://api.cloudinary.com/v1_1/' + _CL_CLOUD + '/image/upload', { method: 'POST', body: fd });
    if (!r.ok) return null;
    var d = await r.json();
    return d.secure_url || null;
  } catch(e) { return null; }
}
