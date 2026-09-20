/* ═══════════════════════════════════════════════════════
   LA LUNA NEL POZZO — Calendario disponibilità

   Legge data/availability.json (generato da GitHub Actions unendo i feed
   iCal di Airbnb e Booking.com + le prenotazioni dirette) e mostra un
   calendario a 2 mesi con selezione dell'intervallo.

   Il file viene riletto anche a pagina già aperta: una scheda lasciata lì
   per ore mostrava disponibilità vecchia senza dirlo.

   Semantica: ogni cella è una NOTTE. Il giorno di partenza non è una
   notte, quindi resta selezionabile come arrivo per l'ospite dopo.

   Espone window.LunaAvailability per la validazione del form.
═══════════════════════════════════════════════════════ */

(function initAvailability() {
  const root = document.getElementById('availability');
  if (!root) return;

  const elMonths = document.getElementById('cal-months');
  const elStatus = document.getElementById('cal-status');
  const elUpdated = document.getElementById('cal-updated');
  const elPrev = document.getElementById('cal-prev');
  const elNext = document.getElementById('cal-next');
  const inCheckin = document.getElementById('checkin');
  const inCheckout = document.getElementById('checkout');

  const DAY = 86400000;
  const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  const WEEKDAYS = ['L','M','M','G','V','S','D'];

  const toISO = (ms) => new Date(ms).toISOString().slice(0, 10);
  const fromISO = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const fmtLong = (ms) => new Date(ms).toLocaleDateString('it-IT',
    { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  const now = new Date();
  const TODAY = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  /** Notti occupate, in ISO. Due soli stati: presente = occupata, assente = libera. */
  const nights = new Set();

  const state = {
    loaded: false,
    updatedAt: null,
    sources: null,
    minNights: 2,
    checkinFrom: '15:00',
    checkoutBy: '11:00',
    horizonEnd: TODAY + 540 * DAY,
    cursor: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    checkin: null,
    checkout: null,
    hover: null,
    monthsShown: window.matchMedia('(max-width: 768px)').matches ? 1 : 2,
  };

  /* ── disponibilità ─────────────────────────────────── */

  const isBooked = (ms) => nights.has(toISO(ms));

  /** Tutte le notti in [from, to) sono libere? */
  function rangeIsFree(fromMs, toMs) {
    for (let t = fromMs; t < toMs; t += DAY) if (isBooked(t)) return false;
    return true;
  }

  function canBeCheckin(ms) {
    return ms >= TODAY && ms < state.horizonEnd && !isBooked(ms);
  }

  /** Il giorno di partenza può cadere su una notte occupata da altri (turnover). */
  function canBeCheckout(ms) {
    if (state.checkin === null) return false;
    if (ms <= state.checkin) return false;
    if ((ms - state.checkin) / DAY < state.minNights) return false;
    return rangeIsFree(state.checkin, ms);
  }

  /* ── caricamento dati ──────────────────────────────── */

  async function load({ silent = false } = {}) {
    try {
      // GitHub Pages serve con Cache-Control: max-age=600, quindi il CDN
      // terrebbe il file fino a 10 minuti anche dopo un aggiornamento.
      // `cache: no-cache` convince il browser ma non l'edge: serve un URL
      // diverso. Granularità al minuto — il file pesa meno di 1 KB.
      const bust = Math.floor(Date.now() / 60000);
      const res = await fetch(`data/availability.json?t=${bust}`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Ricostruisco da zero: una rilettura deve poter LIBERARE notti, non
      // solo aggiungerne. Accumulando nel Set esistente una cancellazione su
      // Airbnb non sarebbe mai comparsa sul sito.
      const fresh = new Set();
      for (const r of data.ranges || []) {
        for (let t = fromISO(r.from); t < fromISO(r.to); t += DAY) fresh.add(toISO(t));
      }

      const changed = fresh.size !== nights.size || [...fresh].some((d) => !nights.has(d));
      nights.clear();
      for (const d of fresh) nights.add(d);

      state.minNights = data.minNights || 2;
      state.checkinFrom = data.checkinFrom || state.checkinFrom;
      state.checkoutBy = data.checkoutBy || state.checkoutBy;
      state.sources = data.sources || null;
      state.updatedAt = data.updated ? new Date(data.updated) : null;
      if (data.horizon?.to) state.horizonEnd = fromISO(data.horizon.to);
      state.loaded = true;
      root.classList.remove('cal-unavailable');
      root.classList.remove('cal-loading');

      renderSourceLabel();
      paintUpdated();

      // Se le date già scelte sono appena state prese da qualcun altro,
      // dirlo subito vale più di lasciare una selezione ormai falsa.
      const lost =
        state.checkin !== null &&
        state.checkout !== null &&
        !rangeIsFree(state.checkin, state.checkout);

      if (lost) {
        state.checkin = null;
        state.checkout = null;
        state.hover = null;
        syncForm();
        render();
        elStatus.innerHTML =
          'Le date che avevi scelto sono state appena prenotate altrove. ' +
          'Scegline altre sul calendario.';
        elStatus.classList.add('is-warn');
        return;
      }

      render();
      if (silent && changed) flashUpdated();
    } catch (err) {
      // Un aggiornamento in background che fallisce non deve cancellare un
      // calendario già a schermo: si tiene il dato vecchio e si dice che è vecchio.
      if (state.loaded) {
        paintUpdated();
        return;
      }
      root.classList.remove('cal-loading');
      root.classList.add('cal-unavailable');
      elStatus.innerHTML =
        'Calendario temporaneamente non disponibile. ' +
        '<a href="https://wa.me/393299866890" target="_blank" rel="noopener">Scrivici su WhatsApp</a> ' +
        'e ti confermiamo le date in pochi minuti.';
      elStatus.classList.add('is-warn');
    }
  }

  /* ── freschezza del dato ───────────────────────────── */

  /* L'etichetta diceva "aggiornato 2 ore fa" e restava congelata su quel
     testo per tutta la sessione. Ora si riscrive da sola. */
  function paintUpdated() {
    if (!elUpdated || !state.updatedAt) return;
    const mins = (Date.now() - state.updatedAt.getTime()) / 60000;
    elUpdated.textContent = `aggiornato ${relTime(state.updatedAt)}`;
    // Oltre le 6 ore il dato non è più una garanzia: meglio dirlo.
    elUpdated.classList.toggle('is-stale', mins > 360);
  }

  function flashUpdated() {
    if (!elUpdated) return;
    elUpdated.classList.remove('just-updated');
    void elUpdated.offsetWidth; // forza il restart dell'animazione
    elUpdated.classList.add('just-updated');
  }

  /* Nome delle sorgenti davvero attive. Il sito dichiarava sempre
     "Sincronizzata con Airbnb e Booking.com" anche quando una delle due non
     rispondeva: una promessa che il dato non manteneva. */
  function renderSourceLabel() {
    const el = document.getElementById('cal-sources');
    if (!el || !state.sources) return;

    const live = Object.values(state.sources).filter((s) => s.ok).map((s) => s.label);
    const down = Object.values(state.sources).filter((s) => !s.ok).map((s) => s.label);

    if (!down.length) {
      el.textContent = `Sincronizzata con ${live.join(' e ')}`;
      el.classList.remove('is-warn');
      return;
    }
    el.textContent = live.length
      ? `Sincronizzata con ${live.join(' e ')} — ${down.join(' e ')} non risponde`
      : 'Sincronizzazione non disponibile';
    el.classList.add('is-warn');
  }

  function relTime(d) {
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 2) return 'ora';
    if (mins < 60) return `${mins} minuti fa`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} ${hrs === 1 ? 'ora' : 'ore'} fa`;
    return `il ${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`;
  }

  /* ── rendering ─────────────────────────────────────── */

  function render() {
    elMonths.innerHTML = '';
    for (let i = 0; i < state.monthsShown; i++) {
      const d = new Date(state.cursor);
      elMonths.appendChild(renderMonth(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i, 1)));
    }

    const minMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    elPrev.disabled = state.cursor <= minMonth;
    elNext.disabled = state.cursor >= state.horizonEnd - 31 * DAY;

    renderStatus();
  }

  function renderMonth(firstMs) {
    const first = new Date(firstMs);
    const year = first.getUTCFullYear();
    const month = first.getUTCMonth();

    const wrap = document.createElement('div');
    wrap.className = 'cal-month';
    wrap.innerHTML =
      `<div class="cal-month-name">${MONTHS[month]} ${year}</div>` +
      `<div class="cal-weekdays">${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div>`;

    const grid = document.createElement('div');
    grid.className = 'cal-grid';

    // Lunedì = 0
    const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
    for (let i = 0; i < lead; i++) grid.appendChild(document.createElement('span'));

    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    for (let d = 1; d <= daysInMonth; d++) {
      grid.appendChild(renderDay(Date.UTC(year, month, d)));
    }

    wrap.appendChild(grid);
    return wrap;
  }

  function renderDay(ms) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-day';
    btn.textContent = new Date(ms).getUTCDate();
    btn.dataset.date = toISO(ms);

    const booked = isBooked(ms);
    const past = ms < TODAY || ms >= state.horizonEnd;

    let label = fmtLong(ms);
    if (past) {
      btn.classList.add('is-past');
      btn.disabled = true;
    } else if (booked) {
      btn.classList.add('is-booked');
      // La notte è di un altro ospite, ma la mattina è ancora libera: la data
      // resta valida come NOSTRA partenza (si vende la notte, non la giornata).
      label += isBooked(ms - DAY)
        ? ' — occupato'
        : ` — occupato dalle ${state.checkinFrom}, puoi solo partire entro le ${state.checkoutBy}`;
    } else {
      label += ' — libero';
    }

    // Selezione in corso
    if (state.checkin !== null && ms === state.checkin) btn.classList.add('is-start');
    if (state.checkout !== null && ms === state.checkout) btn.classList.add('is-end');

    const end = state.checkout ?? (state.checkin !== null ? state.hover : null);
    if (state.checkin !== null && end !== null && ms > state.checkin && ms < end) {
      btn.classList.add('is-in-range');
    }

    // Selezionabilità
    const selectable = state.checkin === null || state.checkout !== null
      ? canBeCheckin(ms)
      : canBeCheckout(ms) || canBeCheckin(ms);

    if (!past && !selectable) btn.disabled = true;
    btn.setAttribute('aria-label', label);
    btn.title = label;

    if (!btn.disabled) {
      btn.addEventListener('click', () => pick(ms));
      btn.addEventListener('mouseenter', () => {
        // Il guard è necessario: render() ricostruisce le celle, quindi senza
        // confronto il nuovo bottone sotto al cursore rilancerebbe l'evento.
        if (state.checkin !== null && state.checkout === null && state.hover !== ms) {
          state.hover = ms;
          render();
        }
      });
    }
    return btn;
  }

  /* ── selezione ─────────────────────────────────────── */

  function pick(ms) {
    if (state.checkin === null || state.checkout !== null) {
      state.checkin = ms;
      state.checkout = null;
      state.hover = null;
    } else if (canBeCheckout(ms)) {
      state.checkout = ms;
      state.hover = null;
    } else {
      // Click prima dell'arrivo o su un intervallo non percorribile:
      // riparte da qui invece di non fare nulla.
      state.checkin = ms;
      state.checkout = null;
    }
    syncForm();
    render();
  }

  function syncForm() {
    if (!inCheckin || !inCheckout) return;
    inCheckin.value = state.checkin !== null ? toISO(state.checkin) : '';
    inCheckout.value = state.checkout !== null ? toISO(state.checkout) : '';
    if (state.checkin !== null) inCheckout.min = toISO(state.checkin + state.minNights * DAY);
  }

  /** Prima notte libera da `fromMs` in poi che regge un soggiorno minimo. */
  function firstFreeFrom(fromMs) {
    for (let t = Math.max(fromMs, TODAY); t < state.horizonEnd; t += DAY) {
      if (canBeCheckin(t) && rangeIsFree(t, t + state.minNights * DAY)) return t;
    }
    return null;
  }

  /** Nei mesi a schermo c'è almeno un giorno scegliibile? */
  function visibleHasFreeDay() {
    return [...elMonths.querySelectorAll('.cal-day')].some((b) => !b.disabled);
  }

  function renderStatus() {
    elStatus.classList.remove('is-warn');

    if (state.checkin === null) {
      // Un mese tutto pieno mostrava 28 caselle spente e sotto, imperterrito,
      // "Tocca il giorno di arrivo": sembrava rotto invece che pieno.
      if (state.loaded && !visibleHasFreeDay()) {
        // Si cerca avanti, ma se davanti non c'è nulla si guarda anche
        // indietro: chi ha sfogliato troppo in là va riportato sulle date
        // libere, non mandato via su WhatsApp.
        const target = firstFreeFrom(state.cursor) ?? firstFreeFrom(TODAY);
        elStatus.classList.add('is-warn');
        elStatus.innerHTML = target
          ? `Nessuna disponibilità in questo periodo. ` +
            `<button type="button" class="cal-jump" data-goto="${toISO(target)}">` +
            `Vai al ${fmtLong(target)}</button>`
          : 'Nessuna disponibilità nei prossimi mesi. ' +
            '<a href="https://wa.me/393299866890" target="_blank" rel="noopener">Scrivici</a> ' +
            'e ti avvisiamo appena si libera qualcosa.';
        return;
      }
      elStatus.innerHTML =
        `Tocca il giorno di <strong>arrivo</strong>, poi quello di <strong>partenza</strong>. ` +
        `Minimo ${state.minNights} notti.`;
      return;
    }
    if (state.checkout === null) {
      elStatus.innerHTML =
        `Arrivo <strong>${fmtLong(state.checkin)}</strong> dalle ${state.checkinFrom} — ` +
        `ora tocca il giorno di partenza.`;
      return;
    }
    const n = (state.checkout - state.checkin) / DAY;
    elStatus.innerHTML =
      `<strong>${fmtLong(state.checkin)}</strong> dalle ${state.checkinFrom} → ` +
      `<strong>${fmtLong(state.checkout)}</strong> entro le ${state.checkoutBy} · ` +
      `${n} ${n === 1 ? 'notte' : 'notti'} · disponibile. ` +
      `Compila il modulo qui sotto per inviare la richiesta.`;
  }

  /* ── navigazione ───────────────────────────────────── */

  const shiftMonth = (delta) => {
    const d = new Date(state.cursor);
    state.cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1);
    render();
  };

  elPrev.addEventListener('click', () => shiftMonth(-1));
  elNext.addEventListener('click', () => shiftMonth(1));

  elStatus.addEventListener('click', (e) => {
    const iso = e.target.closest('.cal-jump')?.dataset.goto;
    if (!iso) return;
    const d = new Date(fromISO(iso));
    state.cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    render();
  });

  elMonths.addEventListener('mouseleave', () => {
    if (state.hover !== null) { state.hover = null; render(); }
  });

  window.matchMedia('(max-width: 768px)').addEventListener('change', (e) => {
    state.monthsShown = e.matches ? 1 : 2;
    render();
  });

  /* ── API per il form ───────────────────────────────── */

  window.LunaAvailability = {
    get minNights() { return state.minNights; },
    get times() { return { checkinFrom: state.checkinFrom, checkoutBy: state.checkoutBy }; },
    get loaded() { return state.loaded; },
    refresh: () => load({ silent: true }),

    /** @returns {{ok:boolean, reason?:string}} */
    check(checkinISO, checkoutISO) {
      if (!state.loaded) return { ok: true }; // dati assenti: non blocchiamo la richiesta
      const a = fromISO(checkinISO);
      const b = fromISO(checkoutISO);
      if (a < TODAY) return { ok: false, reason: 'La data di arrivo è nel passato.' };
      if ((b - a) / DAY < state.minNights) {
        return { ok: false, reason: `Il soggiorno minimo è di ${state.minNights} notti.` };
      }
      for (let t = a; t < b; t += DAY) {
        if (isBooked(t)) {
          return { ok: false, reason: `${fmtLong(t)} non è disponibile. Scegli altre date sul calendario.` };
        }
      }
      return { ok: true };
    },
    scrollToCalendar() {
      root.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  };

  /* Date digitate a mano nel form → riflesse sul calendario */
  for (const input of [inCheckin, inCheckout]) {
    input?.addEventListener('change', () => {
      if (inCheckin.value) state.checkin = fromISO(inCheckin.value);
      state.checkout = inCheckout.value ? fromISO(inCheckout.value) : null;
      render();
    });
  }

  /* ── aggiornamento a pagina aperta ─────────────────── */

  /* Il sync gira su GitHub Actions ogni poche ore. Una scheda lasciata aperta
     restava ferma al dato del caricamento: qualcuno poteva scegliere notti
     appena vendute. Tre inneschi, tutti a costo quasi nullo (< 1 KB a giro). */

  const REFRESH_MS = 5 * 60 * 1000;   // ricontrollo periodico, solo se visibile
  const STALE_MS = 2 * 60 * 1000;     // soglia per il rientro sulla scheda
  let lastFetch = Date.now();

  function maybeRefresh(minAge) {
    if (document.hidden) return;
    if (Date.now() - lastFetch < minAge) return;
    lastFetch = Date.now();
    load({ silent: true });
  }

  // 1. si torna sulla scheda dopo averla lasciata
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) maybeRefresh(STALE_MS);
  });
  window.addEventListener('focus', () => maybeRefresh(STALE_MS));

  // 2. ricontrollo periodico mentre la pagina è in primo piano
  setInterval(() => maybeRefresh(REFRESH_MS), 60000);

  // 3. l'etichetta "aggiornato N ore fa" si riscrive da sola ogni minuto
  setInterval(paintUpdated, 60000);

  // Finché i dati non arrivano il calendario è inerte: mostrare giorni
  // "liberi" prima di conoscere le prenotazioni sarebbe peggio di non mostrarli.
  root.classList.add('cal-loading');
  render();
  load();
})();
