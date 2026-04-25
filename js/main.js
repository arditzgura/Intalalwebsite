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
  setTimeout(function(){
    var el = document.getElementById('kontakt');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else { window.location.href = 'index.html#kontakt'; }
  }, 320);
}
