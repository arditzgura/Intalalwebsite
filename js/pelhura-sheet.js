/**
 * pelhura-sheet.js — bottom sheet mobile për pelhurat (intalal.com)
 * E njëjtë me article-sheet.js por pa masa/çmim, me API PelhuraSheet.
 */
(function () {
  'use strict';

  var WA_NUM = '355692776636';

  function buildWaMsg(fab, ngjyra) {
    var rows = ['Përshëndetje! Jam i interesuar për këtë pelhurë:\n'];
    rows.push('• Emri: ' + (fab.name || ''));
    if (fab.code) rows.push('• Kodi: ' + fab.code);
    if (ngjyra)   rows.push('• Ngjyra: ' + ngjyra);
    rows.push('\nMë interesojnë çmimi dhe sasia minimale.');
    return rows.join('\n');
  }

  var _fab      = null;
  var _photos   = [];
  var _photoIdx = 0;
  var _selColor = null;
  var _prevFocus= null;
  var _scrollY  = 0;
  var _openList = [];
  var _openIdx  = 0;
  var _panelOpen= false;

  function inject() {
    if (document.getElementById('ps-sheet')) return;
    var el = document.createElement('div');
    el.id = 'ps-root';
    el.innerHTML =
      '<div id="ps-backdrop" class="as-backdrop" aria-hidden="true"></div>' +
      '<div id="ps-sheet" class="as-sheet" role="dialog" aria-modal="true" aria-labelledby="ps-name" tabindex="-1">' +
        '<div id="ps-gallery" class="as-gallery">' +
          '<div id="ps-track" class="as-track"></div>' +
          '<div id="ps-counter" class="as-counter"></div>' +
          '<div id="ps-dots-row" class="as-dots-row"></div>' +
          '<button id="ps-close-btn" class="as-close-btn" aria-label="Mbyll">&#10005;</button>' +
        '</div>' +
        '<div id="ps-panel" class="as-panel">' +
          '<div id="ps-handle-zone" class="as-handle-zone"><div class="as-handle"></div></div>' +
          '<div id="ps-body" class="as-body">' +
            '<p id="ps-code-el" class="as-code-el"></p>' +
            '<h2 id="ps-name" class="as-name"></h2>' +
            '<div id="ps-colors-el" class="as-colors-el"></div>' +
            '<div id="ps-comp-el" class="as-comp-el"></div>' +
            '<div id="ps-desc-el" class="as-desc-el"></div>' +
            '<a id="ps-page-btn" class="ps-page-btn" href="#" style="display:none;">Shiko faqen e plotë →</a>' +
          '</div>' +
          '<div id="ps-cta" class="as-cta">' +
            '<a id="ps-wa-btn" class="as-wa-btn" href="#" onclick="return false;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' +
              'Shkruaj në WhatsApp' +
            '</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="ps-lb" class="as-lb" role="dialog" aria-modal="true" aria-label="Foto e zmadhuar">' +
        '<button id="ps-lb-close" class="as-lb-close" aria-label="Mbyll">&#10005;</button>' +
        '<div id="ps-lb-track" class="as-lb-track"></div>' +
        '<div id="ps-lb-counter" class="as-lb-counter"></div>' +
      '</div>';
    document.body.appendChild(el);
    bindAll();
  }

  function ph(p) { return (!p) ? '' : (typeof p === 'string' ? p : (p.src || p.url || '')); }

  function renderContent(fab, slug) {
    _fab = fab;
    _photos = (fab.photos || []).map(ph).filter(Boolean);
    _photoIdx = 0;
    _selColor = null;
    _panelOpen = false;

    renderGallery();

    var codeEl = document.getElementById('ps-code-el');
    codeEl.textContent = fab.code ? 'Kodi: ' + fab.code : '';
    codeEl.style.display = fab.code ? '' : 'none';

    document.getElementById('ps-name').textContent = fab.name || '';

    renderColors(fab);
    renderComp(fab);
    renderDesc(fab);
    updateWaLink();

    var pageBtn = document.getElementById('ps-page-btn');
    if (pageBtn) {
      if (slug) { pageBtn.href = '/pelhura/' + slug + '/'; pageBtn.style.display = ''; }
      else { pageBtn.style.display = 'none'; }
    }

    setPanel(false, false);
    var body = document.getElementById('ps-body');
    if (body) body.scrollTop = 0;
  }

  function renderGallery() {
    var track = document.getElementById('ps-track');
    var counter = document.getElementById('ps-counter');
    var dots = document.getElementById('ps-dots-row');
    if (!_photos.length) {
      track.innerHTML = '<div class="as-no-photo">&#129525;</div>';
      counter.style.display = 'none'; dots.innerHTML = ''; return;
    }
    track.innerHTML = _photos.map(function (src, i) {
      return '<div class="as-slide" data-src="' + src + '" data-i="' + i + '">' +
        '<img ' + (i <= 1 ? 'src="' + src + '"' : '') + ' alt="' + ((_fab ? _fab.name : '') + (i > 0 ? ' ' + (i + 1) : '')) + '" draggable="false">' +
        '</div>';
    }).join('');
    track.style.transform = 'translateX(0)';
    updatePhotoUI();
  }

  function loadAdjacentPhotos(idx) {
    var track = document.getElementById('ps-track');
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
    var counter = document.getElementById('ps-counter');
    counter.textContent = total > 1 ? (i + 1) + ' / ' + total : '';
    counter.style.display = total > 1 ? '' : 'none';
    var dots = document.getElementById('ps-dots-row');
    if (total > 1 && total <= 7) {
      dots.innerHTML = _photos.map(function (_, j) {
        return '<span class="as-dot' + (j === i ? ' as-dot-on' : '') + '"></span>';
      }).join('');
    } else { dots.innerHTML = ''; }
    var track = document.getElementById('ps-track');
    if (track) track.querySelectorAll('.as-slide').forEach(function (s, j) { s.classList.toggle('as-slide-active', j === i); });
  }

  function renderColors(fab) {
    var el = document.getElementById('ps-colors-el');
    var ngjyrat = fab.ngjyrat || [];
    if (!ngjyrat.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
    el.style.display = '';
    var html = '<p class="as-section-label">NGJYRAT</p><div class="as-swatches">';
    ngjyrat.forEach(function (n, idx) {
      var hex   = typeof n === 'object' ? (n.hex || n.color || '#ccc') : '#ccc';
      var label = typeof n === 'object' ? (n.name || n.label || '') : String(n || '');
      html += '<button class="as-swatch" data-idx="' + idx + '" title="' + label + '" aria-label="Ngjyra ' + label + '">' +
        '<span class="as-swatch-dot" style="background:' + hex + ';"></span></button>';
    });
    html += '</div><p id="ps-color-name" class="as-color-name"></p>';
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
          document.getElementById('ps-color-name').textContent = '';
          _photos = (fab.photos || []).map(ph).filter(Boolean);
        } else {
          _selColor = { name: label, hex: typeof n === 'object' ? (n.hex || n.color || '#ccc') : '#ccc' };
          el.querySelectorAll('.as-swatch').forEach(function (b) { b.classList.toggle('as-swatch-on', b === btn); });
          document.getElementById('ps-color-name').textContent = label;
          var cp = typeof n === 'object' && n.photos && n.photos.length ? n.photos.map(ph).filter(Boolean) : null;
          if (cp) { _photos = cp; _photoIdx = 0; renderGallery(); }
        }
        updateWaLink();
      });
    });
  }

  function renderComp(fab) {
    var el = document.getElementById('ps-comp-el');
    var comp = fab.perberja || fab.composition || [];
    if (!comp.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = '<p class="as-section-label">PËRBËRJA</p>' +
      comp.map(function (c) {
        var mat = typeof c === 'object' ? (c.mat || c.material || c.name || '') : String(c || '');
        var pct = typeof c === 'object' ? (c.pct || c.percent || c.perqindje || c.value || '') : '';
        return '<div class="as-comp-row">' + (pct ? '<span class="as-comp-pct">' + pct + '%</span>' : '') + '<span class="as-comp-mat">' + mat + '</span></div>';
      }).join('');
  }

  function renderDesc(fab) {
    var el = document.getElementById('ps-desc-el');
    var txt = fab.pershkrim || fab.desc || '';
    if (!txt) { el.innerHTML = ''; el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = '<p class="as-desc-txt as-desc-clamped">' + txt + '</p>' +
      '<button class="as-desc-more" onclick="this.previousElementSibling.classList.toggle(\'as-desc-clamped\');this.textContent=this.previousElementSibling.classList.contains(\'as-desc-clamped\')?\'Më shumë\':\'Më pak\';">Më shumë</button>';
  }

  function updateWaLink() {
    if (!_fab) return;
    var msg = buildWaMsg(_fab, _selColor ? _selColor.name : null);
    var btn = document.getElementById('ps-wa-btn');
    if (btn) { btn.href = 'https://wa.me/' + WA_NUM + '?text=' + encodeURIComponent(msg); btn.onclick = null; }
  }

  function getPeek() { return Math.round(window.innerHeight * 0.23); }

  function setPanel(open, animate) {
    _panelOpen = open;
    var panel = document.getElementById('ps-panel');
    if (!panel) return;
    if (animate) {
      panel.style.transition = 'transform .35s cubic-bezier(.32,.72,0,1)';
      setTimeout(function () { panel.style.transition = ''; }, 360);
    } else {
      panel.style.transition = 'none';
    }
    if (open) {
      panel.style.transform = 'translateY(0)';
      var body = document.getElementById('ps-body');
      if (body) body.style.overflowY = 'auto';
    } else {
      panel.style.transform = 'translateY(calc(100% - ' + getPeek() + 'px))';
      var body2 = document.getElementById('ps-body');
      if (body2) { body2.style.overflowY = 'hidden'; body2.scrollTop = 0; }
    }
  }

  function open(fab, list, idx, slug) {
    inject();
    _scrollY   = window.scrollY || window.pageYOffset;
    _prevFocus = document.activeElement;
    _openList  = list || [fab];
    _openIdx   = (typeof idx === 'number') ? idx : 0;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top      = '-' + _scrollY + 'px';
    document.body.style.width    = '100%';

    renderContent(fab, slug);

    var bd = document.getElementById('ps-backdrop');
    var sh = document.getElementById('ps-sheet');
    requestAnimationFrame(function () {
      bd.classList.add('as-on');
      sh.classList.add('as-on');
    });
    history.pushState({ psSheet: true }, '');
    setTimeout(function () { if (sh) sh.focus(); }, 350);
  }

  function close(method) {
    var sh = document.getElementById('ps-sheet');
    var bd = document.getElementById('ps-backdrop');
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
    if (history.state && history.state.psSheet) history.back();
    if (_prevFocus) { try { _prevFocus.focus(); } catch (e) {} }
    closeLightbox();
  }

  var _lbIdx = 0, _lbBound = false;

  function openLightbox(idx) {
    var lb = document.getElementById('ps-lb');
    var track = document.getElementById('ps-lb-track');
    if (!lb || !_photos.length) return;
    _lbIdx = idx;
    track.innerHTML = _photos.map(function (src, i) {
      return '<div class="as-lb-slide' + (i === idx ? ' as-lb-active' : '') + '" data-i="' + i + '">' +
        '<img src="' + src + '" alt="' + (_fab ? _fab.name : '') + ' foto ' + (i + 1) + '" draggable="false">' +
        '</div>';
    }).join('');
    updateLbCounter();
    lb.classList.add('as-on');
    if (!_lbBound) { bindLbTouch(); _lbBound = true; }
  }

  function closeLightbox() {
    var lb = document.getElementById('ps-lb');
    if (lb) lb.classList.remove('as-on');
  }

  function lbGo(idx) {
    if (idx < 0 || idx >= _photos.length) return;
    _lbIdx = idx;
    document.querySelectorAll('#ps-lb .as-lb-slide').forEach(function (s) {
      var active = parseInt(s.dataset.i) === idx;
      s.classList.toggle('as-lb-active', active);
      if (active) { var img = s.querySelector('img'); if (img) img.style.transform = ''; }
    });
    updateLbCounter();
  }

  function updateLbCounter() {
    var el = document.getElementById('ps-lb-counter');
    if (el) el.textContent = _photos.length > 1 ? (_lbIdx + 1) + ' / ' + _photos.length : '';
  }

  function goToPhoto(idx, animate) {
    if (idx < 0 || idx >= _photos.length) return;
    _photoIdx = idx;
    var track = document.getElementById('ps-track');
    if (track) {
      track.style.transition = animate ? 'transform .3s cubic-bezier(.32,.72,0,1)' : 'none';
      track.style.transform = 'translateX(' + (-idx * 100) + '%)';
    }
    loadAdjacentPhotos(idx);
    updatePhotoUI();
  }

  function bindAll() {
    var bd    = document.getElementById('ps-backdrop');
    var sh    = document.getElementById('ps-sheet');
    var gal   = document.getElementById('ps-gallery');
    var panel = document.getElementById('ps-panel');
    var lb    = document.getElementById('ps-lb');

    if (bd) bd.addEventListener('click', function () { close('backdrop'); });
    var closeBtn = document.getElementById('ps-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function () { close('btn'); });
    document.getElementById('ps-lb-close').addEventListener('click', closeLightbox);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (document.getElementById('ps-lb').classList.contains('as-on')) closeLightbox();
        else close('esc');
      }
    });
    window.addEventListener('popstate', function () {
      if (sh && sh.classList.contains('as-on')) close('back');
    });

    if (sh) sh.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var arr = Array.prototype.slice.call(sh.querySelectorAll('button,a,[tabindex]:not([tabindex="-1"])')).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
      if (!arr.length) return;
      if (e.shiftKey) { if (document.activeElement === arr[0]) { e.preventDefault(); arr[arr.length - 1].focus(); } }
      else { if (document.activeElement === arr[arr.length - 1]) { e.preventDefault(); arr[0].focus(); } }
    });

    if (gal) {
      var _gx0 = 0, _gy0 = 0, _gt0 = 0, _gdir = '', _goff = 0;
      gal.addEventListener('touchstart', function (e) {
        var t = e.touches[0]; _gx0 = t.clientX; _gy0 = t.clientY; _gt0 = Date.now(); _gdir = ''; _goff = 0;
      }, { passive: true });
      gal.addEventListener('touchmove', function (e) {
        var t = e.touches[0];
        var dx = t.clientX - _gx0, dy = t.clientY - _gy0;
        var adx = Math.abs(dx), ady = Math.abs(dy);
        if (!_gdir && adx + ady > 8) _gdir = adx > ady ? 'h' : 'v';
        if (_gdir === 'h') {
          e.preventDefault();
          var track = document.getElementById('ps-track');
          if (track) { track.style.transition = 'none'; track.style.transform = 'translateX(calc(' + (-_photoIdx * 100) + '% + ' + dx + 'px))'; }
        } else if (_gdir === 'v' && dy > 0 && !_panelOpen) {
          e.preventDefault();
          sh.style.transition = 'none'; sh.style.transform = 'translateY(' + Math.max(0, dy) + 'px)';
          bd.style.opacity = String(Math.max(0, 1 - dy / (window.innerHeight * 0.5)));
          _goff = dy;
        }
      }, { passive: false });
      gal.addEventListener('touchend', function (e) {
        var t = e.changedTouches[0];
        var dx = t.clientX - _gx0, dy = t.clientY - _gy0;
        var adx = Math.abs(dx), ady = Math.abs(dy), dt = Date.now() - _gt0;
        if (adx < 10 && ady < 10 && dt < 300) { openLightbox(_photoIdx); return; }
        if (_gdir === 'h') {
          var threshold = gal.offsetWidth * 0.2;
          var newIdx = _photoIdx;
          if (dx < -threshold && _photoIdx < _photos.length - 1) newIdx++;
          else if (dx > threshold && _photoIdx > 0) newIdx--;
          goToPhoto(newIdx, true);
        } else if (_gdir === 'v') {
          var vel = _goff / (Date.now() - _gt0 + 1);
          if (_goff > sh.offsetHeight * 0.3 || vel > 0.5) {
            sh.style.transition = 'transform .32s cubic-bezier(.32,.72,0,1)'; sh.style.transform = 'translateY(100%)';
            bd.style.transition = 'opacity .32s'; bd.style.opacity = '0';
            setTimeout(function () { sh.style.transform = ''; sh.style.transition = ''; bd.style.opacity = ''; bd.style.transition = ''; close('swipe'); }, 330);
          } else {
            sh.style.transition = 'transform .28s cubic-bezier(.32,.72,0,1)'; sh.style.transform = '';
            bd.style.transition = 'opacity .28s'; bd.style.opacity = '';
            setTimeout(function () { sh.style.transition = ''; bd.style.transition = ''; }, 290);
          }
          _goff = 0;
        }
      }, { passive: true });
    }

    if (panel) {
      var _px0 = 0, _py0 = 0, _pdir = '', _poff = 0, _pt0 = 0;
      panel.addEventListener('touchstart', function (e) {
        var t = e.touches[0]; _px0 = t.clientX; _py0 = t.clientY; _pdir = ''; _poff = 0; _pt0 = Date.now();
      }, { passive: true });
      panel.addEventListener('touchmove', function (e) {
        var t = e.touches[0];
        var dx = t.clientX - _px0, dy = t.clientY - _py0;
        var adx = Math.abs(dx), ady = Math.abs(dy);
        if (!_pdir && adx + ady > 8) _pdir = adx > ady ? 'h' : 'v';
        if (_pdir === 'v') {
          var bodyEl = document.getElementById('ps-body');
          var atTop = !bodyEl || bodyEl.scrollTop <= 0;
          if (!_panelOpen && dy < 0) {
            e.preventDefault();
            panel.style.transition = 'none';
            var base = panel.offsetHeight - getPeek();
            panel.style.transform = 'translateY(' + Math.max(0, base + dy) + 'px)';
            _poff = dy;
          } else if (_panelOpen && dy > 0 && atTop) {
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
          if (!_panelOpen && _poff < -50) { setPanel(true, true); }
          else if (_panelOpen && _poff > 60) { setPanel(false, true); }
          else { setPanel(_panelOpen, true); }
        } else if (!_pdir && adx > 50 && adx > ady && !_panelOpen) {
          var dir2 = dx < 0 ? 1 : -1;
          var ni = _openIdx + dir2;
          if (ni >= 0 && ni < _openList.length) {
            _openIdx = ni;
            renderContent(_openList[ni].fab, _openList[ni].slug);
          }
        }
      }, { passive: true });
    }
  }

  function bindLbTouch() {
    var lb = document.getElementById('ps-lb');
    if (!lb) return;
    var _tx0 = 0, _ty0 = 0, _scale = 1, _scaleStart = 1, _pt0_lb = 0, _lastTap = 0, _curImg = null;
    function getImg() { return lb.querySelector('.as-lb-active img'); }
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
        else if (adx > 50 && adx > ady) lbGo(_lbIdx + (dx < 0 ? 1 : -1));
      }
    }, { passive: true });
  }

  window.PelhuraSheet = {
    open: function (fab, list, idx, slug) { inject(); open(fab, list, idx, slug); },
    close: function () { close('api'); }
  };

})();
