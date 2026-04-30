/* ============================================================
   Intal Underwear — Shared JavaScript
   ============================================================ */

/* ── Navbar + Filter bar — një listener, fshihen/shfaqen bashkë ─ */
document.addEventListener('DOMContentLoaded', function () {
  const navbar = document.querySelector('.navbar');
  const bar    = document.getElementById('dyn-filter-bar');
  const spacer = document.getElementById('filter-bar-spacer');
  if (!navbar) return;

  let lastY      = window.scrollY;
  let ticking    = false;
  let isHidden   = false;

  function getBarH() {
    if (!bar) return 0;
    /* offsetHeight funksionon vetëm kur display != none */
    var h = bar.offsetHeight;
    if (h) { bar._openH = h; return h; }
    return bar._openH || 0;
  }

  function hideAll() {
    if (isHidden) return;
    isHidden = true;
    navbar.classList.add('navbar--hidden');
    if (bar && bar.style.display !== 'none' && bar.style.display !== '') {
      var barH = getBarH();
      if (barH) {
        bar.style.transform = 'translateY(' + (-(navbar.offsetHeight + barH)) + 'px)';
        if (spacer) spacer.style.height = '0';
      }
    }
  }
  function showAll() {
    if (!isHidden) return;
    isHidden = false;
    navbar.classList.remove('navbar--hidden');
    if (bar) {
      bar.style.transform = 'translateY(0)';
      var h = getBarH();
      if (spacer && h) spacer.style.height = h + 'px';
    }
  }

  /* Thirret nga faqet kur filter bar bëhet i dukshëm (pas render) */
  window._fbResetScroll = function () {
    isHidden = false;  /* reset gjendje që showAll/hideAll të punojnë */
    lastY = window.scrollY;
    /* Nëse navbar ishte i fshehur, sinkronizo edhe filter bar-in */
    if (navbar.classList.contains('navbar--hidden') && bar) {
      var barH = getBarH();
      if (barH) {
        bar.style.transform = 'translateY(' + (-(navbar.offsetHeight + barH)) + 'px)';
        if (spacer) spacer.style.height = '0';
        isHidden = true;
      }
    }
  };

  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(function () {
        const currentY     = window.scrollY;
        const scrolledDown = currentY > lastY;
        const pastThreshold = currentY > 80;

        if (scrolledDown && pastThreshold) { hideAll(); }
        else { showAll(); }

        navbar.classList.toggle('navbar--scrolled', currentY > 10);
        lastY   = currentY;
        ticking = false;
      });
      ticking = true;
    }
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
