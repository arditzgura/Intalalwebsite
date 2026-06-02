/* ============================================================
   Intal Underwear — Shared JavaScript
   ============================================================ */

/* ── Navbar + Filter bar — fshihen/shfaqen bashkë ────────── */
document.addEventListener('DOMContentLoaded', function () {
  var navbar = document.querySelector('.navbar');
  if (!navbar) return;

  var lastY   = window.scrollY;
  var ticking = false;
  var EXTRA   = 4; /* px shtesë — heq çdo border/vijë nga skajet */

  function bar()    { return document.getElementById('dyn-filter-bar'); }
  function spacer() { return document.getElementById('filter-bar-spacer'); }

  /* Lartësia e filter bar-it — ruan vlerën e fundit të njohur si _openH */
  function barH() {
    var b = bar(); if (!b) return 0;
    var h = b.offsetHeight;
    if (h > 0) b._openH = h;
    return b._openH || 0;
  }

  /* Offset total për të fshehur filter bar-in plotësisht jashtë viewport */
  function hideOffset() {
    return navbar.offsetHeight + barH() + EXTRA;
  }

  function barIsVisible() {
    var b = bar(); if (!b) return false;
    return window.getComputedStyle(b).display !== 'none';
  }

  /* Rreshti i kerkimit mobile (nav-search-wrap) — i fiksuar poshtë navbar-it */
  function mobSearchWrap() { return document.getElementById('nav-search-wrap'); }

  function hideAll() {
    navbar.classList.add('navbar--hidden');
    /* Filter bar — transform lart, spacer NUK ndryshon (content mbetet si homepage) */
    var b = bar();
    if (b && barIsVisible()) {
      b.style.transform = 'translateY(-' + hideOffset() + 'px)';
    }
    /* Mobile search row — lëviz lart bashkë me navbar-in */
    var msw = mobSearchWrap();
    if (msw) msw.style.transform = 'translateY(-' + (navbar.offsetHeight + EXTRA) + 'px)';
  }

  function showAll() {
    navbar.classList.remove('navbar--hidden');
    /* Filter bar — kthe transform, spacer NUK ndryshon */
    var b = bar();
    if (b) { b.style.transform = 'translateY(0)'; }
    /* Mobile search row */
    var msw = mobSearchWrap();
    if (msw) msw.style.transform = 'translateY(0)';
  }

  /* Thirret pas çdo render të filter bar-it.
     Sinkronizon MENJËHERË (pa animacion) me gjendjen aktuale të navbar-it. */
  window._fbResetScroll = function () {
    lastY = window.scrollY;
    var b = bar();
    var sp = spacer();
    var msw = mobSearchWrap();

    /* Fik tranzicionet → pozicion i menjëhershëm pa animacion */
    if (b)   b.style.transition   = 'none';
    if (sp)  sp.style.transition  = 'none';
    if (msw) msw.style.transition = 'none';
    navbar.style.transition = 'none';

    if (navbar.classList.contains('navbar--hidden')) { hideAll(); }
    else                                              { showAll(); }

    /* Flush reflow — konfirmo vlerat pa animacion */
    void navbar.offsetHeight;

    /* Rikthe tranzicionet nga stylesheet-i */
    navbar.style.transition = '';
    if (b)   b.style.transition   = '';
    if (sp)  sp.style.transition  = '';
    if (msw) msw.style.transition = '';
  };

  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var cur = window.scrollY;
      if (cur > lastY && cur > 60) { hideAll(); }
      else                          { showAll(); }
      navbar.classList.toggle('navbar--scrolled', cur > 10);
      lastY   = cur;
      ticking = false;
    });
  }, { passive: true });
});

/* ── Search inline (brenda navbar) ─────────────────────────── */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var nav = document.querySelector('.navbar');
    if (!nav) return;

    /* Injekto #nav-search-wrap brenda navbar-right, para butonit search */
    var navRight = nav.querySelector('.navbar-right');
    var wrap = document.createElement('div');
    wrap.id = 'nav-search-wrap';
    wrap.innerHTML =
      '<input id="search-input" type="text" placeholder="Kërko..." autocomplete="off" tabindex="-1" disabled>' +
      '<span id="search-count"></span>' +
      '<button id="search-clear" aria-label="Pastro" tabindex="-1">&#10005;</button>';
    /* Ndarëse midis search dhe butonit */
    var sep = document.createElement('span');
    sep.className = 'search-sep';

    var btn = nav.querySelector('.search-btn');
    if (navRight && btn) {
      navRight.insertBefore(sep, btn);
      navRight.insertBefore(wrap, sep);
    } else if (navRight) {
      navRight.appendChild(wrap);
    }

    var inp = document.getElementById('search-input');
    var clr = document.getElementById('search-clear');
    var cnt = document.getElementById('search-count');
    var isOpen = false;

    function filterBar() { return document.getElementById('dyn-filter-bar'); }

    function openSearch() {
      isOpen = true;
      nav.classList.add('search-open');
      inp.removeAttribute('disabled');
      inp.removeAttribute('tabindex');
      if (btn) btn.classList.add('active');
      /* Fshih filter bar-in ndërkohë që search është aktiv */
      var fb = filterBar();
      if (fb) { fb._searchHidden = fb.style.display; fb.style.display = 'none'; }
      setTimeout(function () { inp.focus(); }, 50);
    }

    function closeSearch() {
      isOpen = false;
      nav.classList.remove('search-open');
      inp.setAttribute('disabled', '');
      inp.setAttribute('tabindex', '-1');
      if (btn) btn.classList.remove('active');
      inp.value = '';
      clr.style.display = 'none';
      cnt.textContent = '';
      /* Kthe filter bar-in */
      var fb = filterBar();
      if (fb && fb._searchHidden !== undefined) {
        fb.style.display = fb._searchHidden || '';
        fb._searchHidden = undefined;
      }
      if (window._searchCallback) window._searchCallback('');
    }

    if (btn) btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isOpen) closeSearch(); else openSearch();
    });

    /* Klik jashtë navbar → mbyll search */
    document.addEventListener('click', function (e) {
      if (isOpen && !nav.contains(e.target)) closeSearch();
    });

    /* Ridirektim tek artikujt.html nëse nuk jemi atje */
    var _redirectTimer = null;
    function onArtPage() {
      return window.location.pathname.indexOf('artikujt') > -1;
    }
    function doRedirect(q) {
      if (q.length < 2) return;
      window.location.href = 'artikujt.html?q=' + encodeURIComponent(q);
    }

    inp.addEventListener('input', function () {
      var q = inp.value.trim();
      clr.style.display = q ? 'block' : 'none';
      if (window._searchCallback) {
        window._searchCallback(q);
        if (onArtPage()) {
          var url = q
            ? (window.location.pathname + '?q=' + encodeURIComponent(q))
            : window.location.pathname;
          history.replaceState(null, '', url);
        }
      } else {
        clearTimeout(_redirectTimer);
        if (q.length >= 2) {
          _redirectTimer = setTimeout(function () { doRedirect(q); }, 500);
        }
      }
    });

    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        clearTimeout(_redirectTimer);
        var q = inp.value.trim();
        if (!window._searchCallback && q) { doRedirect(q); }
      }
      if (e.key === 'Escape') closeSearch();
    });

    clr.addEventListener('click', function (e) {
      e.stopPropagation();
      clearTimeout(_redirectTimer);
      inp.value = '';
      clr.style.display = 'none';
      cnt.textContent = '';
      inp.focus();
      if (window._searchCallback) {
        window._searchCallback('');
        if (onArtPage()) history.replaceState(null, '', window.location.pathname);
      }
    });

    /* Ekspono funksione globale */
    window.openSearch  = openSearch;
    window.closeSearch = closeSearch;
    window._setSearchCount = function (n, total) {
      cnt.textContent = n < total ? n + ' / ' + total : '';
    };

    /* Nëse URL ka ?q= (p.sh. ridirektim nga homepage), hap search-in dhe filtro */
    var urlParams = new URLSearchParams(window.location.search);
    var initQ = urlParams.get('q');
    if (initQ && onArtPage()) {
      window._pendingSearchQ = initQ;
    }
  });
})();

/* ── Share modal ────────────────────────────────────────────── */
window._showShareModal = function(url, title) {
  var ex = document.getElementById('share-modal');
  if (ex) ex.remove();
  var wa = 'https://wa.me/?text=' + encodeURIComponent(url);
  var fb = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url);
  var m = document.createElement('div');
  m.id = 'share-modal';
  m.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.45);';
  m.innerHTML = '<div style="background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:480px;padding:24px 20px 32px;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">'
    + '<span style="font-size:13px;font-weight:600;letter-spacing:.5px;">Shpërndaj</span>'
    + '<button onclick="document.getElementById(\'share-modal\').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888;line-height:1;">&#215;</button>'
    + '</div>'
    + '<div style="display:flex;gap:16px;margin-bottom:20px;">'
    + '<a href="' + wa + '" target="_blank" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;text-decoration:none;">'
    + '<div style="width:52px;height:52px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;">'
    + '<svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.855L0 24l6.335-1.505A11.942 11.942 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.65-.515-5.17-1.41l-.37-.22-3.76.894.945-3.658-.242-.378A9.937 9.937 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>'
    + '</div><span style="font-size:11px;color:#333;">WhatsApp</span></a>'
    + '<a href="' + fb + '" target="_blank" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;text-decoration:none;">'
    + '<div style="width:52px;height:52px;border-radius:50%;background:#1877F2;display:flex;align-items:center;justify-content:center;">'
    + '<svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>'
    + '</div><span style="font-size:11px;color:#333;">Facebook</span></a>'
    + '<div onclick="window._copyShareUrl(\'' + url.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;">'
    + '<div style="width:52px;height:52px;border-radius:50%;background:#f0f0f0;display:flex;align-items:center;justify-content:center;">'
    + '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>'
    + '</div><span id="copy-lbl" style="font-size:11px;color:#333;">Kopjo linkun</span></div>'
    + '</div>'
    + '<div style="font-size:10px;color:#aaa;word-break:break-all;text-align:center;">' + url + '</div>'
    + '</div>';
  m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
};

window._copyShareUrl = function(url) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function() {
      var l = document.getElementById('copy-lbl');
      if (l) { l.textContent = 'U kopjua ✓'; l.style.color = '#25D366'; }
      setTimeout(function() { var m = document.getElementById('share-modal'); if (m) m.remove(); }, 1200);
    });
  } else { window.prompt('Kopjo linkun:', url); }
};

window.shareUrl = window.shareUrl || function(url, title) {
  if (navigator.share) {
    navigator.share({url: url, title: title || 'Intal Underwear'}).catch(function() { window._showShareModal(url, title); });
  } else {
    window._showShareModal(url, title || 'Intal Underwear');
  }
};

/* ── Menu drawer ────────────────────────────────────────────── */
function openMenuDrawer() {
  document.getElementById('menuDrawer').classList.add('open');
  document.getElementById('menuBackdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMenuDrawer() {
  document.getElementById('menuDrawer').classList.remove('open');
  document.getElementById('menuBackdrop').classList.remove('open');
  document.body.style.overflow = '';
}

function goKontakt() {
  closeMenuDrawer();
  var el = document.getElementById('kontakt');
  if (el) {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, document.body.scrollHeight);
  } else {
    window.location.href = 'index.html?goto=kontakt';
  }
}
