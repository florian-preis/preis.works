/* ══ CONTACT — anti-spam ══ */
const _c = { eu: 'hello', ed: 'preis.works', ph: '+4550', pn: '331370' };
(function() {
  const emailEl = document.getElementById('contact-email');
  if (emailEl) {
    const addr = _c.eu + '@' + _c.ed;
    const a = document.createElement('a');
    a.className = 'contact-reveal';
    a.textContent = addr;
    setTimeout(() => { a.href = 'mai' + 'lto:' + addr; }, 400);
    emailEl.appendChild(a);
  }
  const phoneEl = document.getElementById('contact-phone');
  if (phoneEl) {
    const a = document.createElement('a');
    a.className = 'contact-reveal';
    a.textContent = '+45 50 33 13 70';
    setTimeout(() => { a.href = 'tel:' + _c.ph + _c.pn; }, 400);
    phoneEl.appendChild(a);
  }
})();
