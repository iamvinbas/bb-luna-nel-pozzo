/* ═══════════════════════════════════════════════════════
   LA LUNA NEL POZZO — Main JS
═══════════════════════════════════════════════════════ */

/* ── NAVBAR: scroll behavior + mobile menu ──────────── */
const navbar   = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks  = document.querySelector('.nav-links');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  hamburger.classList.toggle('open');
});

// Close mobile menu when nav link clicked
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    hamburger.classList.remove('open');
  });
});

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
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('active');
  document.body.style.overflow = '';
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

  const nights = Math.ceil((new Date(checkout) - new Date(checkin)) / 86400000);
  const fmt = d => new Date(d).toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });

  const waText = encodeURIComponent(
    `Ciao! Vorrei prenotare *La Luna nel Pozzo* a Molfetta 🌙\n\n` +
    `👤 Nome: ${name}\n` +
    `📅 Arrivo: ${fmt(checkin)}\n` +
    `📅 Partenza: ${fmt(checkout)}\n` +
    `🌙 Notti: ${nights}\n` +
    `👥 Ospiti: ${guests}\n` +
    `✉️ Email: ${email}` +
    (message ? `\n\n💬 ${message}` : '') +
    `\n\nGrazie!`
  );

  const waNumber = '393299866890';
  window.open(`https://wa.me/${waNumber}?text=${waText}`, '_blank');
});

function showFormError(msg) {
  let err = form.querySelector('.form-error');
  if (!err) {
    err = document.createElement('p');
    err.className = 'form-error';
    err.style.cssText = 'color:#ff6b6b;font-size:.85rem;margin-bottom:.8rem;text-align:center;';
    form.prepend(err);
  }
  err.textContent = msg;
  setTimeout(() => err.remove(), 3500);
}

/* ── CITY PHOTO PARALLAX ────────────────────────────── */
const cityParallaxEls = document.querySelectorAll('[data-parallax]');

function updateCityParallax() {
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

if (cityParallaxEls.length) {
  window.addEventListener('scroll', updateCityParallax, { passive: true });
  updateCityParallax();
}

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

  // CartoDB Voyager — colorful, clean, Airbnb-like
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(map);

  // Minimal attribution bottom-right
  L.control.attribution({ position: 'bottomright', prefix: false })
    .addAttribution('© <a href="https://carto.com/" target="_blank">CARTO</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a>')
    .addTo(map);

  // Zoom controls bottom-right (Airbnb style)
  L.control.zoom({ position: 'bottomright' }).addTo(map);

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

  // Scroll zoom: enable on click, disable on leave
  mapEl.addEventListener('click', () => map.scrollWheelZoom.enable());
  mapEl.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());
})();

/* ── SET min date for date inputs to today ──────────── */
const today = new Date().toISOString().split('T')[0];
document.getElementById('checkin').min  = today;
document.getElementById('checkout').min = today;

document.getElementById('checkin').addEventListener('change', function () {
  document.getElementById('checkout').min = this.value;
});
