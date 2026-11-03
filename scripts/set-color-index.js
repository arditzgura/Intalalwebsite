#!/usr/bin/env node
/**
 * set-color-index.js — cakton colorIndex dhe (opsionale) code te artikujt variantë.
 *
 * colorIndex: pozicioni i ngjyrës në array-in ngjyrat[] (0=e para, 1=e dyta, ...)
 * code: kodi i produktit — duhet të jetë IDENTIK për të gjitha variantet e të njëjtit produkt.
 *
 * Ekzekuto: node scripts/set-color-index.js
 *
 * Shto hyrje te UPDATES për çdo grup variantësh me problem.
 */

const https = require('https');

const PROJECT_ID = 'intal-webiste';
const API_KEY    = 'AIzaSyCi0nHVXYruuRE33NDOrGLVhRwl0nupUfI';
const DOC_URL    = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/konfigurimi/artikujt?key=${API_KEY}`;

// ── Hyrjet për update ─────────────────────────────────────────────
// id: ID i artikullit, colorIndex: 0/1/2/..., code (opsional): ndryshon kodin
const UPDATES = [
  // Kod 221 — Mbathje UOMO (3 variante: E Bardhe, Gri, Blu)
  { id: '1774854535365', colorIndex: 0 },           // E Bardhe
  { id: '1774854543631', colorIndex: 2 },           // Blu (foto blu)
  { id: '1774854545973', colorIndex: 1 },           // Gri (foto gri)

  // Kod 222 — Bokse TRY ME (3 variante: E Bardhe, Gri, E Zeze)
  { id: '1788780390818', code: '222', colorIndex: 0 },  // E Bardhe
  { id: '1788780652530', code: '222', colorIndex: 1 },  // Gri (ishte 222-K)
  { id: '1788780655292', code: '222', colorIndex: 2 },  // E Zeze (ishte 222-K-K)
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

  const idToIdx = {};
  artikujt.forEach((a, i) => { if (a.id) idToIdx[String(a.id)] = i; });

  let changed = 0;
  for (const update of UPDATES) {
    const idx = idToIdx[String(update.id)];
    if (idx === undefined) { console.warn(`  ⚠ Artikulli id=${update.id} nuk u gjet.`); continue; }
    let msg = `  ✓ id=${update.id}`;
    if (update.colorIndex !== undefined) {
      msg += ` colorIndex:${artikujt[idx].colorIndex??'—'}→${update.colorIndex}`;
      artikujt[idx].colorIndex = update.colorIndex;
    }
    if (update.code !== undefined) {
      msg += ` code:${artikujt[idx].code??'—'}→${update.code}`;
      artikujt[idx].code = update.code;
    }
    console.log(msg);
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
