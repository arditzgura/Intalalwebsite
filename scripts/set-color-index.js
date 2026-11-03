#!/usr/bin/env node
/**
 * set-color-index.js — cakton fushën colorIndex te artikujt variantë në Firebase.
 *
 * colorIndex: pozicioni i ngjyrës në array-in ngjyrat[] (0=e para, 1=e dyta, ...)
 *
 * Si të ekzekutosh:
 *   node scripts/set-color-index.js
 *
 * Si të shtosh variantë të rinj:
 *   Shto hyrje te UPDATES më poshtë, me id-në e artikullit dhe colorIndex-in.
 */

const https = require('https');

const PROJECT_ID = 'intal-webiste';
const API_KEY    = 'AIzaSyCi0nHVXYruuRE33NDOrGLVhRwl0nupUfI';
const DOC_URL    = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/konfigurimi/artikujt?key=${API_KEY}`;

// ── Hyrjet për update ─────────────────────────────────────────────
// id: ID i artikullit (string ose number), colorIndex: 0/1/2/...
const UPDATES = [
  // Kod 221 — Mbathje UOMO (3 variante: E Bardhe, Gri, Blu)
  { id: '1774854535365', colorIndex: 0 },  // E Bardhe (foto të bardha)
  { id: '1774854543631', colorIndex: 2 },  // Blu (foto blu) ← ishte i lidhur gabimisht me Gri
  { id: '1774854545973', colorIndex: 1 },  // Gri (foto gri) ← ishte i lidhur gabimisht me Blu

  // Shto hyrje të tjera këtu nëse ka variante të tjera me gabim:
  // { id: 'ARTICLE_ID', colorIndex: 0 },
];
// ─────────────────────────────────────────────────────────────────

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

function httpsPatch(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(url + '&updateMask.fieldPaths=value', opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Duke lexuar artikujt nga Firebase...');
  const res = await httpsGet(DOC_URL);
  if (res.error) throw new Error('Firebase read error: ' + JSON.stringify(res.error));

  const artikujt = JSON.parse(res.fields.value.stringValue);
  console.log(`  → ${artikujt.length} artikuj të gjetur`);

  // Ndërto map id → index në array
  const idToIdx = {};
  artikujt.forEach((a, i) => { if (a.id) idToIdx[String(a.id)] = i; });

  let changed = 0;
  for (const { id, colorIndex } of UPDATES) {
    const idx = idToIdx[String(id)];
    if (idx === undefined) { console.warn(`  ⚠ Artikulli me id=${id} nuk u gjet.`); continue; }
    const old = artikujt[idx].colorIndex;
    artikujt[idx].colorIndex = colorIndex;
    console.log(`  ✓ id=${id} → colorIndex: ${old ?? '(pa vlerë)'} → ${colorIndex}`);
    changed++;
  }

  if (changed === 0) { console.log('Asnjë ndryshim.'); return; }

  console.log(`\nDuke shkruar ${changed} ndryshime në Firebase...`);
  const patchRes = await httpsPatch(DOC_URL, {
    fields: { value: { stringValue: JSON.stringify(artikujt) } }
  });

  if (patchRes.error) {
    console.error('❌ Gabim gjatë shkrimit:', JSON.stringify(patchRes.error));
    process.exit(1);
  }
  console.log('✅ U ruajtën ndryshimet në Firebase.');
  console.log('\nTani ekzekuto: node scripts/build-seo.js');
}

main().catch(e => { console.error('❌ Gabim:', e.message); process.exit(1); });
