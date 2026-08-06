/* ══════════════════════════════════════════════════════
   SHARED CHROME BEHAVIOUR — navbar pill, hamburger, footer year
   Used by index, photography, and projects.
   ══════════════════════════════════════════════════════ */
/* ══ SCROLL POSITION ══ */
// Pages whose content is built by JavaScript are short at first paint, so the
// browser waits, then applies its saved scroll position after the content has
// appeared. That is what makes the gallery lurch downwards on reload. Turning
// off automatic restoration removes the race: a reload always starts at the top.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

/* ══ NAVBAR PILL ══ */
(function() {
  const nav = document.getElementById('navbar');
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        nav.classList.toggle('scrolled', window.scrollY > 1);
        ticking = false;
      });
      ticking = true;
    }
  });
})();

/* ══ HAMBURGER ══ */
(function() {
  const btn  = document.getElementById('hamburger');
  const menu = document.getElementById('mobileMenu');
  function setMenu(open) {
    btn.classList.toggle('open', open);
    menu.classList.toggle('open', open);
    document.documentElement.classList.toggle('menu-open', open);
    // Stop the page scrolling behind the sheet.
    document.body.style.overflow = open ? 'hidden' : '';
  }
  btn.addEventListener('click', e => {
    e.stopPropagation();
    setMenu(!menu.classList.contains('open'));
  });
  // Tapping a link navigates away, but close first so a back-button return
  // does not land on an open sheet.
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') setMenu(false);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#navbar') && !e.target.closest('#mobileMenu')) setMenu(false);
  });
})();

/* ══ FOOTER YEAR ══ */
document.getElementById('footerCopy').textContent = '© ' + new Date().getFullYear() + ' Florian Preis';
