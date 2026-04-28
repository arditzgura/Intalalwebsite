/* ============================================================
   Intal Underwear — Shared JavaScript
   ============================================================ */

/* ── Navbar scroll hide / show ──────────────────────────────── */
(function () {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  let lastY = window.scrollY;
  let ticking = false;

  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(function () {
        const currentY = window.scrollY;
        const scrolledDown = currentY > lastY;
        const pastThreshold = currentY > 80;

        if (scrolledDown && pastThreshold) {
          navbar.classList.add('navbar--hidden');
        } else {
          navbar.classList.remove('navbar--hidden');
        }

        navbar.classList.toggle('navbar--scrolled', currentY > 10);
        lastY = currentY;
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
})();

/* ── Filter bar scroll hide / show ──────────────────────────── */
/* Mobile: hide on scroll up, show on scroll down (same as navbar) */
/* Desktop (>900px): always visible, sticky in-flow               */
(function () {
  const bar = document.getElementById('dyn-filter-bar');
  const spacer = document.getElementById('filter-bar-spacer');
  if (!bar) return;
  let lastY = window.scrollY;
  let ticking = false;
  const MOBILE = () => window.innerWidth <= 900;

  function hideBar() {
    bar.classList.add('fb-hidden');
    if (spacer) spacer.style.height = '0';
  }
  function showBar() {
    bar.classList.remove('fb-hidden');
    if (spacer && MOBILE()) spacer.style.height = (bar._openH || bar.offsetHeight) + 'px';
  }

  window._fbResetScroll = function () {
    lastY = window.scrollY;
    showBar();
  };

  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(function () {
        const currentY = window.scrollY;

        if (MOBILE()) {
          const scrolledUp = currentY < lastY;
          const pastThreshold = currentY > 80;
          if (scrolledUp && pastThreshold) {
            hideBar();
          } else {
            showBar();
          }
        } else {
          showBar();
        }

        lastY = currentY;
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
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
