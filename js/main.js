/* ============================================================
   Intal Underwear — Shared JavaScript
   ============================================================ */

/* ── Navbar + Filter bar — një listener, fshihen/shfaqen bashkë ─ */
document.addEventListener('DOMContentLoaded', function () {
  const navbar = document.querySelector('.navbar');
  const bar    = document.getElementById('dyn-filter-bar');
  const spacer = document.getElementById('filter-bar-spacer');
  if (!navbar) return;

  let lastY   = window.scrollY;
  let ticking = false;

  function hideAll() {
    navbar.classList.add('navbar--hidden');
    if (bar) {
      bar.classList.add('fb-hidden');
      if (spacer) spacer.style.height = '0';
    }
  }
  function showAll() {
    navbar.classList.remove('navbar--hidden');
    if (bar) {
      bar.classList.remove('fb-hidden');
      if (spacer && bar._openH) spacer.style.height = bar._openH + 'px';
    }
  }

  window._fbResetScroll = function () {
    lastY = window.scrollY;
    showAll();
  };

  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(function () {
        const currentY    = window.scrollY;
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
