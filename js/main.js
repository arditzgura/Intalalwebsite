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
