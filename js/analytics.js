/* ============================================================
   Intal — GA4 Custom Events  (Faza 8)
   Kërkon window.gtag të jetë e ngarkuar nga faqja kryesore.
   ============================================================ */

(function () {
  'use strict';

  function ga(eventName, params) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', eventName, params || {});
  }

  /* ── 1. Klikime kontakti (WhatsApp / telefon / email) ─────── */
  function trackContactLinks() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('a[href]');
      if (!el) return;
      var href = el.getAttribute('href') || '';

      if (href.indexOf('wa.me') !== -1) {
        ga('contact_whatsapp', {
          event_category: 'contact',
          event_label: 'whatsapp_click',
          page_location: location.pathname
        });
      } else if (href.indexOf('tel:') === 0) {
        ga('contact_phone', {
          event_category: 'contact',
          event_label: 'phone_click',
          page_location: location.pathname
        });
      } else if (href.indexOf('mailto:') === 0) {
        ga('contact_email', {
          event_category: 'contact',
          event_label: 'email_click',
          page_location: location.pathname
        });
      }
    });
  }

  /* ── 2. view_item — faqet e artikujve (/artikull/slug/) ───── */
  function trackArticlePage() {
    if (location.pathname.indexOf('/artikull/') === -1) return;

    var slug = location.pathname.replace(/^.*\/artikull\//, '').replace(/\/$/, '');

    /* Merre emrin dhe kategorinë nga meta tags ose DOM */
    var title = document.querySelector('h1') || document.querySelector('.art-name');
    var catEl  = document.querySelector('.art-kat') || document.querySelector('[data-kat]');
    var skuEl  = document.querySelector('[data-sku]') || document.querySelector('[data-code]');

    ga('view_item', {
      currency: 'ALL',
      items: [{
        item_id:       skuEl ? (skuEl.dataset.sku || skuEl.dataset.code || slug) : slug,
        item_name:     title ? title.textContent.trim() : slug,
        item_category: catEl ? catEl.textContent.trim() : 'Te brendshme',
        item_brand:    'Intal Albania',
        index:         0
      }]
    });
  }

  /* ── 3. view_item_list — katalogu /artikujt/ dhe /pelhura/ ── */
  function trackCatalogPage() {
    var path = location.pathname;
    var listName = '';

    if (path.indexOf('/artikujt') !== -1)   listName = 'Katalogu Artikujt';
    else if (path.indexOf('/pelhura') !== -1) listName = 'Katalogu Pelhura';

    if (!listName) return;

    ga('view_item_list', {
      item_list_name: listName,
      item_list_id:   listName.toLowerCase().replace(/\s+/g, '_')
    });
  }

  /* ── 4. select_item — klik mbi kartelë artikulli/pelhure ──── */
  function trackCardClicks() {
    document.addEventListener('click', function (e) {
      var card = e.target.closest('a.art-card, a.fab-card, a[href*="/artikull/"], a[href*="/pelhura/"]');
      if (!card) return;

      var href  = card.getAttribute('href') || '';
      var slug  = href.replace(/\/$/, '').split('/').pop();
      var nameEl = card.querySelector('.art-name, .fab-name, h3, h2');

      ga('select_item', {
        items: [{
          item_id:   slug,
          item_name: nameEl ? nameEl.textContent.trim() : slug,
          item_brand: 'Intal Albania'
        }]
      });
    });
  }

  /* ── 5. generate_lead — dërgim formule kontakti ───────────── */
  function trackFormSubmit() {
    var form = document.querySelector('.contact-form, form[data-track="contact"]');
    if (!form) return;
    form.addEventListener('submit', function () {
      ga('generate_lead', {
        event_category: 'contact',
        event_label:    'form_submit'
      });
    });
  }

  /* ── 6. scroll_depth — 25/50/75/90% ───────────────────────── */
  function trackScrollDepth() {
    var fired = {};
    var marks = [25, 50, 75, 90];
    function onScroll() {
      var pct = Math.round(
        ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100
      );
      marks.forEach(function (m) {
        if (!fired[m] && pct >= m) {
          fired[m] = true;
          ga('scroll', { percent_scrolled: m, page_location: location.pathname });
        }
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ── Init ──────────────────────────────────────────────────── */
  function init() {
    trackContactLinks();
    trackArticlePage();
    trackCatalogPage();
    trackCardClicks();
    trackFormSubmit();
    trackScrollDepth();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
