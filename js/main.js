/* ═══════════════════════════════════════════════════════
   LA LUNA NEL POZZO — Main JS
═══════════════════════════════════════════════════════ */

/* ── AMBIENTE ───────────────────────────────────────── */
/* Una sola definizione di "siamo su mobile", usata da parallasse, mappa e
   lightbox: la soglia coincide con il breakpoint di mobile.css. */
const mqMobile  = window.matchMedia('(max-width: 768px)');
const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const isMobile  = () => mqMobile.matches;

/* Blocco scroll di sfondo (menu, lightbox).
   position:fixed sul body perde la posizione di scroll: la salvo e la
   ripristino, altrimenti chiudendo l'overlay si torna in cima alla pagina. */
let scrollLockY = 0;
let scrollLocks = 0;

function lockScroll() {
  if (++scrollLocks > 1) return;
  scrollLockY = window.scrollY;
  document.body.style.top = `-${scrollLockY}px`;
  document.body.classList.add('no-scroll');
}

function unlockScroll() {
  if (scrollLocks === 0 || --scrollLocks > 0) return;
  document.body.classList.remove('no-scroll');
  document.body.style.top = '';
  // behavior:'instant' scavalca lo `scroll-behavior: smooth` dell'html:
  // altrimenti la pagina riparte da zero e risale scorrendo sotto gli occhi.
  window.scrollTo({ top: scrollLockY, left: 0, behavior: 'instant' });
}

/* ── NAVBAR: scroll behavior + mobile menu ──────────── */
const navbar   = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks  = document.querySelector('.nav-links');

/* Lo scroll su mobile arriva a raffica: senza rAF il listener gira decine di
   volte per fotogramma e legge il layout ogni volta. */
let navTicking = false;
window.addEventListener('scroll', () => {
  if (navTicking) return;
  navTicking = true;
  requestAnimationFrame(() => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
    navTicking = false;
  });
}, { passive: true });

function setMenu(open) {
  if (navLinks.classList.contains('open') === open) return;
  navLinks.classList.toggle('open', open);
  hamburger.classList.toggle('open', open);
  hamburger.setAttribute('aria-expanded', String(open));
  open ? lockScroll() : unlockScroll();
}

hamburger.addEventListener('click', () => {
  setMenu(!navLinks.classList.contains('open'));
});

// Close mobile menu when nav link clicked
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => setMenu(false));
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') setMenu(false);
});

// Passando a desktop il menu fullscreen sparisce ma il blocco scroll no:
// la pagina resterebbe ferma senza che si veda il perché.
mqMobile.addEventListener('change', e => { if (!e.matches) setMenu(false); });

/* ── SCROLL REVEAL ──────────────────────────────────── */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right')
  .forEach(el => revealObserver.observe(el));

/* ── GALLERY LIGHTBOX ───────────────────────────────── */
const galleryItems = document.querySelectorAll('.gallery-item');
const lightbox     = document.getElementById('lightbox');
const lightboxContent = document.getElementById('lightbox-content');
const lightboxCaption = document.getElementById('lightbox-caption');
const closeLB      = document.getElementById('lightbox-close');
const prevLB       = document.getElementById('lightbox-prev');
const nextLB       = document.getElementById('lightbox-next');

let currentIndex = 0;

const galleryData = Array.from(galleryItems).map(item => ({
  src: item.querySelector('img')?.src || null,
  caption: item.querySelector('.gallery-overlay span')?.textContent || '',
}));

function openLightbox(index) {
  currentIndex = index;
  updateLightbox();
  lightbox.classList.add('active');
  lockScroll();
}

function closeLightbox() {
  if (!lightbox.classList.contains('active')) return;
  lightbox.classList.remove('active');
  unlockScroll();
}

function updateLightbox() {
  const { src, caption } = galleryData[currentIndex];
  lightboxContent.innerHTML = src
    ? `<img src="${src}" alt="${caption}" />`
    : `<div style="padding:3rem;color:#aaa;font-size:1rem;text-align:center;">📸<br/>${caption}<br/><small style="opacity:.5">Foto disponibile presto</small></div>`;
  lightboxCaption.textContent = caption;
}

galleryItems.forEach((item, i) => {
  item.addEventListener('click', () => openLightbox(i));
});

closeLB.addEventListener('click', closeLightbox);

prevLB.addEventListener('click', () => {
  currentIndex = (currentIndex - 1 + galleryData.length) % galleryData.length;
  updateLightbox();
});

nextLB.addEventListener('click', () => {
  currentIndex = (currentIndex + 1) % galleryData.length;
  updateLightbox();
});

lightbox.addEventListener('click', e => {
  if (e.target === lightbox) closeLightbox();
});

document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('active')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') prevLB.click();
  if (e.key === 'ArrowRight') nextLB.click();
});

/* Swipe fra le foto: su telefono è il gesto che ci si aspetta, e i tasti
   laterali restano come alternativa. */
let touchStartX = 0;
let touchStartY = 0;

lightbox.addEventListener('touchstart', e => {
  touchStartX = e.changedTouches[0].clientX;
  touchStartY = e.changedTouches[0].clientY;
}, { passive: true });

lightbox.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  // Soglia + confronto con il movimento verticale: così un tocco fermo o un
  // trascinamento in verticale non cambiano foto per sbaglio.
  if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
  (dx < 0 ? nextLB : prevLB).click();
}, { passive: true });

/* ── BOOKING FORM → WhatsApp ────────────────────────── */
const form = document.getElementById('inquiry-form');

form.addEventListener('submit', e => {
  e.preventDefault();

  const name     = form.name.value.trim();
  const guests   = form.guests.value;
  const checkin  = form.checkin.value;
  const checkout = form.checkout.value;
  const email    = form.email.value.trim();
  const message  = form.message.value.trim();

  if (!name || !checkin || !checkout || !email) {
    showFormError('Compila tutti i campi obbligatori.');
    return;
  }

  if (new Date(checkout) <= new Date(checkin)) {
    showFormError('La data di partenza deve essere dopo quella di arrivo.');
    return;
  }

  // Ultimo controllo contro il calendario sincronizzato: evita che una
  // richiesta parta per date già occupate su Airbnb o Booking.com.
  const avail = window.LunaAvailability?.check(checkin, checkout);
  if (avail && !avail.ok) {
    showFormError(avail.reason, 8000);
    return;
  }

  const nights = Math.ceil((new Date(checkout) - new Date(checkin)) / 86400000);
  const fmt = d => new Date(d).toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });

  const waText = encodeURIComponent(
    `Ciao! Vorrei prenotare *La Luna nel Pozzo* a Molfetta 🌙\n\n` +
    `👤 Nome: ${name}\n` +
    `📅 Arrivo: ${fmt(checkin)} (dalle 15:00)\n` +
    `📅 Partenza: ${fmt(checkout)} (entro le 11:00)\n` +
    `🌙 Notti: ${nights}\n` +
    `👥 Ospiti: ${guests}\n` +
    `✉️ Email: ${email}` +
    (message ? `\n\n💬 ${message}` : '') +
    `\n\nGrazie!`
  );

  const waNumber = '393299866890';
  window.open(`https://wa.me/${waNumber}?text=${waText}`, '_blank');
});

let formErrorTimer;
function showFormError(msg, duration = 3500) {
  let err = form.querySelector('.form-error');
  if (!err) {
    err = document.createElement('p');
    err.className = 'form-error';
    err.style.cssText = 'color:#ff6b6b;font-size:.85rem;margin-bottom:.8rem;text-align:center;';
    form.prepend(err);
  }
  err.textContent = msg;
  clearTimeout(formErrorTimer);
  formErrorTimer = setTimeout(() => err.remove(), duration);
}

/* ── CITY PHOTO PARALLAX ────────────────────────────── */
/* Su desktop è un effetto; su telefono è una scrittura di transform a ogni
   evento di scroll, cioè proprio il carico che fa scattare lo scorrimento.
   Sotto i 768px l'effetto è spento e le foto restano ferme. */
const cityParallaxEls = document.querySelectorAll('[data-parallax]');

let parallaxTicking = false;

function applyCityParallax() {
  parallaxTicking = false;
  cityParallaxEls.forEach(el => {
    const rate = parseFloat(el.dataset.parallax);
    const inner = el.querySelector('.city-photo-inner');
    const img = el.querySelector('img');
    if (!inner || !img) return;
    const rect = inner.getBoundingClientRect();
    const centerOffset = window.innerHeight / 2 - (rect.top + rect.height / 2);
    const shift = centerOffset * rate;
    img.style.transform = `translateY(${shift}px) scale(1.12)`;
  });
}

function onParallaxScroll() {
  if (parallaxTicking) return;
  parallaxTicking = true;
  requestAnimationFrame(applyCityParallax);
}

function clearCityParallax() {
  cityParallaxEls.forEach(el => {
    const img = el.querySelector('img');
    if (img) img.style.transform = '';
  });
}

function syncParallax() {
  const on = cityParallaxEls.length && !isMobile() && !mqReduced.matches;
  window.removeEventListener('scroll', onParallaxScroll);
  if (on) {
    window.addEventListener('scroll', onParallaxScroll, { passive: true });
    applyCityParallax();
  } else {
    clearCityParallax();
  }
}

syncParallax();
mqMobile.addEventListener('change', syncParallax);
mqReduced.addEventListener('change', syncParallax);

/* ── SMOOTH SCROLL for anchor links ────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = navbar.offsetHeight + 20;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

/* ── LEAFLET INTERACTIVE MAP ────────────────────────── */
(function initMap() {
  const mapEl = document.getElementById('interactive-map');
  if (!mapEl || typeof L === 'undefined') return;

  // Via San Giovanni 12, Molfetta — coordinate precise da Google Maps
  const LAT = 41.202644, LNG = 16.597426;

  const map = L.map('interactive-map', {
    center: [LAT, LNG],
    zoom: 18,
    scrollWheelZoom: false,
    zoomControl: false,
    attributionControl: false,
  });

  /* Tile provider.
     Niente CARTO: da settembre 2026 stampa "API KEY REQUIRED" dentro le tile
     restituendo comunque HTTP 200, quindi il guasto è invisibile al codice —
     si vede solo guardando l'immagine. Qui si usano provider senza chiave, con
     un ricambio automatico se il primo smette di rispondere. */
  const PROVIDERS = [
    {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    },
    {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 19,
      attribution: '© <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>',
    },
  ];

  const attributionCtl = L.control
    .attribution({ position: 'bottomright', prefix: false })
    .addTo(map);

  let activeLayer = null;
  let activeIndex = -1;

  function useProvider(i) {
    const provider = PROVIDERS[i];

    // Finiti i ricambi: sfondo pieno invece di una griglia di tile rotte.
    // La scheda con indirizzo e link a Google Maps resta comunque leggibile.
    if (!provider) {
      mapEl.classList.add('map-tiles-failed');
      return;
    }

    if (activeLayer) {
      map.removeLayer(activeLayer);
      attributionCtl.removeAttribution(PROVIDERS[activeIndex].attribution);
    }

    activeIndex = i;
    let errors = 0;

    activeLayer = L.tileLayer(provider.url, { maxZoom: provider.maxZoom });

    // Qualche tile mancante ai bordi è normale; un provider giù le sbaglia
    // tutte. La soglia distingue i due casi.
    activeLayer.on('tileerror', () => {
      if (++errors === 4 && activeIndex === i) useProvider(i + 1);
    });

    activeLayer.addTo(map);
    attributionCtl.addAttribution(provider.attribution);
  }

  useProvider(0);

  /* Zoom in basso a destra come su Airbnb; su telefono la scheda con
     l'indirizzo occupa quell'angolo, quindi i comandi salgono in alto. */
  const zoomCtl = L.control
    .zoom({ position: isMobile() ? 'topright' : 'bottomright' })
    .addTo(map);

  // Airbnb-style pulsing dot icon
  const dotIcon = L.divIcon({
    html: `
      <div class="map-dot-wrap">
        <div class="map-dot-pulse"></div>
        <div class="map-dot-core">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </div>
      </div>`,
    className: '',
    iconSize: [52, 52],
    iconAnchor: [26, 26],
    popupAnchor: [0, -30],
  });

  L.marker([LAT, LNG], { icon: dotIcon }).addTo(map);

  // Force recalc — fixes white tile on file://
  setTimeout(() => map.invalidateSize(), 250);

  // Il riquadro cambia altezza fra breakpoint: senza ricalcolo Leaflet
  // continua a disegnare le tile per la dimensione vecchia.
  window.addEventListener('resize', () => map.invalidateSize(), { passive: true });

  // Scroll zoom: enable on click, disable on leave
  mapEl.addEventListener('click', () => map.scrollWheelZoom.enable());
  mapEl.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

  /* Su telefono la mappa occupa tutta la larghezza: un dito che scorre sopra
     trascinava la mappa invece della pagina, e lo scroll si bloccava lì.
     Un dito = scorri la pagina, due dita = muovi la mappa. */
  const hint = document.createElement('div');
  hint.className = 'map-gesture-hint';
  hint.textContent = 'Usa due dita per muovere la mappa';
  hint.setAttribute('aria-hidden', 'true');
  mapEl.appendChild(hint);

  let hintTimer;
  function showHint() {
    hint.classList.add('is-visible');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.remove('is-visible'), 1600);
  }

  function syncMapGestures() {
    zoomCtl.setPosition(isMobile() ? 'topright' : 'bottomright');
    if (isMobile()) {
      map.dragging.disable();
    } else {
      map.dragging.enable();
      hint.classList.remove('is-visible');
    }
  }

  mapEl.addEventListener('touchstart', e => {
    if (!isMobile()) return;
    if (e.touches.length >= 2) {
      map.dragging.enable();
    } else {
      map.dragging.disable();
      showHint();
    }
  }, { passive: true });

  mapEl.addEventListener('touchend', () => {
    if (isMobile()) map.dragging.disable();
  }, { passive: true });

  syncMapGestures();
  mqMobile.addEventListener('change', syncMapGestures);
})();

/* ── SET min date for date inputs to today ──────────── */
const today = new Date().toISOString().split('T')[0];
document.getElementById('checkin').min  = today;
document.getElementById('checkout').min = today;

document.getElementById('checkin').addEventListener('change', function () {
  document.getElementById('checkout').min = this.value;
});
