/* ══════════════════════════════════════════════════════
   SHARED CHROME BEHAVIOUR — navbar pill, hamburger, footer year
   Used by index, photography, and projects.
   ══════════════════════════════════════════════════════ */
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
