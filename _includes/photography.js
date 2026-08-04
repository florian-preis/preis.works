/* ══════════════════════════════════════════════════════
   PHOTO CONFIGURATION
   ─────────────────────────────────────────────────────
   HOW TO ADD A NEW PHOTO:
     1. Upload the file to the "photography/" folder on GitHub
     2. Add ONE line below following the exact format shown

   NAMING CONVENTION — name every file like this:
     YYYYMMDD_Your caption text.jpg
     e.g.  20260219_Staircase at MBS in Singapore.jpg

   Spaces are fine in filenames. The date and caption are
   read from the filename automatically.

   IMPORTANT: The leading slash in "/photography/..." is required.
   Without it the path resolves incorrectly and images won't load.

   ORDER: Photos are sorted newest → oldest automatically.
══════════════════════════════════════════════════════ */

// ▼▼▼ ADD NEW PHOTOS HERE — one line each ▼▼▼
const PHOTOS = [
  { src: "/photography/20250719_Marina Bay Sands, Singapore.jpg" },
  { src: "/photography/20250809_Frederiksberg Have, Denmark.jpg" },
  { src: "/photography/20250731_Langkawi, Malaysia.jpg" },
  { src: "/photography/20250725_George Town, Malaysia.jpg" },
  { src: "/photography/20250722_Kuala Lumpur, Malaysia.jpg" },
  { src: "/photography/20250721_Chinatown Complex, Singapore.jpg" },
  { src: "/photography/20250315_Skeleton Coast, Namibia.jpg" },
  { src: "/photography/20250314_Spitzkoppe, Namibia.jpg" },
  { src: "/photography/20250312_Sandwich Harbour, Namibia.jpg" },
  { src: "/photography/20250310_Sossusvlei, Namibia.jpg" },
  { src: "/photography/20250118_Bunker Feldstraße, Hamburg, Germany.jpg" },
  { src: "/photography/20241101_Pyramid of Djoser, Cairo, Egypt.jpg" },
  { src: "/photography/20240815_Kiambethu Tea Farm, Nairobi, Kenya.jpg" },
  { src: "/photography/20240810_Lamu Island, Kenya.jpg" },
  { src: "/photography/20240803_Amboseli National Park, Kenya.jpg" },
  { src: "/photography/20240802_Amboseli National Park, Kenya.jpg" },
  { src: "/photography/20240801_Mount Kilimanjaro, Kenya.jpg" },
  { src: "/photography/20240730_The Great Migration, Maasai Mara National Reserve, Kenya.jpg" },
  { src: "/photography/20240730_Maasai Mara National Reserve, Kenya.jpg" },
  { src: "/photography/20240729_Maasai Mara National Reserve, Kenya.jpg" },
  { src: "/photography/20240728_Nairobi National Park, Kenya.jpg" },
  { src: "/photography/20240519_Lyngør Lighthouse, Kjeholmen, Norway.jpg" },
  { src: "/photography/20240511_Santa Maddalena, Dolomites, Italy.jpg" },
  { src: "/photography/20240510_Rifugio Lavaredo, Dolomites, Italy.jpg" },
  { src: "/photography/20240510_Cadini di Misurina, Dolomites, Italy.jpg" },
  { src: "/photography/20240406_Paraisópolis, São Paulo, Brazil.jpg" },
  { src: "/photography/20240329_Cristo Redentor, Rio de Janeiro, Brazil.jpg" },
  { src: "/photography/20240325_Copa Cabana Beach, Rio de Janeiro, Brazil.jpg" },
  { src: "/photography/20240323_Salvador, Brazil.jpg" },
  { src: "/photography/20240322_Salvador, Brazil.jpg" },
  { src: "/photography/20240114_Proclamation of Frederik X. at Christiansborg Palace, Copenhagen, Denmark.jpg" },
  { src: "/photography/20260206_Amalienborg Palace, Copenhagen, Denmark.jpg" },
  { src: "/photography/20260206_Nyhavn, Copenhagen, Denmark.jpg" },
  { src: "/photography/20220813_Frederiksberg Allé, Copenhagen, Denmark.jpg" },
  { src: "/photography/20220813_The Lakes, Copenhagen, Denmark.jpg" },
  { src: "/photography/20230123_Choi Hung Estate, Hong Kong.jpg" },
  { src: "/photography/20230123_Wong Tai Sin District, Hong Kong.jpg" },
  { src: "/photography/20230124_Choi Hung Estate, Hong Kong.jpg" },
  { src: "/photography/20230124_Mong Kok, Hong Kong.jpg" },
  { src: "/photography/20230124_Temple Street Night Market, Hong Kong.jpg" },
  { src: "/photography/20230126_Entalula Beach in El Nido, Palawan, Philippines.jpg" },
  { src: "/photography/20230721_Niagara Falls, Ontario, Canada.jpg" },
  { src: "/photography/20240427_Opera Park, Copenhagen, Denmark.jpg" },
  { src: "/photography/20251011_Grenen, Skagen, Denmark.jpg" },
  { src: "/photography/20251223_Dong Xuan Market in Hanoi, Vietnam.jpg" },
  { src: "/photography/20260102_Ho Chi Minh City, Vietnam.jpg" },
  { src: "/photography/20260103_View from Landmark 81 in Ho Chi Minh City, Vietnam.jpg" },
];
// ▲▲▲ ADD NEW PHOTOS HERE — one line each ▲▲▲

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function parsePhotoFilename(src) {
  // Decode any URL-encoded characters (e.g. %20 → space)
  const decoded = decodeURIComponent(src);
  const full = decoded.split('/').pop().replace(/\.[^.]+$/, '');
  const match = full.match(/^(\d{4})(\d{2})(\d{2})_(.+)$/);
  if (match) {
    const year    = parseInt(match[1], 10);
    const month   = parseInt(match[2], 10);
    const day     = parseInt(match[3], 10);
    const caption = match[4].trim();
    const dateStr = day + ' ' + (MONTHS[month - 1] || '') + ' ' + year;
    return { caption, date: dateStr };
  }
  return { caption: full, date: '' };
}

/* ══ PHOTO GRID ══ */
(function initPhotos() {
  const grid = document.getElementById('photoGrid');
  if (!PHOTOS.length) return;

  const sorted = [...PHOTOS].sort((a, b) => {
    const fn = s => decodeURIComponent(s).split('/').pop();
    const dateA = (fn(a.src).match(/^(\d{8})/) || ['0'])[0];
    const dateB = (fn(b.src).match(/^(\d{8})/) || ['0'])[0];
    return dateB.localeCompare(dateA);
  });

  sorted.forEach((photo, idx) => {
    const item = document.createElement('div');
    item.className = 'photo-item';
    item.dataset.idx = idx;
    const { caption } = parsePhotoFilename(photo.src);
    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = caption;
    img.loading = 'lazy';
    item.appendChild(img);
    item.addEventListener('click', () => openLightbox(idx));
    grid.appendChild(item);
  });

  PHOTOS.length = 0;
  sorted.forEach(p => PHOTOS.push(p));

  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const i = parseInt(entry.target.dataset.idx || 0);
        setTimeout(() => entry.target.classList.add('visible'), i * 35);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.04 });
  document.querySelectorAll('.photo-item').forEach(el => obs.observe(el));
})();

/* ══ LIGHTBOX ══ */
let lbIndex = 0;

function alignMeta() {
  requestAnimationFrame(() => {
    const img    = document.getElementById('lightboxImg');
    const footer = document.querySelector('.lightbox-footer');
    const meta   = document.getElementById('lightboxMeta');
    const imgRect    = img.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    // Set left padding of footer to match image left edge
    const leftOffset = Math.max(16, imgRect.left - footerRect.left);
    footer.style.paddingLeft = leftOffset + 'px';
    // Set meta width to match image width so counter aligns with right edge
    meta.style.width = imgRect.width + 'px';
  });
}

function openLightbox(idx) {
  if (!PHOTOS.length) return;
  lbIndex = idx;
  updateLightbox();
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
  // align after lightbox is visible and image has rendered
  const img = document.getElementById('lightboxImg');
  if (img.complete) alignMeta();
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}
function lightboxNav(dir) {
  lbIndex = (lbIndex + dir + PHOTOS.length) % PHOTOS.length;
  updateLightbox();
}
function updateLightbox() {
  const p = PHOTOS[lbIndex];
  const { caption, date } = parsePhotoFilename(p.src);
  const img = document.getElementById('lightboxImg');
  img.src = p.src;
  img.alt = caption;
  document.getElementById('lightboxCounter').textContent = (lbIndex + 1) + ' / ' + PHOTOS.length;
  document.getElementById('lightboxCaption').textContent = caption;
  document.getElementById('lightboxDate').textContent    = date;
  // Re-align once image has loaded (handles portrait vs landscape)
  img.onload = alignMeta;
  if (img.complete) alignMeta();
}

// Re-align on window resize
window.addEventListener('resize', () => {
  if (document.getElementById('lightbox').classList.contains('open')) alignMeta();
});

document.addEventListener('keydown', e => {
  const lb = document.getElementById('lightbox');
  if (!lb.classList.contains('open')) return;
  if (e.key === 'ArrowLeft')  lightboxNav(-1);
  if (e.key === 'ArrowRight') lightboxNav(1);
  if (e.key === 'Escape')     closeLightbox();
});
document.getElementById('lightbox').addEventListener('click', e => {
  if (e.target.id === 'lightbox') closeLightbox();
});
// Click on the stage (white space next to photo) also closes lightbox
document.getElementById('lightboxStage').addEventListener('click', e => {
  if (e.target.id === 'lightboxStage') closeLightbox();
});

// Mobile swipe support
(function() {
  const lb = document.getElementById('lightbox');
  let touchStartX = 0;
  let touchStartY = 0;
  lb.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  lb.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      lightboxNav(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
})();
