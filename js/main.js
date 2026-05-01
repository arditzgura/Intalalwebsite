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

  function searchBar() { return document.getElementById('search-bar'); }

  function hideAll() {
    navbar.classList.add('navbar--hidden');
    /* Filter bar */
    var b = bar();
    if (b && barIsVisible()) {
      b.style.transform = 'translateY(-' + hideOffset() + 'px)';
      var sp = spacer(); if (sp) sp.style.height = '0';
    }
    /* Search bar — lëviz lart bashkë me navbar-in */
    var sb = searchBar();
    if (sb && !sb.classList.contains('open')) {
      sb.style.transform = 'translateY(-' + (navbar.offsetHeight + EXTRA) + 'px)';
    }
  }

  function showAll() {
    navbar.classList.remove('navbar--hidden');
    /* Filter bar */
    var b = bar();
    if (b) {
      b.style.transform = 'translateY(0)';
      var sp = spacer();
      if (sp) sp.style.height = (b._openH || 0) + 'px';
    }
    /* Search bar */
    var sb = searchBar();
    if (sb) sb.style.transform = 'translateY(0)';
  }

  /* Thirret pas çdo render të filter bar-it.
     Sinkronizon menjëherë me gjendjen aktuale të navbar-it. */
  window._fbResetScroll = function () {
    lastY = window.scrollY;
    if (navbar.classList.contains('navbar--hidden')) {
      hideAll();
    } else {
      showAll();
    }
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
      '<input id="search-input" type="text" placeholder="Kërko..." autocomplete="off" tabindex="-1">' +
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
