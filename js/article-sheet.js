/**
 * article-sheet.js — bottom sheet mobile (intalal.com)
 * Foto mbush ekranin e plotë; detajet janë panel që rrëshqet lart mbi foto.
 */
(function () {
  'use strict';

  // ── Konfig ─────────────────────────────────────────────────────
  var WA_NUM = '355692776636';

  function buildWaMessage(art, ngjyra, masa) {
    var rows = ['Përshëndetje! Jam i interesuar për këtë artikull:\n'];
    rows.push('• Emri: ' + (art.name || ''));
    if (art.code) rows.push('• Kodi Art.: ' + art.code);
    if (ngjyra)   rows.push('• Ngjyra: ' + ngjyra);
    if (masa)     rows.push('• Masa: ' + masa);
    rows.push('\nMë interesojnë çmimi dhe sasia minimale për porosi.');
    return rows.join('\n');
  }

  // ── Gjendje ────────────────────────────────────────────────────
  var _art       = null;
  var _photos    = [];
  var _photoIdx  = 0;
  var _selColor  = null;   // {name, hex}
  var _selSize   = null;
  var _prevFocus = null;
  var _scrollY   = 0;
  var _openList  = [];
  var _openIdx   = 0;
  var _panelOpen = false;  // detajet të zgjeruara

  // ── Inject HTML ────────────────────────────────────────────────
  function inject() {
    if (document.getElementById('as-sheet')) return;
    var el = document.createElement('div');
    el.id = 'as-root';
    el.innerHTML =
      '<div id="as-backdrop" class="as-backdrop" aria-hidden="true"></div>' +
      '<div id="as-sheet" class="as-sheet" role="dialog" aria-modal="true" aria-labelledby="as-name" tabindex="-1">' +
        // Galeria — mbush gjithë sheetin
        '<div id="as-gallery" class="as-gallery">' +
          '<div id="as-track" class="as-track"></div>' +
          '<div id="as-counter" class="as-counter"></div>' +
          '<div id="as-dots-row" class="as-dots-row"></div>' +
          // Buton mbyll sipër majtës
          '<button id="as-close-btn" class="as-close-btn" aria-label="Mbyll">&#10005;</button>' +
        '</div>' +
        // Paneli i detajeve (bottom sheet mbi foto)
        '<div id="as-panel" class="as-panel">' +
          '<div id="as-handle-zone" class="as-handle-zone">' +
            '<div class="as-handle"></div>' +
          '</div>' +
          '<div id="as-body" class="as-body">' +
            '<p id="as-code-el" class="as-code-el"></p>' +
            '<h2 id="as-name" class="as-name"></h2>' +
            '<div id="as-price-el" class="as-price-el"></div>' +
            '<div id="as-colors-el" class="as-colors-el"></div>' +
            '<div id="as-sizes-el" class="as-sizes-el"></div>' +
            '<div id="as-comp-el" class="as-comp-el"></div>' +
            '<div id="as-desc-el" class="as-desc-el"></div>' +
          '</div>' +
          '<div id="as-cta" class="as-cta">' +
            '<a id="as-wa-btn" class="as-wa-btn" href="#" onclick="return false;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' +
              'Shkruaj në WhatsApp' +
            '</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
      // Lightbox
      '<div id="as-lb" class="as-lb" role="dialog" aria-modal="true" aria-label="Foto e zmadhuar">' +
        '<button id="as-lb-close" class="as-lb-close" aria-label="Mbyll">&#10005;</button>' +
        '<div id="as-lb-track" class="as-lb-track"></div>' +
        '<div id="as-lb-counter" class="as-lb-counter"></div>' +
      '</div>';
    document.body.appendChild(el);
    bindAll();
  }

  // ── Render ─────────────────────────────────────────────────────
  function ph(p) { return (!p) ? '' : (typeof p === 'string' ? p : (p.src || p.url || '')); }

  function renderContent(art) {
    _art = art;
    _photos = (art.photos || []).map(ph).filter(Boolean);
    _photoIdx = 0;
    _selColor = null;
    _selSize  = null;
    _panelOpen = false;

    renderGallery();

    var codeEl = document.getElementById('as-code-el');
    codeEl.textContent = art.code ? 'Kodi: ' + art.code : '';
    codeEl.style.display = art.code ? '' : 'none';

    document.getElementById('as-name').textContent = art.name || '';

    renderPrice(art);
    renderColors(art);
    renderSizes(art);
    renderComp(art);
    renderDesc(art);
    updateWaLink();

    // Panel i mbyllur (peek)
    setPanel(false, false);
    var body = document.getElementById('as-body');
    if (body) body.scrollTop = 0;
  }

  function renderGallery() {
    var track = document.getElementById('as-track');
    var counter = document.getElementById('as-counter');
    var dots = document.getElementById('as-dots-row');
    if (!_photos.length) {
      track.innerHTML = '<div class="as-no-photo">&#128085;</div>';
      counter.style.display = 'none'; dots.innerHTML = ''; return;
    }
    track.innerHTML = _photos.map(function (src, i) {
      return '<div class="as-slide" data-src="' + src + '" data-i="' + i + '">' +
        '<img ' + (i <= 1 ? 'src="' + src + '"' : '') + ' alt="' + ((_art ? _art.name : '') + (i > 0 ? ' ' + (i + 1) : '')) + '" draggable="false">' +
        '</div>';
    }).join('');
    track.style.transform = 'translateX(0)';
    updatePhotoUI();
  }

  function loadAdjacentPhotos(idx) {
    var track = document.getElementById('as-track');
    if (!track) return;
    track.querySelectorAll('.as-slide').forEach(function (s, i) {
      if (Math.abs(i - idx) <= 1) {
        var img = s.querySelector('img');
        if (img && !img.src && s.dataset.src) img.src = s.dataset.src;
      }
    });
  }

  function updatePhotoUI() {
    var total = _photos.length;
    var i = _photoIdx;
    var counter = document.getElementById('as-counter');
    counter.textContent = total > 1 ? (i + 1) + ' / ' + total : '';
    counter.style.display = total > 1 ? '' : 'none';
    var dots = document.getElementById('as-dots-row');
    if (total > 1 && total <= 7) {
      dots.innerHTML = _photos.map(function (_, j) {
        return '<span class="as-dot' + (j === i ? ' as-dot-on' : '') + '"></span>';
      }).join('');
    } else { dots.innerHTML = ''; }
    var track = document.getElementById('as-track');
    if (track) track.querySelectorAll('.as-slide').forEach(function (s, j) { s.classList.toggle('as-slide-active', j === i); });
  }

  function renderPrice(art) {
    var el = document.getElementById('as-price-el');
    var prices = (typeof _prices !== 'undefined' && _prices) ? (_prices[art.id] || {}) : {};
    var cur = (typeof _currency !== 'undefined' && _currency) || 'ALL';
    var t = prices.tregu, o = prices.oferte;
    if (t || o) {
      el.innerHTML =
        '<span class="as-price-label">Çmimi</span>' +
        '<div class="as-price-row">' +
        (t ? '<span class="as-price-tregu">' + t + ' ' + cur + '</span>' : '') +
        (t && o ? '<span class="as-price-arrow">→</span>' : '') +
        (o ? '<span class="as-price-oferte">' + o + ' ' + cur + '</span>' : '') +
        '</div>';
    } else {
      el.innerHTML = '<span class="as-price-req">Çmim me kërkesë</span>';
    }
    el.style.display = '';
  }

  function renderColors(art) {
    var el = document.getElementById('as-colors-el');
    var ngjyrat = art.ngjyrat || [];
    if (!ngjyrat.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
    el.style.display = '';
    var html = '<p class="as-section-label">NGJYRAT</p><div class="as-swatches">';
    ngjyrat.forEach(function (n, idx) {
      var hex   = typeof n === 'object' ? (n.hex || n.color || '#ccc') : '#ccc';
      var label = typeof n === 'object' ? (n.name || n.label || '') : String(n || '');
      html += '<button class="as-swatch" data-idx="' + idx + '" title="' + label + '" aria-label="Ngjyra ' + label + '">' +
        '<span class="as-swatch-dot" style="background:' + hex + ';"></span></button>';
    });
    html += '</div><p id="as-color-name" class="as-color-name"></p>';
    el.innerHTML = html;
    el.querySelectorAll('.as-swatch').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx2 = parseInt(btn.dataset.idx);
        var n = ngjyrat[idx2];
        var label = typeof n === 'object' ? (n.name || n.label || '') : String(n || '');
        var alreadySel = _selColor && _selColor.name === label;
        if (alreadySel) {
          _selColor = null;
          el.querySelectorAll('.as-swatch').forEach(function (b) { b.classList.remove('as-swatch-on'); });
          document.getElementById('as-color-name').textContent = '';
          _photos = (art.photos || []).map(ph).filter(Boolean);
        } else {
          _selColor = { name: label, hex: typeof n === 'object' ? (n.hex || n.color || '#ccc') : '#ccc' };
          el.querySelectorAll('.as-swatch').forEach(function (b) { b.classList.toggle('as-swatch-on', b === btn); });
          document.getElementById('as-color-name').textContent = label;
          var cp = typeof n === 'object' && n.photos && n.photos.length ? n.photos.map(ph).filter(Boolean) : null;
          if (cp) { _photos = cp; _photoIdx = 0; renderGallery(); }
        }
        updateWaLink();
      });
    });
  }

  function renderSizes(art) {
    var el = document.getElementById('as-sizes-el');
    var sizes = art.sizes || [];
    if (!sizes.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = '<p class="as-section-label">MASAT</p><div class="as-chips">' +
      sizes.map(function (s) { return '<button class="as-chip" data-size="' + s + '">' + s + '</button>'; }).join('') + '</div>';
    el.querySelectorAll('.as-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var already = _selSize === btn.dataset.size;
        _selSize = already ? null : btn.dataset.size;
        el.querySelectorAll('.as-chip').forEach(function (b) { b.classList.toggle('as-chip-on', b.dataset.size === _selSize); });
        updateWaLink();
      });
    });
  }

  function renderComp(art) {
    var el = document.getElementById('as-comp-el');
    var comp = art.perberja || art.composition || [];
    if (!comp.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = '<p class="as-section-label">PËRBËRJA</p>' +
      comp.map(function (c) {
        var mat = typeof c === 'object' ? (c.mat || c.material || c.name || '') : String(c || '');
        var pct = typeof c === 'object' ? (c.pct || c.percent || c.value || '') : '';
        return '<div class="as-comp-row">' + (pct ? '<span class="as-comp-pct">' + pct + '%</span>' : '') + '<span class="as-comp-mat">' + mat + '</span></div>';
      }).join('');
  }

  function renderDesc(art) {
    var el = document.getElementById('as-desc-el');
    if (!art.pershkrim) { el.innerHTML = ''; el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = '<p class="as-desc-txt as-desc-clamped">' + art.pershkrim + '</p>' +
      '<button class="as-desc-more" onclick="this.previousElementSibling.classList.toggle(\'as-desc-clamped\');this.textContent=this.previousElementSibling.classList.contains(\'as-desc-clamped\')?\'Më shumë\':\'Më pak\';">Më shumë</button>';
  }

  function updateWaLink() {
    if (!_art) return;
    var msg = buildWaMessage(_art, _selColor ? _selColor.name : null, _selSize);
    var btn = document.getElementById('as-wa-btn');
    if (btn) { btn.href = 'https://wa.me/' + WA_NUM + '?text=' + encodeURIComponent(msg); btn.onclick = null; }
  }

  // ── Panel expand/collapse ───────────────────────────────────────
  // peek: lartësia e dukshme kur panel është i mbyllur
  var PEEK = 110; // px

  function setPanel(open, animate) {
    _panelOpen = open;
    var panel = document.getElementById('as-panel');
    if (!panel) return;
    if (animate) {
      panel.style.transition = 'transform .35s cubic-bezier(.32,.72,0,1)';
      setTimeout(function () { panel.style.transition = ''; }, 360);
    } else {
      panel.style.transition = 'none';
    }
    if (open) {
      panel.style.transform = 'translateY(0)';
      var body = document.getElementById('as-body');
      if (body) body.style.overflowY = 'auto';
    } else {
      panel.style.transform = 'translateY(calc(100% - ' + PEEK + 'px))';
      var body2 = document.getElementById('as-body');
      if (body2) { body2.style.overflowY = 'hidden'; body2.scrollTop = 0; }
    }
  }

  // ── Hapja/mbyllja sheet ──────────────────────────────────────────
  function open(art, list, idx) {
    inject();
    _scrollY   = window.scrollY || window.pageYOffset;
    _prevFocus = document.activeElement;
    _openList  = list || [art];
    _openIdx   = (typeof idx === 'number') ? idx : 0;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top      = '-' + _scrollY + 'px';
    document.body.style.width    = '100%';

    renderContent(art);

    var bd = document.getElementById('as-backdrop');
    var sh = document.getElementById('as-sheet');
    requestAnimationFrame(function () {
      bd.classList.add('as-on');
      sh.classList.add('as-on');
    });
    history.pushState({ asSheet: true }, '');
    setTimeout(function () { if (sh) sh.focus(); }, 350);
    if (window._track) _track('article_sheet_open', { code: art.code });
  }

  function close(method) {
    var sh = document.getElementById('as-sheet');
    var bd = document.getElementById('as-backdrop');
    if (!sh || !sh.classList.contains('as-on')) return;
    sh.classList.remove('as-on');
    bd.classList.remove('as-on');
    setTimeout(function () {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top      = '';
      document.body.style.width    = '';
      window.scrollTo(0, _scrollY);
    }, 360);
    if (history.state && history.state.asSheet) history.back();
    if (_prevFocus) { try { _prevFocus.focus(); } catch (e) {} }
    closeLightbox();
    if (window._track) _track('article_sheet_close', { method: method || 'unknown' });
  }

  // ── Lightbox ────────────────────────────────────────────────────
  var _lbIdx = 0, _lbBound = false;

  function openLightbox(idx) {
    var lb = document.getElementById('as-lb');
    var track = document.getElementById('as-lb-track');
    if (!lb || !_photos.length) return;
    _lbIdx = idx;
    track.innerHTML = _photos.map(function (src, i) {
      return '<div class="as-lb-slide' + (i === idx ? ' as-lb-active' : '') + '" data-i="' + i + '">' +
        '<img src="' + src + '" alt="' + (_art ? _art.name : '') + ' foto ' + (i + 1) + '" draggable="false">' +
        '</div>';
    }).join('');
    updateLbCounter();
    lb.classList.add('as-on');
    if (!_lbBound) { bindLbTouch(); _lbBound = true; }
    if (window._track) _track('article_lightbox_open', { code: _art ? _art.code : '' });
  }

  function closeLightbox() {
    var lb = document.getElementById('as-lb');
    if (lb) lb.classList.remove('as-on');
  }

  function lbGo(idx) {
    if (idx < 0 || idx >= _photos.length) return;
    _lbIdx = idx;
    document.querySelectorAll('.as-lb-slide').forEach(function (s) {
      var active = parseInt(s.dataset.i) === idx;
      s.classList.toggle('as-lb-active', active);
      if (active) { var img = s.querySelector('img'); if (img) img.style.transform = ''; }
    });
    updateLbCounter();
  }

  function updateLbCounter() {
    var el = document.getElementById('as-lb-counter');
    if (el) el.textContent = _photos.length > 1 ? (_lbIdx + 1) + ' / ' + _photos.length : '';
  }

  // ── Gallery: transform-based slide ──────────────────────────────
  function goToPhoto(idx, animate) {
    if (idx < 0 || idx >= _photos.length) return;
    _photoIdx = idx;
    var track = document.getElementById('as-track');
    if (track) {
      track.style.transition = animate ? 'transform .3s cubic-bezier(.32,.72,0,1)' : 'none';
      track.style.transform = 'translateX(' + (-idx * 100) + '%)';
    }
    loadAdjacentPhotos(idx);
    updatePhotoUI();
  }

  // ── Bind events ─────────────────────────────────────────────────
  function bindAll() {
    var bd    = document.getElementById('as-backdrop');
    var sh    = document.getElementById('as-sheet');
    var gal   = document.getElementById('as-gallery');
    var panel = document.getElementById('as-panel');
    var body  = document.getElementById('as-body');
    var lb    = document.getElementById('as-lb');

    // Backdrop + close btn
    if (bd) bd.addEventListener('click', function () { close('backdrop'); });
    var closeBtn = document.getElementById('as-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function () { close('btn'); });
    document.getElementById('as-lb-close').addEventListener('click', closeLightbox);

    // WA analytics
    var waBtn = document.getElementById('as-wa-btn');
    if (waBtn) waBtn.addEventListener('click', function () {
      if (window._track) _track('article_whatsapp_click', { code: _art ? _art.code : '', color: _selColor ? _selColor.name : '', size: _selSize || '' });
    });

    // Esc / Back
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (document.getElementById('as-lb').classList.contains('as-on')) closeLightbox();
        else close('esc');
      }
    });
    window.addEventListener('popstate', function () {
      if (sh && sh.classList.contains('as-on')) close('back');
    });

    // Focus trap
    if (sh) sh.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var arr = Array.prototype.slice.call(sh.querySelectorAll('button,a,[tabindex]:not([tabindex="-1"])')).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
      if (!arr.length) return;
      if (e.shiftKey) { if (document.activeElement === arr[0]) { e.preventDefault(); arr[arr.length - 1].focus(); } }
      else { if (document.activeElement === arr[arr.length - 1]) { e.preventDefault(); arr[0].focus(); } }
    });

    // ── Touch: galeria ──────────────────────────────────────────
    if (gal) {
      var _gx0 = 0, _gy0 = 0, _gt0 = 0, _gdir = '', _goff = 0;

      gal.addEventListener('touchstart', function (e) {
        var t = e.touches[0];
        _gx0 = t.clientX; _gy0 = t.clientY; _gt0 = Date.now();
        _gdir = ''; _goff = 0;
      }, { passive: true });

      gal.addEventListener('touchmove', function (e) {
        var t = e.touches[0];
        var dx = t.clientX - _gx0, dy = t.clientY - _gy0;
        var adx = Math.abs(dx), ady = Math.abs(dy);
        if (!_gdir && adx + ady > 8) _gdir = adx > ady ? 'h' : 'v';

        if (_gdir === 'h') {
          e.preventDefault();
          var track = document.getElementById('as-track');
          if (track) { track.style.transition = 'none'; track.style.transform = 'translateX(calc(' + (-_photoIdx * 100) + '% + ' + dx + 'px))'; }
        } else if (_gdir === 'v' && dy > 0 && !_panelOpen) {
          e.preventDefault();
          sh.style.transition = 'none';
          sh.style.transform = 'translateY(' + Math.max(0, dy) + 'px)';
          bd.style.opacity = String(Math.max(0, 1 - dy / (window.innerHeight * 0.5)));
          _goff = dy;
        }
      }, { passive: false });

      gal.addEventListener('touchend', function (e) {
        var t = e.changedTouches[0];
        var dx = t.clientX - _gx0, dy = t.clientY - _gy0;
        var adx = Math.abs(dx), ady = Math.abs(dy), dt = Date.now() - _gt0;

        // Tap → lightbox
        if (adx < 10 && ady < 10 && dt < 300) { openLightbox(_photoIdx); return; }

        if (_gdir === 'h') {
          var track = document.getElementById('as-track');
          var threshold = gal.offsetWidth * 0.2;
          var newIdx = _photoIdx;
          if (dx < -threshold && _photoIdx < _photos.length - 1) newIdx++;
          else if (dx > threshold && _photoIdx > 0) newIdx--;
          goToPhoto(newIdx, true);
          if (window._track) _track('article_photo_swipe', { code: _art ? _art.code : '' });
        } else if (_gdir === 'v') {
          var vel = _goff / (Date.now() - _gt0 + 1);
          if (_goff > sh.offsetHeight * 0.3 || vel > 0.5) {
            sh.style.transition = 'transform .32s cubic-bezier(.32,.72,0,1)';
            sh.style.transform = 'translateY(100%)';
            bd.style.transition = 'opacity .32s'; bd.style.opacity = '0';
            setTimeout(function () {
              sh.style.transform = ''; sh.style.transition = '';
              bd.style.opacity = ''; bd.style.transition = '';
              close('swipe');
            }, 330);
          } else {
            sh.style.transition = 'transform .28s cubic-bezier(.32,.72,0,1)';
            sh.style.transform = '';
            bd.style.transition = 'opacity .28s'; bd.style.opacity = '';
            setTimeout(function () { sh.style.transition = ''; bd.style.transition = ''; }, 290);
          }
          _goff = 0;
        } else if (ady < 10 && adx < 10) {
          // Tap mbi galeri pa lëvizje
        }
      }, { passive: true });
    }

    // ── Touch: paneli i detajeve ─────────────────────────────────
    if (panel) {
      var _px0 = 0, _py0 = 0, _pdir = '', _poff = 0, _pt0 = 0;

      panel.addEventListener('touchstart', function (e) {
        var t = e.touches[0];
        _px0 = t.clientX; _py0 = t.clientY; _pdir = ''; _poff = 0; _pt0 = Date.now();
      }, { passive: true });

      panel.addEventListener('touchmove', function (e) {
        var t = e.touches[0];
        var dx = t.clientX - _px0, dy = t.clientY - _py0;
        var adx = Math.abs(dx), ady = Math.abs(dy);
        if (!_pdir && adx + ady > 8) _pdir = adx > ady ? 'h' : 'v';

        if (_pdir === 'v') {
          var bodyEl = document.getElementById('as-body');
          var atTop = !bodyEl || bodyEl.scrollTop <= 0;
          if (!_panelOpen && dy < 0) {
            // Swipe lart → zgjerim live
            e.preventDefault();
            panel.style.transition = 'none';
            var base = panel.offsetHeight - PEEK;
            var newY = Math.max(0, base + dy);
            panel.style.transform = 'translateY(' + newY + 'px)';
            _poff = dy;
          } else if (_panelOpen && dy > 0 && atTop) {
            // Swipe poshtë kur panel i hapur dhe scroll=0 → mbyll
            e.preventDefault();
            panel.style.transition = 'none';
            panel.style.transform = 'translateY(' + Math.max(0, dy) + 'px)';
            _poff = dy;
          }
        }
      }, { passive: false });

      panel.addEventListener('touchend', function (e) {
        var t = e.changedTouches[0];
        var dx = t.clientX - _px0, dy = t.clientY - _py0;
        var adx = Math.abs(dx), ady = Math.abs(dy);

        if (_pdir === 'v') {
          if (!_panelOpen && _poff < -50) {
            setPanel(true, true);
          } else if (_panelOpen && _poff > 60) {
            setPanel(false, true);
          } else {
            // Kthehu
            setPanel(_panelOpen, true);
          }
        } else if (_pdir === 'h' || (!_pdir && adx > 50 && adx > ady)) {
          // Swipe majtas/djathtas → artikulli tjetër
          if (!_panelOpen) {
            var dir2 = dx < 0 ? 1 : -1;
            var ni = _openIdx + dir2;
            if (ni >= 0 && ni < _openList.length) {
              _openIdx = ni;
              renderContent(_openList[ni]);
            }
          }
        }
      }, { passive: true });
    }
  }

  // ── Lightbox touch ───────────────────────────────────────────────
  function bindLbTouch() {
    var lb = document.getElementById('as-lb');
    if (!lb) return;
    var _tx0 = 0, _ty0 = 0, _scale = 1, _scaleStart = 1, _pt0_lb = 0, _lastTap = 0, _curImg = null;

    function getImg() { var s = lb.querySelector('.as-lb-active img'); return s; }
    function applyScale() { _curImg = getImg(); if (_curImg) _curImg.style.transform = 'scale(' + _scale + ')'; }
    function pinchD(e) { var dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY; return Math.sqrt(dx*dx+dy*dy); }

    lb.addEventListener('touchstart', function (e) {
      _curImg = getImg();
      if (e.touches.length === 2) { _pt0_lb = pinchD(e); _scaleStart = _scale; }
      else {
        _tx0 = e.touches[0].clientX; _ty0 = e.touches[0].clientY;
        var now = Date.now();
        if (now - _lastTap < 300) { e.preventDefault(); _scale = _scale > 1.5 ? 1 : 2.5; if (_curImg) _curImg.style.transition = 'transform .2s'; applyScale(); _lastTap = 0; }
        else { _lastTap = now; }
      }
    }, { passive: false });

    lb.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2) { e.preventDefault(); _scale = Math.min(5, Math.max(1, _scaleStart * (pinchD(e) / _pt0_lb))); _curImg = getImg(); if (_curImg) _curImg.style.transition = 'none'; applyScale(); }
    }, { passive: false });

    lb.addEventListener('touchend', function (e) {
      var t = e.changedTouches[0];
      var dx = t.clientX - _tx0, dy = t.clientY - _ty0;
      var adx = Math.abs(dx), ady = Math.abs(dy);
      if (_scale <= 1) {
        if (ady > 80 && ady > adx) closeLightbox();
        else if (adx > 50 && adx > ady) { lbGo(_lbIdx + (dx < 0 ? 1 : -1)); if (window._track) _track('article_photo_swipe', { code: _art ? _art.code : '' }); }
      }
    }, { passive: true });
  }

  // ── API publike ─────────────────────────────────────────────────
  window.ArticleSheet = {
    open: function (art, list, idx) { inject(); open(art, list, idx); },
    close: function () { close('api'); }
  };

})();
