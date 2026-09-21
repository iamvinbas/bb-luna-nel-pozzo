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
  const elMinStay = document.getElementById('cal-min-stay');
  const elPrev = document.getElementById('cal-prev');
  const elNext = document.getElementById('cal-next');
  const inCheckin = document.getElementById('checkin');
  const inCheckout = document.getElementById('checkout');

  const DAY = 86400000;
  const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  const WEEKDAYS = ['L','M','M','G','V','S','D'];

  const toISO = (ms) => new Date(ms).toISOString().slice(0, 10);
  const fromISO = (s) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!match) return NaN;
    const year = +match[1];
    const month = +match[2] - 1;
    const day = +match[3];
    const ms = Date.UTC(year, month, day);
    const date = new Date(ms);
    return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month &&
      date.getUTCDate() === day
      ? ms
      : NaN;
  };
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
    // Notti digitate a mano che risultano non disponibili: si colorano di
    // rosso sul calendario, così la data scartata si vede dov'è.
    rejected: new Set(),
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

      const configuredMinNights = Number(data.minNights);
      state.minNights = Number.isFinite(configuredMinNights)
        ? Math.max(2, Math.floor(configuredMinNights))
        : 2;
      state.checkinFrom = data.checkinFrom || state.checkinFrom;
      state.checkoutBy = data.checkoutBy || state.checkoutBy;
      state.sources = data.sources || null;
      state.updatedAt = data.updated ? new Date(data.updated) : null;
      const horizonEnd = data.horizon?.to ? fromISO(data.horizon.to) : NaN;
      if (!Number.isNaN(horizonEnd)) state.horizonEnd = horizonEnd;
      state.loaded = true;
      root.classList.remove('cal-unavailable');
      root.classList.remove('cal-loading');

      paintMinStay();
      paintUpdated();
      applyInputBounds();

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
        return true;
      }

      render();
      if (silent && changed) flashUpdated();
      return true;
    } catch (err) {
      // Un aggiornamento in background che fallisce non deve cancellare un
      // calendario già a schermo: si tiene il dato vecchio e si dice che è vecchio.
      if (state.loaded) {
        paintUpdated();
        return false;
      }
      root.classList.remove('cal-loading');
      root.classList.add('cal-unavailable');
      elStatus.innerHTML =
        'Calendario temporaneamente non disponibile. ' +
        '<a href="https://wa.me/393299866890" target="_blank" rel="noopener">Scrivici su WhatsApp</a> ' +
        'e ti confermiamo le date in pochi minuti.';
      elStatus.classList.add('is-warn');
      return false;
    }
  }

  /* ── freschezza del dato ───────────────────────────── */

  function paintMinStay() {
    if (!elMinStay) return;
    const value = elMinStay.querySelector('strong');
    if (!value) return;
    value.textContent = `${state.minNights} ${state.minNights === 1 ? 'notte' : 'notti'}`;
  }

  /* La freschezza resta disponibile nei dati e nei log; al cliente mostriamo
     una dicitura neutra, senza esporre l'età dell'ultimo aggiornamento. */
  function paintUpdated() {
    if (!elUpdated) return;
    elUpdated.textContent = 'Disponibilità sincronizzata automaticamente';
    elUpdated.classList.remove('is-stale');
  }

  function flashUpdated() {
    if (!elUpdated) return;
    elUpdated.classList.remove('just-updated');
    void elUpdated.offsetWidth; // forza il restart dell'animazione
    elUpdated.classList.add('just-updated');
  }

  /** "ora" / "12 minuti fa" / "3 ore fa" / "il 18 set" */
  function relTime(d) {
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 2) return 'ora';
    if (mins < 60) return `${mins} minuti fa`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} ${hrs === 1 ? 'ora' : 'ore'} fa`;
    return `il ${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`;
  }

  /* La riga sulle sorgenti resta quella scritta nell'HTML, sempre uguale.
     Una piattaforma che non risponde è un problema di gestione, non una cosa
     che riguardi l'ospite: il proprietario blocca comunque quelle date da
     Airbnb, che il sito legge. La diagnostica vera sta in availability.json
     e nell'annotazione del run di GitHub Actions, dove la legge chi gestisce. */

  /* ── rendering ─────────────────────────────────────── */

  /* Due passaggi separati, ed è il punto su cui si gioca la reattività.
     Prima ogni tocco svuotava il contenitore e ricostruiva trenta bottoni con
     i rispettivi ascoltatori; col passaggio del mouse succedeva a ogni cella
     attraversata. Ora la struttura si costruisce solo quando cambia il mese e
     ogni interazione riscrive soltanto le classi delle celle già a schermo. */

  let builtKey = '';           // mesi attualmente costruiti
  let dayCells = [];           // { ms, btn } delle celle a schermo

  function render({ rebuild = false } = {}) {
    const key = `${state.cursor}|${state.monthsShown}|${nights.size}`;
    if (rebuild || key !== builtKey) {
      buildMonths();
      builtKey = key;
    }
    paintDays();

    const minMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    elPrev.disabled = state.cursor <= minMonth;
    elNext.disabled = state.cursor >= state.horizonEnd - 31 * DAY;

    renderStatus();
  }

  function buildMonths() {
    const frag = document.createDocumentFragment();
    dayCells = [];

    for (let i = 0; i < state.monthsShown; i++) {
      const d = new Date(state.cursor);
      frag.appendChild(buildMonth(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i, 1)));
    }
    elMonths.replaceChildren(frag);
  }

  function buildMonth(firstMs) {
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
      const ms = Date.UTC(year, month, d);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day';
      btn.textContent = d;
      btn.dataset.date = toISO(ms);
      grid.appendChild(btn);
      dayCells.push({ ms, btn });
    }

    wrap.appendChild(grid);
    return wrap;
  }

  /** Riscrive solo lo stato delle celle già costruite. Niente DOM nuovo. */
  function paintDays() {
    const end = state.checkout ?? (state.checkin !== null ? state.hover : null);

    for (const { ms, btn } of dayCells) {
      const booked = isBooked(ms);
      const past = ms < TODAY || ms >= state.horizonEnd;

      const selectable = past
        ? false
        : state.checkin === null || state.checkout !== null
          ? canBeCheckin(ms)
          : canBeCheckout(ms) || canBeCheckin(ms);

      btn.classList.toggle('is-past', past);
      btn.classList.toggle('is-booked', !past && booked);
      btn.classList.toggle('is-rejected', state.rejected.has(btn.dataset.date));
      btn.classList.toggle('is-start', state.checkin !== null && ms === state.checkin);
      btn.classList.toggle('is-end', state.checkout !== null && ms === state.checkout);
      btn.classList.toggle(
        'is-in-range',
        state.checkin !== null && end !== null && ms > state.checkin && ms < end,
      );
      btn.disabled = past || !selectable;

      let label = fmtLong(ms);
      if (past) label += ' — non prenotabile';
      else if (booked) {
        // La notte è di un altro ospite, ma la mattina è ancora libera: la data
        // resta valida come NOSTRA partenza (si vende la notte, non la giornata).
        label += isBooked(ms - DAY)
          ? ' — occupato'
          : ` — occupato dalle ${state.checkinFrom}, puoi solo partire entro le ${state.checkoutBy}`;
      } else label += ' — libero';

      btn.setAttribute('aria-label', label);
      btn.title = label;
    }
  }

  /* ── interazione: un solo ascoltatore per tutto il calendario ───── */

  const cellDate = (e) => {
    const btn = e.target.closest('.cal-day');
    if (!btn || btn.disabled || !elMonths.contains(btn)) return null;
    return fromISO(btn.dataset.date);
  };

  elMonths.addEventListener('click', (e) => {
    const ms = cellDate(e);
    if (ms !== null) pick(ms);
  });

  /* Anteprima dell'intervallo al passaggio del mouse. Delegata: prima ogni
     cella aveva il proprio ascoltatore e ricostruiva l'intero calendario. */
  elMonths.addEventListener('mouseover', (e) => {
    if (state.checkin === null || state.checkout !== null) return;
    const ms = cellDate(e);
    if (ms === null || state.hover === ms) return;
    state.hover = ms;
    paintDays();
  });

  /* ── scorrimento fra i mesi col dito ───────────────── */

  /* Da telefono si vede un mese per volta e le frecce sono due bersagli
     piccoli in alto: trascinare di lato è il gesto che ci si aspetta. */
  let swipeX = 0;
  let swipeY = 0;
  let swiping = false;

  elMonths.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    swipeX = e.touches[0].clientX;
    swipeY = e.touches[0].clientY;
    swiping = true;
  }, { passive: true });

  elMonths.addEventListener('touchend', (e) => {
    if (!swiping) return;
    swiping = false;
    const dx = e.changedTouches[0].clientX - swipeX;
    const dy = e.changedTouches[0].clientY - swipeY;
    // Soglia generosa e confronto con il movimento verticale: scorrere la
    // pagina sopra al calendario non deve cambiare mese per sbaglio.
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    shiftMonth(dx < 0 ? 1 : -1);
  }, { passive: true });

  /* ── selezione ─────────────────────────────────────── */

  function pick(ms) {
    // Un secondo click sull'arrivo annulla l'intera selezione e riporta il
    // calendario allo stato iniziale, compresi i campi del modulo.
    if (state.checkin !== null && ms === state.checkin) {
      state.checkin = null;
      state.checkout = null;
      state.hover = null;
    } else if (state.checkin === null || state.checkout !== null) {
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
    state.rejected.clear();
    syncForm();
    applyInputBounds();
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
    const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1);

    // Limiti: non prima del mese corrente, non oltre l'orizzonte pubblicato.
    const minMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    if (next < minMonth || next >= state.horizonEnd) return;
    if (next === state.cursor) return;

    state.cursor = next;
    state.hover = null;
    render();

    // Il mese entra dal lato da cui è arrivato: senza, il cambio è uno
    // scatto secco e non si capisce se si è andati avanti o indietro.
    elMonths.classList.remove('slide-next', 'slide-prev');
    void elMonths.offsetWidth; // forza il riavvio dell'animazione
    elMonths.classList.add(delta > 0 ? 'slide-next' : 'slide-prev');
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
    if (state.hover !== null) { state.hover = null; paintDays(); }
  });

  window.matchMedia('(max-width: 768px)').addEventListener('change', (e) => {
    state.monthsShown = e.matches ? 1 : 2;
    render({ rebuild: true });
  });

  /* ── API per il form ───────────────────────────────── */

  window.LunaAvailability = {
    get minNights() { return state.minNights; },
    get times() { return { checkinFrom: state.checkinFrom, checkoutBy: state.checkoutBy }; },
    get loaded() { return state.loaded; },
    refresh: () => load({ silent: true }),

    /** @returns {{ok:boolean, code?:string, field?:string, reason?:string}} */
    check(checkinISO, checkoutISO) {
      if (!state.loaded) {
        return {
          ok: false,
          code: 'not-ready',
          reason: 'Il calendario non è ancora pronto: attendi qualche secondo e riprova.',
        };
      }
      const a = fromISO(checkinISO);
      const b = fromISO(checkoutISO);
      if (Number.isNaN(a) || Number.isNaN(b)) {
        return { ok: false, code: 'invalid-date', reason: 'Controlla le date selezionate.' };
      }
      if (a < TODAY) return { ok: false, reason: 'La data di arrivo è nel passato.' };
      if (a >= state.horizonEnd) {
        return { ok: false, field: 'checkin', reason: 'La data di arrivo è oltre il periodo prenotabile.' };
      }
      if (b > state.horizonEnd) {
        return { ok: false, field: 'checkout', reason: 'La data di partenza è oltre il periodo prenotabile.' };
      }
      if (b <= a) {
        return { ok: false, field: 'checkout', reason: 'La partenza deve venire dopo l’arrivo.' };
      }
      if ((b - a) / DAY < state.minNights) {
        return {
          ok: false,
          field: 'checkout',
          reason: `Il soggiorno minimo è di ${state.minNights} notti.`,
        };
      }
      for (let t = a; t < b; t += DAY) {
        if (isBooked(t)) {
          return {
            ok: false,
            code: 'booked',
            field: t === a ? 'checkin' : 'checkout',
            reason: `${fmtLong(t)} non è disponibile. Scegli altre date sul calendario.`,
          };
        }
      }
      return { ok: true };
    },
    scrollToCalendar() {
      root.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  };

  /* ── date digitate a mano ──────────────────────────── */

  /* min/max sui campi: il selettore nativo del telefono non mostra nemmeno i
     giorni fuori dall'orizzonte pubblicato. Non basta da solo — la data si
     può sempre scrivere a mano — ma toglie di mezzo il caso più comune. */
  function applyInputBounds() {
    if (!inCheckin || !inCheckout) return;
    const min = toISO(TODAY);
    const max = toISO(state.horizonEnd - DAY);
    inCheckin.min = min;
    inCheckin.max = max;
    inCheckout.min = state.checkin !== null
      ? toISO(state.checkin + state.minNights * DAY)
      : toISO(TODAY + state.minNights * DAY);
    inCheckout.max = toISO(state.horizonEnd);
  }

  /**
   * Controlla ciò che è stato digitato e segna di rosso, sul calendario, le
   * notti non disponibili. Prima una data occupata scritta a mano restava lì
   * senza un segnale: l'errore arrivava solo al momento dell'invio.
   */
  function reviewTypedDates() {
    state.rejected.clear();
    if (!state.loaded) return null;

    const a = inCheckin?.value ? fromISO(inCheckin.value) : null;
    const b = inCheckout?.value ? fromISO(inCheckout.value) : null;

    if (a === null || Number.isNaN(a)) return null;

    if (isBooked(a)) state.rejected.add(toISO(a));

    // Con entrambe le date si controlla tutto l'intervallo: il problema può
    // stare nel mezzo, non per forza sul giorno di arrivo.
    if (b !== null && !Number.isNaN(b) && b > a) {
      for (let t = a; t < b; t += DAY) if (isBooked(t)) state.rejected.add(toISO(t));
    }

    if (!state.rejected.size) return null;

    const first = [...state.rejected].sort()[0];
    return state.rejected.size === 1
      ? `Il ${fmtLong(fromISO(first))} non è disponibile.`
      : `${state.rejected.size} notti del periodo scelto non sono disponibili, ` +
        `a partire dal ${fmtLong(fromISO(first))}.`;
  }

  /** Porta il calendario sul mese di una data e la mostra. */
  function focusMonthOf(ms) {
    const d = new Date(ms);
    state.cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  }

  /* Date digitate a mano nel form → riflesse sul calendario */
  for (const input of [inCheckin, inCheckout]) {
    input?.addEventListener('change', () => {
      state.checkin = inCheckin.value ? fromISO(inCheckin.value) : null;
      state.checkout = inCheckout.value ? fromISO(inCheckout.value) : null;
      state.hover = null;

      const problem = reviewTypedDates();
      applyInputBounds();

      if (problem) {
        // Il calendario si sposta sul mese della data scartata: dire "non
        // disponibile" mentre a schermo c'è un altro mese non aiuta nessuno.
        focusMonthOf(fromISO([...state.rejected].sort()[0]));
        render();
        elStatus.innerHTML = `${problem} Le notti in rosso sono già prenotate — scegline altre.`;
        elStatus.classList.add('is-warn');
        window.dispatchEvent(new CustomEvent('luna:dates-rejected', { detail: { problem } }));
        return;
      }
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

  // Finché i dati non arrivano il calendario è inerte: mostrare giorni
  // "liberi" prima di conoscere le prenotazioni sarebbe peggio di non mostrarli.
  root.classList.add('cal-loading');
  render();
  load();
})();
