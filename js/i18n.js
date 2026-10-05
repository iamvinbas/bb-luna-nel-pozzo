/* ═══════════════════════════════════════════════════════
   LA LUNA NEL POZZO — Testi generati da JavaScript

   I testi fissi stanno nell'HTML di ogni lingua (index.html, en/index.html).
   Qui ci sono solo quelli che il codice scrive a runtime: errori del modulo,
   stato del calendario, messaggio WhatsApp. La lingua la decide l'attributo
   lang della pagina, non il browser: chi è su /en/ vede l'inglese.

   Una voce è una stringa oppure una funzione che riceve i valori da inserire.
   Una chiave assente in inglese ricade sull'italiano, mai su un buco vuoto.
═══════════════════════════════════════════════════════ */

window.LunaI18n = (function () {
  const lang = document.documentElement.lang === 'en' ? 'en' : 'it';
  const locale = lang === 'en' ? 'en-GB' : 'it-IT';

  const nightsIt = (n) => `${n} ${n === 1 ? 'notte' : 'notti'}`;
  const nightsEn = (n) => `${n} ${n === 1 ? 'night' : 'nights'}`;

  const STRINGS = {
    it: {
      'lightbox.missing': 'Foto disponibile presto',
      'map.twoFingers': 'Usa due dita per muovere la mappa',

      'form.name.empty': 'Serve il tuo nome per la richiesta.',
      'form.name.short': 'Scrivi il nome per esteso.',
      'form.email.empty': 'Serve la tua email per risponderti.',
      'form.email.invalid': 'Controlla la email: manca qualcosa (esempio: mario@email.com).',
      'form.checkin.empty': 'Scegli il giorno di arrivo.',
      'form.checkin.invalid': 'Data di arrivo non valida.',
      'form.checkin.past': 'La data di arrivo è già passata.',
      'form.checkout.empty': 'Scegli il giorno di partenza.',
      'form.checkout.invalid': 'Data di partenza non valida.',
      'form.checkout.beforeCheckin': 'La partenza deve venire dopo l’arrivo.',
      'form.checkout.minStay': ({ min, date }) =>
        `Il soggiorno minimo è di ${min} notti: scegli almeno il ${date}.`,
      'form.seeCalendar': 'Guarda le celle in rosso sul calendario.',
      'form.missingOne': 'Manca un dato: controlla il campo evidenziato.',
      'form.missingMany': ({ n }) => `Mancano ${n} dati: controlla i campi evidenziati.`,
      'form.notReady':
        'Non riesco ancora a verificare la disponibilità. Attendi il caricamento del calendario e riprova.',
      'form.verifying': 'Verifico disponibilità…',
      'form.cannotVerify':
        'Non riesco a verificare la disponibilità in questo momento. Attendi e riprova.',
      'form.popupBlocked': 'Il browser ha bloccato l’apertura di WhatsApp.',
      'form.openWhatsApp': 'Apri WhatsApp',
      'form.sent': 'Richiesta aperta in WhatsApp — premi invio lì per mandarcela.',

      'wa.booking': (v) =>
        `Ciao! Vorrei prenotare *La Luna nel Pozzo* a Molfetta 🌙\n\n` +
        `👤 Nome: ${v.name}\n` +
        `📅 Arrivo: ${v.checkin} (dalle ${v.checkinFrom})\n` +
        `📅 Partenza: ${v.checkout} (entro le ${v.checkoutBy})\n` +
        `🌙 Notti: ${v.nights}\n` +
        `👥 Ospiti: ${v.guests}\n` +
        `✉️ Email: ${v.email}` +
        (v.message ? `\n\n💬 ${v.message}` : '') +
        `\n\nGrazie!`,

      'cal.weekdays': ['L', 'M', 'M', 'G', 'V', 'S', 'D'],
      'cal.nights': ({ n }) => nightsIt(n),
      'cal.updated': 'Disponibilità sincronizzata automaticamente',
      'cal.lost':
        'Le date che avevi scelto sono state appena prenotate altrove. ' +
        'Scegline altre sul calendario.',
      'cal.unavailable': ({ wa }) =>
        'Calendario temporaneamente non disponibile. ' +
        `<a href="${wa}" target="_blank" rel="noopener">Scrivici su WhatsApp</a> ` +
        'e ti confermiamo le date in pochi minuti.',
      'cal.day.past': ' — non prenotabile',
      'cal.day.booked': ' — occupato',
      'cal.day.bookedTurnover': ({ from, by }) =>
        ` — occupato dalle ${from}, puoi solo partire entro le ${by}`,
      'cal.day.free': ' — libero',
      'cal.status.noneHere': 'Nessuna disponibilità in questo periodo. ',
      'cal.status.jump': ({ date }) => `Vai al ${date}`,
      'cal.status.noneAhead': ({ wa }) =>
        'Nessuna disponibilità nei prossimi mesi. ' +
        `<a href="${wa}" target="_blank" rel="noopener">Scrivici</a> ` +
        'e ti avvisiamo appena si libera qualcosa.',
      'cal.status.start': ({ min }) =>
        `Tocca il giorno di <strong>arrivo</strong>, poi quello di <strong>partenza</strong>. ` +
        `Minimo ${min} notti.`,
      'cal.status.arrival': ({ date, from }) =>
        `Arrivo <strong>${date}</strong> dalle ${from} — ora tocca il giorno di partenza.`,
      'cal.status.range': (v) =>
        `<strong>${v.checkin}</strong> dalle ${v.checkinFrom} → ` +
        `<strong>${v.checkout}</strong> entro le ${v.checkoutBy} · ` +
        `${nightsIt(v.nights)} · disponibile. ` +
        `Compila il modulo qui sotto per inviare la richiesta.`,
      'cal.check.notReady': 'Il calendario non è ancora pronto: attendi qualche secondo e riprova.',
      'cal.check.invalidDate': 'Controlla le date selezionate.',
      'cal.check.past': 'La data di arrivo è nel passato.',
      'cal.check.checkinBeyond': 'La data di arrivo è oltre il periodo prenotabile.',
      'cal.check.checkoutBeyond': 'La data di partenza è oltre il periodo prenotabile.',
      'cal.check.minStay': ({ min }) => `Il soggiorno minimo è di ${min} notti.`,
      'cal.check.booked': ({ date }) =>
        `${date} non è disponibile. Scegli altre date sul calendario.`,
      'cal.typed.one': ({ date }) => `Il ${date} non è disponibile.`,
      'cal.typed.many': ({ n, date }) =>
        `${n} notti del periodo scelto non sono disponibili, a partire dal ${date}.`,
      'cal.typed.status': ({ problem }) =>
        `${problem} Le notti in rosso sono già prenotate — scegline altre.`,
    },

    en: {
      'lightbox.missing': 'Photo coming soon',
      'map.twoFingers': 'Use two fingers to move the map',

      'form.name.empty': 'Please enter your name.',
      'form.name.short': 'Please enter your full name.',
      'form.email.empty': 'We need your email to reply to you.',
      'form.email.invalid': 'Please check your email: something is missing (e.g. john@email.com).',
      'form.checkin.empty': 'Choose your arrival date.',
      'form.checkin.invalid': 'Invalid arrival date.',
      'form.checkin.past': 'The arrival date is in the past.',
      'form.checkout.empty': 'Choose your departure date.',
      'form.checkout.invalid': 'Invalid departure date.',
      'form.checkout.beforeCheckin': 'Departure must be after arrival.',
      'form.checkout.minStay': ({ min, date }) =>
        `The minimum stay is ${min} nights: choose ${date} or later.`,
      'form.seeCalendar': 'See the cells marked in red on the calendar.',
      'form.missingOne': 'One detail is missing: check the highlighted field.',
      'form.missingMany': ({ n }) => `${n} details are missing: check the highlighted fields.`,
      'form.notReady':
        'Availability cannot be checked yet. Please wait for the calendar to load and try again.',
      'form.verifying': 'Checking availability…',
      'form.cannotVerify':
        'Availability cannot be checked right now. Please wait and try again.',
      'form.popupBlocked': 'Your browser blocked WhatsApp from opening.',
      'form.openWhatsApp': 'Open WhatsApp',
      'form.sent': 'Request opened in WhatsApp — press send there to deliver it.',

      'wa.booking': (v) =>
        `Hi! I'd like to book *La Luna nel Pozzo* in Molfetta 🌙\n\n` +
        `👤 Name: ${v.name}\n` +
        `📅 Check-in: ${v.checkin} (from ${v.checkinFrom})\n` +
        `📅 Check-out: ${v.checkout} (by ${v.checkoutBy})\n` +
        `🌙 Nights: ${v.nights}\n` +
        `👥 Guests: ${v.guests}\n` +
        `✉️ Email: ${v.email}` +
        (v.message ? `\n\n💬 ${v.message}` : '') +
        `\n\nThank you!`,

      'cal.weekdays': ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
      'cal.nights': ({ n }) => nightsEn(n),
      'cal.updated': 'Availability synced automatically',
      'cal.lost':
        'The dates you chose have just been booked elsewhere. ' +
        'Please pick other dates on the calendar.',
      'cal.unavailable': ({ wa }) =>
        'Calendar temporarily unavailable. ' +
        `<a href="${wa}" target="_blank" rel="noopener">Message us on WhatsApp</a> ` +
        'and we will confirm your dates within minutes.',
      'cal.day.past': ' — not bookable',
      'cal.day.booked': ' — booked',
      'cal.day.bookedTurnover': ({ from, by }) =>
        ` — booked from ${from}, available only as departure by ${by}`,
      'cal.day.free': ' — available',
      'cal.status.noneHere': 'No availability in this period. ',
      'cal.status.jump': ({ date }) => `Go to ${date}`,
      'cal.status.noneAhead': ({ wa }) =>
        'No availability in the coming months. ' +
        `<a href="${wa}" target="_blank" rel="noopener">Message us</a> ` +
        'and we will let you know as soon as something frees up.',
      'cal.status.start': ({ min }) =>
        `Tap your <strong>arrival</strong> day, then your <strong>departure</strong> day. ` +
        `Minimum ${min} nights.`,
      'cal.status.arrival': ({ date, from }) =>
        `Arrival <strong>${date}</strong> from ${from} — now tap your departure day.`,
      'cal.status.range': (v) =>
        `<strong>${v.checkin}</strong> from ${v.checkinFrom} → ` +
        `<strong>${v.checkout}</strong> by ${v.checkoutBy} · ` +
        `${nightsEn(v.nights)} · available. ` +
        `Fill in the form below to send your request.`,
      'cal.check.notReady': 'The calendar is not ready yet: wait a few seconds and try again.',
      'cal.check.invalidDate': 'Please check the selected dates.',
      'cal.check.past': 'The arrival date is in the past.',
      'cal.check.checkinBeyond': 'The arrival date is beyond the bookable period.',
      'cal.check.checkoutBeyond': 'The departure date is beyond the bookable period.',
      'cal.check.minStay': ({ min }) => `The minimum stay is ${min} nights.`,
      'cal.check.booked': ({ date }) =>
        `${date} is not available. Please choose other dates on the calendar.`,
      'cal.typed.one': ({ date }) => `${date} is not available.`,
      'cal.typed.many': ({ n, date }) =>
        `${n} nights in the chosen period are not available, starting from ${date}.`,
      'cal.typed.status': ({ problem }) =>
        `${problem} The nights in red are already booked — please choose others.`,
    },
  };

  function t(key, vars = {}) {
    const entry = STRINGS[lang][key] ?? STRINGS.it[key];
    if (entry === undefined) return key;
    return typeof entry === 'function' ? entry(vars) : entry;
  }

  /* Selettore di lingua: la scelta si ricorda, così la pagina italiana non
     rimanda più in automatico su /en/ chi ha appena scelto l'italiano. Il
     punto della pagina (#booking, #gallery…) segue nel cambio di lingua. */
  document.querySelectorAll('[data-lang-switch]').forEach((link) => {
    link.addEventListener('click', () => {
      try { localStorage.setItem('luna-lang', link.hreflang); } catch (e) {}
      if (location.hash) link.href = link.getAttribute('href').split('#')[0] + location.hash;
    });
  });

  return { lang, locale, t };
})();
