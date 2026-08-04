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
  btn.addEventListener('click', e => {
    e.stopPropagation();
    btn.classList.toggle('open');
    menu.classList.toggle('open');
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#navbar') && !e.target.closest('#mobileMenu')) {
      btn.classList.remove('open');
      menu.classList.remove('open');
    }
  });
})();

/* ══ FOOTER YEAR ══ */
document.getElementById('footerCopy').textContent = '© ' + new Date().getFullYear() + ' Florian Preis';
