/* ============================================================
   Intal Underwear — Shared JavaScript
   ============================================================ */

/* ── Navbar + Filter bar — fshihen/shfaqen bashkë ────────── */
document.addEventListener('DOMContentLoaded', function () {
  var navbar = document.querySelector('.navbar');
  if (!navbar) return;

  var lastY   = window.scrollY;
  var ticking = false;

  /* Bar dhe spacer kërkohen gjatë ekzekutimit (mund të shfaqen pas DOMContentLoaded) */
  function bar()    { return document.getElementById('dyn-filter-bar'); }
  function spacer() { return document.getElementById('filter-bar-spacer'); }

  /* Kthen lartësinë e filter bar-it.
     Kur display:none offsetHeight=0 → përdor vlerën e ruajtur _openH */
  function barH() {
    var b = bar();
    if (!b) return 0;
    if (b.offsetHeight) { b._openH = b.offsetHeight; }
    return b._openH || 0;
  }

  function hideAll() {
    navbar.classList.add('navbar--hidden');
    var b = bar();
    if (!b) return;
    /* Fshih filter bar-in vetëm kur është i dukshëm (offsetParent != null = visible) */
    if (b.offsetParent === null) return;
    var h = barH();
    if (!h) return;
    b.style.transform = 'translateY(' + (-(navbar.offsetHeight + h)) + 'px)';
    var sp = spacer(); if (sp) sp.style.height = '0';
  }

  function showAll() {
    navbar.classList.remove('navbar--hidden');
    var b = bar();
    if (!b) return;
    b.style.transform = 'translateY(0)';
    var sp = spacer();
    if (sp) sp.style.height = (b._openH || 0) + 'px';
  }

  /* Thirret nga faqet pas renderimit të filter bar-it.
     Sinkronizon menjëherë transform-in me gjendjen aktuale të navbar-it. */
  window._fbResetScroll = function () {
    lastY = window.scrollY;
    var b = bar();
    if (!b) return;
    if (navbar.classList.contains('navbar--hidden')) {
      /* Navbar është i fshehur — fshih edhe bar-in */
      var h = barH();
      if (h) {
        b.style.transform = 'translateY(' + (-(navbar.offsetHeight + h)) + 'px)';
        var sp = spacer(); if (sp) sp.style.height = '0';
      }
    } else {
      /* Navbar i dukshëm — siguro që bar-i është i dukshëm */
      b.style.transform = 'translateY(0)';
      var sp2 = spacer();
      if (sp2) sp2.style.height = (b._openH || 0) + 'px';
    }
  };

  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var cur = window.scrollY;
      if (cur > lastY && cur > 80) { hideAll(); }
      else                          { showAll(); }
      navbar.classList.toggle('navbar--scrolled', cur > 10);
      lastY   = cur;
      ticking = false;
    });
  }, { passive: true });
});

/* ── Search bar ─────────────────────────────────────────────── */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    /* Krijo search bar-in dhe shtoje pas navbar-it */
    var sb = document.createElement('div');
    sb.id = 'search-bar';
    sb.innerHTML =
      '<i class="ri-search-line"></i>' +
      '<input id="search-input" type="text" placeholder="Kërko artikull, kod..." autocomplete="off">' +
      '<span id="search-count"></span>' +
      '<button id="search-clear" aria-label="Pastro">&#10005;</button>';
    var nav = document.querySelector('.navbar');
    if (nav && nav.parentNode) nav.parentNode.insertBefore(sb, nav.nextSibling);

    var btn   = document.querySelector('.search-btn');
    var inp   = document.getElementById('search-input');
    var clr   = document.getElementById('search-clear');
    var cnt   = document.getElementById('search-count');
    var isOpen = false;

    function filterBar() { return document.getElementById('dyn-filter-bar'); }

    function openSearch() {
      isOpen = true;
      sb.classList.add('open');
      if (btn) btn.classList.add('active');
      /* Fshih filter bar-in — search bar është sipër tij */
      var fb = filterBar();
      if (fb) { fb._searchHidden = fb.style.display; fb.style.display = 'none'; }
      setTimeout(function () { inp.focus(); }, 260);
    }
    function closeSearch() {
      isOpen = false;
      sb.classList.remove('open');
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

    if (btn) btn.addEventListener('click', function () {
      if (isOpen) closeSearch(); else openSearch();
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
        /* Përditëso URL pa rifreskim (vetëm në artikujt.html) */
        if (onArtPage()) {
          var url = q
            ? (window.location.pathname + '?q=' + encodeURIComponent(q))
            : window.location.pathname;
          history.replaceState(null, '', url);
        }
      } else {
        /* Faqe tjetër (home, kontakt…) — ridirektim pas 500ms */
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
    });

    clr.addEventListener('click', function () {
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

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) closeSearch();
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
      /* Prit që artikujt të ngarkohen, pastaj apliko filtrin */
      window._pendingSearchQ = initQ;
    }
  });
})();

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
