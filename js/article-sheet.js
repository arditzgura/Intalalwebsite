/**
 * article-sheet.js — bottom sheet mobile për artikujt (intalal.com)
 * Hapet me swipe nga poshtë, galeri 4:5, lightbox, WA button.
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
  var _art       = null;   // artikulli aktual
  var _photos    = [];     // fotot aktuale
  var _photoIdx  = 0;      // foto aktive
  var _selColor  = null;   // {name, hex} ose null
  var _selSize   = null;   // string ose null
  var _prevFocus = null;   // fokusi para hapjes
  var _scrollY   = 0;      // scroll katalog
  var _openList  = [];     // lista e artikujve
  var _openIdx   = 0;      // indeksi aktual

  // ── Inject HTML ────────────────────────────────────────────────
  function inject() {
    if (document.getElementById('as-sheet')) return;

    var el = document.createElement('div');
    el.id = 'as-root';
    el.innerHTML =
      // Backdrop
      '<div id="as-backdrop" class="as-backdrop" aria-hidden="true"></div>' +
      // Sheet
      '<div id="as-sheet" class="as-sheet" role="dialog" aria-modal="true" aria-labelledby="as-name" tabindex="-1">' +
        // Handle
        '<div id="as-handle-zone" class="as-handle-zone">' +
          '<div class="as-handle"></div>' +
        '</div>' +
        // Galeria
        '<div id="as-gallery" class="as-gallery">' +
          '<div id="as-track" class="as-track"></div>' +
          '<div id="as-counter" class="as-counter"></div>' +
          '<div id="as-dots-row" class="as-dots-row"></div>' +
        '</div>' +
        // Detajet (scrollable)
        '<div id="as-body" class="as-body">' +
          '<p id="as-code-el" class="as-code-el"></p>' +
          '<h2 id="as-name" class="as-name"></h2>' +
          '<div id="as-price-el" class="as-price-el"></div>' +
          '<div id="as-colors-el" class="as-colors-el"></div>' +
          '<div id="as-sizes-el" class="as-sizes-el"></div>' +
          '<div id="as-comp-el" class="as-comp-el"></div>' +
          '<div id="as-desc-el" class="as-desc-el"></div>' +
        '</div>' +
        // CTA ngjitës
        '<div id="as-cta" class="as-cta">' +
          '<a id="as-wa-btn" class="as-wa-btn" href="#" onclick="return false;">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' +
            'Shkruaj në WhatsApp' +
          '</a>' +
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

    // Galeria
    renderGallery();

    // Kod
    var codeEl = document.getElementById('as-code-el');
    codeEl.textContent = art.code ? 'Kodi: ' + art.code : '';
    codeEl.style.display = art.code ? '' : 'none';

    // Emri
    document.getElementById('as-name').textContent = art.name || '';

    // Çmimi
    renderPrice(art);

    // Ngjyrat
    renderColors(art);

    // Masat
    renderSizes(art);

    // Përbërja
    renderComp(art);

    // Përshkrimi
    renderDesc(art);

    // WA link
    updateWaLink();

    // Scroll body në krye
    var body = document.getElementById('as-body');
    if (body) body.scrollTop = 0;
  }

  function renderGallery() {
    var track = document.getElementById('as-track');
    var counter = document.getElementById('as-counter');
    var dots = document.getElementById('as-dots-row');

    if (!_photos.length) {
      track.innerHTML = '<div class="as-no-photo">&#128085;</div>';
      counter.textContent = '';
      dots.innerHTML = '';
      return;
    }

    // Ndërtoj slide-t — src vetëm tek foto 0 dhe 1 (lazy për të tjerat)
    track.innerHTML = _photos.map(function (src, i) {
      var imgSrc = i <= 1 ? src : '';
      return '<div class="as-slide" data-src="' + src + '" data-i="' + i + '">' +
        '<img ' + (imgSrc ? 'src="' + imgSrc + '"' : '') + ' alt="' + (_art.name || '') + (i + 1 > 1 ? ' foto ' + (i + 1) : '') + '" draggable="false">' +
        '</div>';
    }).join('');

    // Konturuesit vizual
    updatePhotoUI();
  }

  function loadAdjacentPhotos(idx) {
    // Ngarko foton aktuale + fqinjët (±1)
    var track = document.getElementById('as-track');
    if (!track) return;
    var slides = track.querySelectorAll('.as-slide');
    slides.forEach(function (slide, i) {
      if (Math.abs(i - idx) <= 1) {
        var img = slide.querySelector('img');
        if (img && !img.src && slide.dataset.src) {
          img.src = slide.dataset.src;
        }
      }
    });
  }

  function updatePhotoUI() {
    var total = _photos.length;
    var i = _photoIdx;

    // Counter
    var counter = document.getElementById('as-counter');
    counter.textContent = total > 1 ? (i + 1) + ' / ' + total : '';
    counter.style.display = total > 1 ? '' : 'none';

    // Dots (max 7, pastaj fshihen)
    var dots = document.getElementById('as-dots-row');
    if (total > 1 && total <= 7) {
      dots.innerHTML = _photos.map(function (_, j) {
        return '<span class="as-dot' + (j === i ? ' as-dot-on' : '') + '"></span>';
      }).join('');
    } else {
      dots.innerHTML = '';
    }

    // Active slide
    var track = document.getElementById('as-track');
    if (track) {
      track.querySelectorAll('.as-slide').forEach(function (s, j) {
        s.classList.toggle('as-slide-active', j === i);
      });
    }
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
      el.style.display = '';
    } else {
      el.innerHTML = '<span class="as-price-req">Çmim me kërkesë</span>';
      el.style.display = '';
    }
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
        '<span class="as-swatch-dot" style="background:' + hex + ';"></span>' +
        '</button>';
    });
    html += '</div><p id="as-color-name" class="as-color-name"></p>';
    el.innerHTML = html;

    // Bind
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
          // Kthe fotot origjinale
          _photos = (art.photos || []).map(ph).filter(Boolean);
        } else {
          _selColor = { name: label, hex: typeof n === 'object' ? (n.hex || n.color || '#ccc') : '#ccc' };
          el.querySelectorAll('.as-swatch').forEach(function (b) { b.classList.toggle('as-swatch-on', b === btn); });
          document.getElementById('as-color-name').textContent = label;
          // Nëse ngjyra ka foto të veçanta
          var colorPhotos = typeof n === 'object' && n.photos && n.photos.length ? n.photos.map(ph).filter(Boolean) : null;
          if (colorPhotos) {
            _photos = colorPhotos;
            _photoIdx = 0;
            renderGallery();
          }
        }
        updateWaLink();
        if (window._track) _track('article_color_select', { code: art.code, color: label });
      });
    });
  }

  function renderSizes(art) {
    var el = document.getElementById('as-sizes-el');
    var sizes = art.sizes || [];
    if (!sizes.length || sizes.length === 1 && !sizes[0]) {
      el.innerHTML = ''; el.style.display = 'none'; return;
    }
    el.style.display = '';
    var html = '<p class="as-section-label">MASAT</p><div class="as-chips">';
    sizes.forEach(function (s) {
      html += '<button class="as-chip" data-size="' + s + '">' + s + '</button>';
    });
    html += '</div>';
    el.innerHTML = html;
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
    var id = 'as-desc-txt';
    el.innerHTML =
      '<p id="' + id + '" class="as-desc-txt as-desc-clamped">' + art.pershkrim + '</p>' +
      '<button class="as-desc-more" onclick="this.previousElementSibling.classList.toggle(\'as-desc-clamped\');this.textContent=this.previousElementSibling.classList.contains(\'as-desc-clamped\')?\'Më shumë\':\'Më pak\';">Më shumë</button>';
  }

  function updateWaLink() {
    var msg = buildWaMessage(_art, _selColor ? _selColor.name : null, _selSize);
    var url = 'https://wa.me/' + WA_NUM + '?text=' + encodeURIComponent(msg);
    var btn = document.getElementById('as-wa-btn');
    if (btn) {
      btn.href = url;
      btn.onclick = null; // lejo link të funksionojë
    }
  }

  // ── Hapja/mbyllja ───────────────────────────────────────────────
  function open(art, list, idx) {
    inject(); // siguro që ekziston DOM-i
    _scrollY   = window.scrollY || window.pageYOffset;
    _prevFocus = document.activeElement;
    _openList  = list || [art];
    _openIdx   = (typeof idx === 'number') ? idx : 0;

    // Lock scroll (iOS compatible)
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

    // Android Back
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

    // Zbulo scrollin pas animacionit
    setTimeout(function () {
      document.body.style.overflow  = '';
      document.body.style.position  = '';
      document.body.style.top       = '';
      document.body.style.width     = '';
      window.scrollTo(0, _scrollY);
    }, 360);

    // Hiq state-in e history nëse është akoma ky
    if (history.state && history.state.asSheet) {
      history.back();
    }

    if (_prevFocus) { try { _prevFocus.focus(); } catch (e) {} }

    closeLightbox();
    if (window._track) _track('article_sheet_close', { method: method || 'unknown' });
  }

  // ── Lightbox ────────────────────────────────────────────────────
  var _lbIdx = 0;
  var _lbScale = 1;
  var _lbScaleOrigin = { x: 0.5, y: 0.5 };

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
    bindLbTouch();
    if (window._track) _track('article_lightbox_open', { code: _art ? _art.code : '' });
  }

  function closeLightbox() {
    var lb = document.getElementById('as-lb');
    if (lb) lb.classList.remove('as-on');
    _lbScale = 1;
  }

  function lbGo(idx) {
    if (idx < 0 || idx >= _photos.length) return;
    _lbIdx = idx;
    _lbScale = 1;
    var slides = document.querySelectorAll('.as-lb-slide');
    slides.forEach(function (s) {
      var i = parseInt(s.dataset.i);
      s.classList.toggle('as-lb-active', i === idx);
      s.querySelector('img').style.transform = '';
    });
    updateLbCounter();
  }

  function updateLbCounter() {
    var el = document.getElementById('as-lb-counter');
    if (el) el.textContent = _photos.length > 1 ? (_lbIdx + 1) + ' / ' + _photos.length : '';
  }

  // ── Touch: Sheet drag-to-dismiss ────────────────────────────────
  var _shTx0 = 0, _shTy0 = 0, _shTt0 = 0;
  var _shDir = '';  // 'h' | 'v' | ''
  var _shDragging = false;

  function bindAll() {
    var bd  = document.getElementById('as-backdrop');
    var sh  = document.getElementById('as-sheet');
    var gal = document.getElementById('as-gallery');
    var body = document.getElementById('as-body');
    var lb  = document.getElementById('as-lb');

    // Backdrop click → mbyll
    if (bd) bd.addEventListener('click', function () { close('backdrop'); });

    // Esc
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (document.getElementById('as-lb').classList.contains('as-on')) closeLightbox();
        else close('esc');
      }
    });

    // Android Back
    window.addEventListener('popstate', function (e) {
      if (document.getElementById('as-sheet') && document.getElementById('as-sheet').classList.contains('as-on')) {
        close('back');
      }
    });

    // WA button analytics
    var waBtn = document.getElementById('as-wa-btn');
    if (waBtn) waBtn.addEventListener('click', function () {
      if (window._track) _track('article_whatsapp_click', {
        code: _art ? _art.code : '',
        color: _selColor ? _selColor.name : '',
        size: _selSize || ''
      });
    });

    // Lightbox close
    var lbClose = document.getElementById('as-lb-close');
    if (lbClose) lbClose.addEventListener('click', closeLightbox);

    // ── Touch galeria ───────────────────────────────────────────
    if (gal) {
      var _galTx0 = 0, _galTy0 = 0, _galT0 = 0;
      var _galDir = '', _galOffset = 0;
      var _tapTimer = null, _tapX = 0, _tapY = 0;

      gal.addEventListener('touchstart', function (e) {
        var t = e.touches[0];
        _galTx0 = t.clientX; _galTy0 = t.clientY; _galT0 = Date.now();
        _galDir = ''; _galOffset = 0;
        // Regjistroj tap
        _tapX = t.clientX; _tapY = t.clientY;
      }, { passive: true });

      gal.addEventListener('touchmove', function (e) {
        var t = e.touches[0];
        var dx = t.clientX - _galTx0;
        var dy = t.clientY - _galTy0;
        var adx = Math.abs(dx), ady = Math.abs(dy);

        // Axis lock pas 8px
        if (!_galDir && (adx + ady) > 8) {
          _galDir = adx > ady ? 'h' : 'v';
        }

        if (_galDir === 'v' && dy > 0) {
          // Swipe poshtë → tërhiq sheetin
          e.preventDefault();
          sh.style.transition = 'none';
          sh.style.transform = 'translateY(' + Math.max(0, dy) + 'px)';
          bd.style.opacity = String(Math.max(0, 1 - dy / (window.innerHeight * 0.5)));
          _galOffset = dy;
        }
        // 'h' menaxhohet nga slideGallery()
        if (_galDir === 'h') {
          e.preventDefault();
          slideGallery(dx);
        }
      }, { passive: false });

      gal.addEventListener('touchend', function (e) {
        var t = e.changedTouches[0];
        var dx = t.clientX - _galTx0;
        var dy = t.clientY - _galTy0;
        var dt = Date.now() - _galT0;
        var adx = Math.abs(dx), ady = Math.abs(dy);

        // Tap (lëvizje < 10px) → lightbox
        if (adx < 10 && ady < 10 && dt < 300) {
          openLightbox(_photoIdx);
          return;
        }

        if (_galDir === 'v') {
          var vel = _galOffset / dt;
          var threshold = sh.offsetHeight * 0.3;
          if (_galOffset > threshold || vel > 0.5) {
            // Mbylle me animacion
            sh.style.transition = 'transform .32s cubic-bezier(.32,.72,0,1)';
            sh.style.transform = 'translateY(100%)';
            bd.style.transition = 'opacity .32s';
            bd.style.opacity = '0';
            setTimeout(function () {
              sh.style.transform = '';
              sh.style.transition = '';
              bd.style.opacity = '';
              bd.style.transition = '';
              close('swipe');
            }, 330);
          } else {
            // Kthehu
            sh.style.transition = 'transform .28s cubic-bezier(.32,.72,0,1)';
            sh.style.transform = '';
            bd.style.transition = 'opacity .28s';
            bd.style.opacity = '';
            setTimeout(function () { sh.style.transition = ''; bd.style.transition = ''; }, 290);
          }
        } else if (_galDir === 'h') {
          snapGallery(dx);
          if (window._track) _track('article_photo_swipe', { code: _art ? _art.code : '' });
        }
        _galOffset = 0;
      }, { passive: true });
    }

    // ── Touch body (scroll + dismiss kur scrollTop===0) ─────────
    if (body) {
      var _bodyTy0 = 0;
      body.addEventListener('touchstart', function (e) {
        _bodyTy0 = e.touches[0].clientY;
      }, { passive: true });
      body.addEventListener('touchmove', function (e) {
        var dy = e.touches[0].clientY - _bodyTy0;
        // Lejo scroll normal; blloko vetëm nëse scrollTop===0 dhe swipe poshtë
        if (body.scrollTop <= 0 && dy > 0) {
          e.preventDefault();
          sh.style.transition = 'none';
          sh.style.transform = 'translateY(' + Math.max(0, dy * 0.6) + 'px)';
          bd.style.opacity = String(Math.max(0, 1 - (dy * 0.6) / (window.innerHeight * 0.5)));
        }
      }, { passive: false });
      body.addEventListener('touchend', function (e) {
        var dy = e.changedTouches[0].clientY - _bodyTy0;
        var dt = Date.now();
        if (body.scrollTop <= 0 && dy > 80) {
          sh.style.transition = 'transform .32s cubic-bezier(.32,.72,0,1)';
          sh.style.transform = 'translateY(100%)';
          bd.style.transition = 'opacity .32s'; bd.style.opacity = '0';
          setTimeout(function () {
            sh.style.transform = ''; sh.style.transition = '';
            bd.style.opacity = ''; bd.style.transition = '';
            close('swipe');
          }, 330);
        } else if (body.scrollTop <= 0 && dy > 0) {
          sh.style.transition = 'transform .28s cubic-bezier(.32,.72,0,1)';
          sh.style.transform = '';
          bd.style.transition = 'opacity .28s'; bd.style.opacity = '';
          setTimeout(function () { sh.style.transition = ''; bd.style.transition = ''; }, 290);
        }
      }, { passive: true });
    }

    // ── Touch handle ─────────────────────────────────────────────
    var handle = document.getElementById('as-handle-zone');
    if (handle) {
      var _hTy0 = 0;
      handle.addEventListener('touchstart', function (e) {
        _hTy0 = e.touches[0].clientY;
      }, { passive: true });
      handle.addEventListener('touchmove', function (e) {
        var dy = e.touches[0].clientY - _hTy0;
        if (dy > 0) {
          sh.style.transition = 'none';
          sh.style.transform = 'translateY(' + dy + 'px)';
          bd.style.opacity = String(Math.max(0, 1 - dy / (window.innerHeight * 0.5)));
        }
      }, { passive: true });
      handle.addEventListener('touchend', function (e) {
        var dy = e.changedTouches[0].clientY - _hTy0;
        var dt2 = Date.now();
        if (dy > sh.offsetHeight * 0.3) {
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
      }, { passive: true });
    }

    // Focus trap
    if (sh) {
      sh.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var focusable = sh.querySelectorAll('button,a,[tabindex]:not([tabindex="-1"])');
        var arr = Array.prototype.slice.call(focusable).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
        if (!arr.length) return;
        var first = arr[0], last = arr[arr.length - 1];
        if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
        else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
      });
    }
  }

  // ── Galeria me transform (slide custom) ─────────────────────────
  var _galCurrentX = 0;

  function slideGallery(dx) {
    var track = document.getElementById('as-track');
    if (!track) return;
    var base = -_photoIdx * 100;
    var pct = (dx / track.offsetWidth) * 100;
    track.style.transition = 'none';
    track.style.transform = 'translateX(calc(' + base + '% + ' + dx + 'px))';
    _galCurrentX = dx;
  }

  function snapGallery(dx) {
    var track = document.getElementById('as-track');
    if (!track) return;
    var threshold = track.offsetWidth * 0.2;
    var newIdx = _photoIdx;
    if (dx < -threshold && _photoIdx < _photos.length - 1) newIdx = _photoIdx + 1;
    else if (dx > threshold && _photoIdx > 0) newIdx = _photoIdx - 1;
    goToPhoto(newIdx, true);
  }

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

  // ── Lightbox touch ───────────────────────────────────────────────
  var _lbBound = false;
  function bindLbTouch() {
    if (_lbBound) return;
    _lbBound = true;
    var lb = document.getElementById('as-lb');
    if (!lb) return;

    var _tx0 = 0, _ty0 = 0, _t0 = 0;
    var _pt0 = null; // pinch
    var _lastTap = 0;
    var _curImg = null;
    var _scaleStart = 1;
    var _scale = 1;

    function getActiveImg() {
      var s = lb.querySelector('.as-lb-active img');
      return s;
    }

    lb.addEventListener('touchstart', function (e) {
      _curImg = getActiveImg();
      if (e.touches.length === 2) {
        // Pinch start
        var d = pinchDist(e);
        _pt0 = d;
        _scaleStart = _scale;
      } else if (e.touches.length === 1) {
        _tx0 = e.touches[0].clientX; _ty0 = e.touches[0].clientY; _t0 = Date.now();
        // Double tap
        var now = Date.now();
        if (now - _lastTap < 300) {
          e.preventDefault();
          _scale = _scale > 1.5 ? 1 : 2.5;
          if (_curImg) _curImg.style.transition = 'transform .2s';
          applyScale();
          _lastTap = 0;
        } else { _lastTap = now; }
      }
    }, { passive: false });

    lb.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        var d = pinchDist(e);
        _scale = Math.min(5, Math.max(1, _scaleStart * (d / _pt0)));
        _curImg = getActiveImg();
        if (_curImg) { _curImg.style.transition = 'none'; }
        applyScale();
      } else if (e.touches.length === 1 && _scale <= 1) {
        // Swipe për foton tjetër ose poshtë
      }
    }, { passive: false });

    lb.addEventListener('touchend', function (e) {
      var t = e.changedTouches[0];
      var dx = t.clientX - _tx0, dy = t.clientY - _ty0;
      var adx = Math.abs(dx), ady = Math.abs(dy);
      var dt = Date.now() - _t0;
      if (_scale <= 1) {
        if (ady > 80 && ady > adx) { closeLightbox(); }
        else if (adx > 50 && adx > ady) {
          lbGo(_lbIdx + (dx < 0 ? 1 : -1));
          if (window._track) _track('article_photo_swipe', { code: _art ? _art.code : '' });
        }
      }
    }, { passive: true });

    function pinchDist(e) {
      var dx = e.touches[0].clientX - e.touches[1].clientX;
      var dy = e.touches[0].clientY - e.touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function applyScale() {
      _curImg = getActiveImg();
      if (_curImg) _curImg.style.transform = 'scale(' + _scale + ')';
    }
  }

  // ── API publike ─────────────────────────────────────────────────
  window.ArticleSheet = {
    open: function (art, list, idx) {
      inject();
      open(art, list, idx);
    },
    close: function () { close('api'); }
  };

})();
