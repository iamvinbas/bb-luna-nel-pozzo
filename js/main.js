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
/* Le foto stanno tutte dentro un nastro che scorre di lato, con i punti di
   scatto del browser. Prima ogni cambio riscriveva il contenuto: l'immagine
   spariva e ricompariva di colpo, senza inerzia né trascinamento. Così invece
   il dito porta la foto con sé, il rilascio ha lo slancio del sistema, e i
   tasti muovono lo stesso nastro con uno scorrimento morbido. */
const galleryItems = document.querySelectorAll('.gallery-item');
const lightbox     = document.getElementById('lightbox');
const lightboxContent = document.getElementById('lightbox-content');
const lightboxCaption = document.getElementById('lightbox-caption');
const closeLB      = document.getElementById('lightbox-close');
const prevLB       = document.getElementById('lightbox-prev');
const nextLB       = document.getElementById('lightbox-next');

let currentIndex = 0;

const galleryData = Array.from(galleryItems).map((item) => ({
  src: item.querySelector('img')?.src || null,
  alt: item.querySelector('img')?.alt || '',
  caption: item.querySelector('.gallery-overlay span')?.textContent || '',
}));

/* Le diapositive si costruiscono una volta sola, alla prima apertura: farlo
   al caricamento della pagina scaricherebbe sei foto a piena risoluzione che
   forse nessuno guarderà. */
let slidesBuilt = false;

function buildSlides() {
  if (slidesBuilt) return;
  slidesBuilt = true;
  lightboxContent.classList.add('lightbox-track');
  lightboxContent.innerHTML = galleryData
    .map(({ src, alt, caption }) =>
      `<div class="lightbox-slide">` +
      (src
        ? `<img src="${src}" alt="${alt}" draggable="false" />`
        : `<div class="lightbox-missing">📸<br/>${caption}<br/>` +
          `<small>Foto disponibile presto</small></div>`) +
      `</div>`)
    .join('');
}

/** Larghezza di una diapositiva = larghezza del nastro. */
const slideStep = () => lightboxContent.clientWidth || 1;

function goTo(index, behavior = 'smooth') {
  const i = (index + galleryData.length) % galleryData.length;
  lightboxContent.scrollTo({ left: i * slideStep(), behavior });
  setCaption(i);
}

function setCaption(i) {
  if (i === currentIndex && lightboxCaption.dataset.filled) return;
  currentIndex = i;
  lightboxCaption.dataset.filled = '1';
  lightboxCaption.innerHTML =
    `<span class="lightbox-caption-text">${galleryData[i].caption}</span>` +
    `<span class="lightbox-caption-count">${i + 1} / ${galleryData.length}</span>`;
}

function openLightbox(index) {
  buildSlides();
  lightbox.classList.add('active');
  lockScroll();
  // 'auto': si apre già sulla foto toccata, senza farle scorrere davanti
  // tutte quelle che la precedono.
  requestAnimationFrame(() => goTo(index, 'auto'));
}

function closeLightbox() {
  if (!lightbox.classList.contains('active')) return;
  lightbox.classList.remove('active');
  unlockScroll();
}

/* La foto in vista si ricava dalla posizione del nastro: con lo scatto
   attivo il conto è esatto, e vale sia per il dito che per i tasti. */
let lbTicking = false;
lightboxContent.addEventListener('scroll', () => {
  if (lbTicking) return;
  lbTicking = true;
  requestAnimationFrame(() => {
    lbTicking = false;
    setCaption(Math.round(lightboxContent.scrollLeft / slideStep()));
  });
}, { passive: true });

galleryItems.forEach((item, i) => {
  item.addEventListener('click', () => openLightbox(i));
});

closeLB.addEventListener('click', closeLightbox);
prevLB.addEventListener('click', () => goTo(currentIndex - 1));
nextLB.addEventListener('click', () => goTo(currentIndex + 1));

/* Toccare accanto alla foto chiude. Sulla foto no: lì si trascina. */
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox || e.target.classList.contains('lightbox-slide')) {
    closeLightbox();
  }
});

document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('active')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
  if (e.key === 'ArrowRight') goTo(currentIndex + 1);
});

/* Ruotando il telefono la larghezza cambia e il nastro resterebbe fermo fra
   due foto: si rimette in quadro sulla foto corrente. */
window.addEventListener('resize', () => {
  if (!lightbox.classList.contains('active')) return;
  lightboxContent.scrollTo({ left: currentIndex * slideStep(), behavior: 'auto' });
}, { passive: true });

/* ── GALLERIA: indicatore del carosello ─────────────── */
/* Da telefono la galleria scorre di lato. Senza un segno di quante foto ci
   sono, la seconda metà del servizio fotografico non la guarda nessuno. */
(function initGalleryNav() {
  const track = document.getElementById('gallery-grid');
  const nav = document.getElementById('gallery-nav');
  const dots = document.getElementById('gallery-dots');
  const now = document.getElementById('gallery-count-now');
  const all = document.getElementById('gallery-count-all');
  if (!track || !nav || !dots) return;

  const items = [...track.querySelectorAll('.gallery-item')];
  if (items.length < 2) return;

  all.textContent = items.length;
  dots.innerHTML = items.map(() => '<span class="gallery-dot"></span>').join('');
  const dotEls = [...dots.children];

  let current = -1;
  const setCurrent = (i) => {
    if (i === current || i < 0) return;
    current = i;
    now.textContent = i + 1;
    dotEls.forEach((d, k) => d.classList.toggle('is-active', k === i));
  };

  /* La foto "corrente" è quella che occupa il centro del riquadro. Si
     ricava dalla posizione di scorrimento invece che da un osservatore:
     con lo scatto attivo la misura è esatta e costa una divisione. */
  let ticking = false;
  const update = () => {
    ticking = false;
    const step = items[1].offsetLeft - items[0].offsetLeft;
    if (step <= 0) return;
    const i = Math.round(track.scrollLeft / step);
    setCurrent(Math.min(Math.max(i, 0), items.length - 1));
  };

  track.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });

  // L'indicatore serve solo dove il carosello esiste davvero: su schermi
  // larghi la galleria resta una griglia e questa riga non ha senso.
  const sync = () => {
    nav.hidden = !isMobile();
    if (!nav.hidden) update();
  };
  sync();
  mqMobile.addEventListener('change', sync);
  setCurrent(0);
})();

/* ── BOOKING FORM → WhatsApp ────────────────────────── */
/* Il form ha `novalidate`: la validazione nativa è disattivata perché i suoi
   messaggi non sono traducibili né posizionabili. Quindi la facciamo tutta
   qui, campo per campo — prima c'era solo un controllo "non è vuoto" e una
   email come "mario" passava dritta a WhatsApp. */
const form = document.getElementById('inquiry-form');

const FIELDS = ['name', 'email', 'checkin', 'checkout'];

/* Volutamente permissiva: deve scartare gli errori di battitura evidenti
   ("mario", "mario@", "mario@casa"), non arbitrare quali domini esistano. */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const DAY_MS = 86400000;
const parseDay = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return NaN;
  const year = +m[1];
  const month = +m[2] - 1;
  const day = +m[3];
  const ms = Date.UTC(year, month, day);
  const date = new Date(ms);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month &&
    date.getUTCDate() === day
    ? ms
    : NaN;
};
const todayUTC = () => {
  const n = new Date();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
};
const fmtDay = (iso) =>
  new Date(parseDay(iso)).toLocaleDateString('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });

/** Messaggio d'errore per un campo, oppure null se va bene. */
function validateField(id) {
  const el = form.elements[id];
  const value = (el.value || '').trim();

  switch (id) {
    case 'name':
      if (!value) return 'Serve il tuo nome per la richiesta.';
      if (value.length < 2) return 'Scrivi il nome per esteso.';
      return null;

    case 'email':
      if (!value) return 'Serve la tua email per risponderti.';
      if (!EMAIL_RE.test(value)) return 'Controlla la email: manca qualcosa (esempio: mario@email.com).';
      return null;

    case 'checkin': {
      if (!value) return 'Scegli il giorno di arrivo.';
      const d = parseDay(value);
      if (Number.isNaN(d)) return 'Data di arrivo non valida.';
      if (d < todayUTC()) return 'La data di arrivo è già passata.';
      return null;
    }

    case 'checkout': {
      if (!value) return 'Scegli il giorno di partenza.';
      const d = parseDay(value);
      if (Number.isNaN(d)) return 'Data di partenza non valida.';
      const a = parseDay(form.elements.checkin.value);
      if (!Number.isNaN(a)) {
        if (d <= a) return 'La partenza deve venire dopo l’arrivo.';
        const nights = (d - a) / DAY_MS;
        const min = window.LunaAvailability?.minNights ?? 2;
        if (nights < min) {
          return `Il soggiorno minimo è di ${min} notti: scegli almeno il ${fmtDay(
            new Date(a + min * DAY_MS).toISOString().slice(0, 10),
          )}.`;
        }
      }
      return null;
    }

    default:
      return null;
  }
}

/** Mostra o toglie l'errore sotto un campo. */
function setFieldError(id, message) {
  const el = form.elements[id];
  const group = el.closest('.form-group');
  if (!group) return;

  let hint = group.querySelector('.field-error');

  // La nota fissa sotto il campo ("Giorno di arrivo — dalle 15:00") è anch'essa
  // in aria-describedby: va conservata, non sostituita dall'errore.
  const baseHint = group.querySelector('.field-hint')?.id;

  if (!message) {
    el.removeAttribute('aria-invalid');
    if (baseHint) el.setAttribute('aria-describedby', baseHint);
    else el.removeAttribute('aria-describedby');
    group.classList.remove('has-error');
    hint?.remove();
    return;
  }

  if (!hint) {
    hint = document.createElement('p');
    hint.className = 'field-error';
    hint.id = `${id}-error`;
    // Solo aria-live, non role=alert: role=alert interrompe lo screen reader
    // a ogni tasto premuto mentre si corregge il campo.
    hint.setAttribute('aria-live', 'polite');
    group.appendChild(hint);
    // Sotto il campo ma sopra la nota fissa: l'errore è la cosa da leggere prima.
    const fixed = group.querySelector('.field-hint');
    if (fixed) group.insertBefore(hint, fixed);
  }
  hint.textContent = message;
  el.setAttribute('aria-invalid', 'true');
  el.setAttribute('aria-describedby', [baseHint, hint.id].filter(Boolean).join(' '));
  group.classList.add('has-error');
}

function clearAllErrors() {
  FIELDS.forEach((id) => setFieldError(id, null));
  formError.hidden = true;
  formError.textContent = '';
}

/** Riepilogo in cima al form: dice quanti campi mancano e dove guardare. */
const formError = document.createElement('p');
formError.className = 'form-error';
formError.setAttribute('role', 'alert');
formError.hidden = true;
form.prepend(formError);

function showFormError(msg) {
  formError.textContent = msg;
  formError.hidden = false;
}

function validateFormFields() {
  const problems = FIELDS.map((id) => [id, validateField(id)]).filter(([, m]) => m);

  if (!problems.length) return true;

  problems.forEach(([id, message]) => setFieldError(id, message));
  const [firstId] = problems[0];
  showFormError(
    problems.length === 1
      ? 'Manca un dato: controlla il campo evidenziato.'
      : `Mancano ${problems.length} dati: controlla i campi evidenziati.`,
  );
  const first = form.elements[firstId];
  first.focus({ preventScroll: true });
  first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return false;
}

/* Correggere un campo deve togliere subito il suo errore: lasciarlo lì
   mentre si scrive fa credere che la correzione non sia stata registrata. */
FIELDS.forEach((id) => {
  const el = form.elements[id];
  const revalidate = () => {
    if (el.getAttribute('aria-invalid') !== 'true') return;
    const err = validateField(id);
    setFieldError(id, err);
    if (!err && !FIELDS.some((f) => validateField(f))) {
      formError.hidden = true;
    }
  };
  el.addEventListener('input', revalidate);
  el.addEventListener('change', revalidate);
  // blur: primo controllo su un campo appena lasciato, così l'errore si vede
  // prima del submit. Eccezione: se si sta andando proprio sul bottone di
  // invio non si tocca nulla — inserire una riga d'errore qui allunga il form
  // e sposta il bottone da sotto il dito, facendo mancare il tocco. Tanto è
  // il submit stesso, subito dopo, a validare tutto.
  el.addEventListener('blur', (e) => {
    if (e.relatedTarget?.type === 'submit') return;
    if (el.value.trim()) setFieldError(id, validateField(id));
  });
});

/* Il calendario controlla le date appena vengono digitate e segna di rosso le
   notti occupate. Qui si chiude il cerchio sul campo, senza aspettare l'invio. */
window.addEventListener('luna:dates-rejected', (e) => {
  setFieldError('checkin', e.detail.problem + ' Guarda le celle in rosso sul calendario.');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAllErrors();

  if (!validateFormFields()) return;

  // Prima di aprire WhatsApp rileggiamo la disponibilità: così una prenotazione
  // arrivata dopo il caricamento della pagina non passa con dati vecchi.
  const availability = window.LunaAvailability;
  if (!availability?.loaded) {
    showFormError(
      'Non riesco ancora a verificare la disponibilità. Attendi il caricamento del calendario e riprova.',
    );
    availability?.scrollToCalendar();
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  const submitLabel = submitButton?.textContent;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Verifico disponibilità…';
  }

  let refreshed = false;
  try {
    refreshed = await availability.refresh();
  } catch (err) {
    refreshed = false;
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = submitLabel;
    }
  }

  if (!refreshed || !availability.loaded) {
    showFormError(
      'Non riesco a verificare la disponibilità in questo momento. Attendi e riprova.',
    );
    availability.scrollToCalendar();
    return;
  }

  // Il refresh può aver cancellato una selezione diventata occupata. Ripetiamo
  // anche i controlli del modulo prima di leggere le date da inviare.
  clearAllErrors();
  if (!validateFormFields()) return;

  const checkin = form.elements.checkin.value;
  const checkout = form.elements.checkout.value;
  const avail = availability.check(checkin, checkout);
  if (!avail.ok) {
    setFieldError(avail.field ?? 'checkin', avail.reason);
    showFormError(avail.reason);
    availability.scrollToCalendar();
    return;
  }

  const name = form.elements.name.value.trim();
  const email = form.elements.email.value.trim();
  const guests = form.elements.guests.value;
  const message = form.elements.message.value.trim();
  const nights = Math.round((parseDay(checkout) - parseDay(checkin)) / DAY_MS);
  const times = window.LunaAvailability?.times ?? { checkinFrom: '15:00', checkoutBy: '11:00' };

  const waText = encodeURIComponent(
    `Ciao! Vorrei prenotare *La Luna nel Pozzo* a Molfetta 🌙\n\n` +
    `👤 Nome: ${name}\n` +
    `📅 Arrivo: ${fmtDay(checkin)} (dalle ${times.checkinFrom})\n` +
    `📅 Partenza: ${fmtDay(checkout)} (entro le ${times.checkoutBy})\n` +
    `🌙 Notti: ${nights}\n` +
    `👥 Ospiti: ${guests}\n` +
    `✉️ Email: ${email}` +
    (message ? `\n\n💬 ${message}` : '') +
    `\n\nGrazie!`
  );

  const waNumber = '393299866890';
  // Niente 'noopener' fra le windowFeatures: con quello window.open torna
  // sempre null per specifica, e non si distinguerebbe più l'apertura
  // riuscita da un pop-up bloccato. Si stacca il riferimento dopo.
  const win = window.open(`https://wa.me/${waNumber}?text=${waText}`, '_blank');
  if (win) win.opener = null;

  // Se il browser blocca il pop-up la richiesta sparisce nel nulla senza che
  // l'utente se ne accorga: meglio dargli un link da toccare.
  if (!win) {
    showFormError('Il browser ha bloccato l’apertura di WhatsApp.');
    formError.insertAdjacentHTML(
      'beforeend',
      ` <a href="https://wa.me/${waNumber}?text=${waText}" target="_blank" rel="noopener">Apri WhatsApp</a>`,
    );
    return;
  }

  form.querySelector('.form-note').textContent =
    'Richiesta aperta in WhatsApp — premi invio lì per mandarcela.';
});

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

  /* Zoom 18 inquadrava il civico: si vedeva il tetto e nient'altro, quindi
     non si capiva dove fosse la casa rispetto a porto, centro e stazione —
     che è l'unica cosa che interessa a chi deve prenotare. 16 tiene dentro
     il quartiere; da telefono, con un riquadro più corto, si scende ancora
     di un passo per abbracciare la stessa porzione di città. */
  const ZOOM_WIDE = 16;
  const ZOOM_PHONE = 15;
  const startZoom = () => (isMobile() ? ZOOM_PHONE : ZOOM_WIDE);

  const map = L.map('interactive-map', {
    center: [LAT, LNG],
    zoom: startZoom(),
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

  // Se l'utente ha già zoomato o spostato la mappa, la sua scelta vince:
  // riportarla al valore di partenza a ogni rotazione dello schermo sarebbe
  // un dispetto. Il flag cade al primo gesto sulla mappa.
  let mapUntouched = true;
  map.on('zoomstart movestart', () => { mapUntouched = false; });

  function syncMapGestures() {
    zoomCtl.setPosition(isMobile() ? 'topright' : 'bottomright');
    if (mapUntouched) {
      const z = startZoom();
      if (map.getZoom() !== z) map.setView([LAT, LNG], z, { animate: false });
      mapUntouched = true; // setView ha appena alzato il flag: lo rimetto
    }
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

/* ── LIMITE MINIMO DELLE DATE ───────────────────────── */
/* Solo il pavimento "non nel passato", come rete di sicurezza per il caso in
   cui il calendario non riesca a caricarsi. I limiti veri (orizzonte
   pubblicato e soggiorno minimo) li mette calendar.js: il vecchio handler qui
   riscriveva checkout.min con la data di arrivo, riaprendo la porta a
   prenotazioni di una notte sola. */
const today = new Date().toISOString().split('T')[0];
document.getElementById('checkin').min = today;
document.getElementById('checkout').min = today;
