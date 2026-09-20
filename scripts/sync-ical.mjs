#!/usr/bin/env node
/**
 * sync-ical.mjs — La Luna nel Pozzo
 *
 * Scarica i calendari iCal di Airbnb e Booking.com, li unisce con le
 * prenotazioni diretto (data/direct-bookings.json) e produce:
 *
 *   data/availability.json  → letto dal calendario del sito
 *   calendar/direct.ics     → feed da IMPORTARE su Airbnb e Booking.com
 *                             (chiude il cerchio: le prenotazioni diretto
 *                              bloccano anche le date sulle OTA)
 *
 * Nessuna dipendenza: solo Node >= 20 (fetch globale).
 *
 * Variabili d'ambiente:
 *   ICAL_AIRBNB   URL export iCal Airbnb   (GitHub Secret)
 *   ICAL_BOOKING  URL export iCal Booking  (GitHub Secret)
 *   SITE_ORIGIN   origine pubblica del sito, per gli UID del feed .ics
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CONFIG = {
  timezone: 'Europe/Rome',
  minNights: 2,
  // L'unità venduta è la NOTTE, non il giorno: chi parte libera alle 11:00,
  // chi arriva entra dalle 15:00. Lo stesso giorno di calendario può quindi
  // appartenere a due ospiti diversi.
  checkinFrom: '15:00',
  checkoutBy: '11:00',
  // 12 mesi: è la finestra che Airbnb e Booking esportano davvero. Oltre, i
  // feed semplicemente tacciono — e "nessun evento" non significa "libero",
  // significa "non lo sappiamo". Pubblicare quei mesi come liberi sarebbe falso.
  horizonDays: 365,
  siteOrigin: process.env.SITE_ORIGIN || 'https://lalunanelpozzo.it',
  sources: [
    { id: 'airbnb', label: 'Airbnb', url: process.env.ICAL_AIRBNB },
    { id: 'booking', label: 'Booking.com', url: process.env.ICAL_BOOKING },
  ],
};

/* ═══════════════ date helpers (UTC, giorno intero) ═══════════════ */

const DAY = 86400000;
const toISO = (ms) => new Date(ms).toISOString().slice(0, 10);
const fromISO = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));

/** "20260920" | "20260920T140000Z" → epoch ms del giorno (UTC) */
function parseICalDate(raw) {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim());
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

/* ═══════════════ parser iCal minimale (RFC 5545) ═══════════════ */

/** Riunisce le righe "foldate": una riga che inizia con spazio/tab continua la precedente. */
function unfold(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
}

/**
 * Estrae i VEVENT. DTEND in iCal è ESCLUSIVO: per una prenotazione
 * 20→24 le notti occupate sono 20,21,22,23 e il 24 è giorno di check-out,
 * quindi già disponibile per un nuovo check-in (turnover).
 */
function parseICal(text) {
  const events = [];
  let cur = null;

  for (const line of unfold(text).split('\n')) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      if (cur?.start && cur?.end && cur.end > cur.start) events.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;

    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const name = line.slice(0, sep).split(';')[0].toUpperCase();
    const value = line.slice(sep + 1);

    if (name === 'DTSTART') cur.start = parseICalDate(value);
    else if (name === 'DTEND') cur.end = parseICalDate(value);
    else if (name === 'UID') cur.uid = value.trim();
    else if (name === 'SUMMARY') cur.summary = value.trim();
  }
  return events;
}

/* ═══════════════ fetch sorgenti ═══════════════ */

async function fetchSource(src) {
  if (!src.url) {
    return { ...src, ok: false, events: [], error: 'URL iCal non configurato' };
  }
  try {
    const res = await fetch(src.url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'LaLunaNelPozzo-CalendarSync/1.0' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const body = await res.text();
    if (!body.includes('BEGIN:VCALENDAR')) throw new Error('risposta non iCal');

    return { ...src, ok: true, events: parseICal(body) };
  } catch (err) {
    return { ...src, ok: false, events: [], error: String(err.message || err) };
  }
}

/* ═══════════════ prenotazioni dirette ═══════════════ */

async function loadDirectBookings() {
  try {
    const raw = await readFile(resolve(ROOT, 'data/direct-bookings.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.bookings) ? parsed.bookings : [];
  } catch {
    return [];
  }
}

/* ═══════════════ merge + rilevamento conflitti ═══════════════ */

/**
 * Costruisce una mappa notte → sorgenti che la bloccano.
 * Una notte è occupata se ALMENO una sorgente la blocca (unione).
 */
function buildNightMap({ remote, direct, today, horizonEnd }) {
  const nights = new Map(); // ISO date → Set delle sorgenti che la bloccano

  const add = (startMs, endMs, sourceId) => {
    for (let t = Math.max(startMs, today); t < Math.min(endMs, horizonEnd); t += DAY) {
      const key = toISO(t);
      let sources = nights.get(key);
      if (!sources) nights.set(key, (sources = new Set()));
      sources.add(sourceId);
    }
  };

  for (const src of remote) {
    for (const ev of src.events) add(ev.start, ev.end, src.id);
  }

  for (const b of direct) {
    if (!b.checkin || !b.checkout) continue;
    add(fromISO(b.checkin), fromISO(b.checkout), 'direct');
  }

  return nights;
}

/**
 * Conflitto = due OTA diverse bloccano la stessa notte senza che quella notte
 * sia coperta da una prenotazione diretta.
 *
 * Perché l'eccezione: una prenotazione diretta viene ri-esportata da noi e
 * re-importata sia da Airbnb che da Booking, quindi ricompare in entrambi i
 * feed. Quello è l'eco del nostro stesso blocco, non un overbooking.
 */
function findConflicts(nights) {
  const conflicts = [];
  let open = null;

  for (const date of [...nights.keys()].sort()) {
    const sources = nights.get(date);
    const otas = [...sources].filter((s) => s !== 'direct');
    const isConflict = otas.length > 1 && !sources.has('direct');

    if (isConflict) {
      const sig = otas.sort().join('+');
      if (open && open.sig === sig && fromISO(open.to) === fromISO(date)) {
        open.to = toISO(fromISO(date) + DAY);
      } else {
        if (open) conflicts.push(open);
        open = { from: date, to: toISO(fromISO(date) + DAY), sig, sources: otas };
      }
    } else if (open) {
      conflicts.push(open);
      open = null;
    }
  }
  if (open) conflicts.push(open);

  return conflicts.map(({ sig, ...c }) => c);
}

/** Notti occupate contigue → intervalli [from, to) compatti. */
function compactRanges(nights) {
  const ranges = [];
  let open = null;

  for (const date of [...nights.keys()].sort()) {
    if (open && fromISO(open.to) === fromISO(date)) {
      open.to = toISO(fromISO(date) + DAY);
    } else {
      if (open) ranges.push(open);
      open = { from: date, to: toISO(fromISO(date) + DAY) };
    }
  }
  if (open) ranges.push(open);

  return ranges;
}

/* ═══════════════ feed .ics delle prenotazioni dirette ═══════════════ */

function buildDirectICS(direct) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const esc = (s) => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//La Luna nel Pozzo//Prenotazioni dirette//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:La Luna nel Pozzo — Prenotazioni dirette',
  ];

  for (const [i, b] of direct.entries()) {
    if (!b.checkin || !b.checkout) continue;
    const uid = b.id || `direct-${i}-${b.checkin}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${esc(uid)}@${new URL(CONFIG.siteOrigin).hostname}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${b.checkin.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${b.checkout.replace(/-/g, '')}`,
      `SUMMARY:${esc('Prenotato (sito)')}`,
      'TRANSP:OPAQUE',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  // RFC 5545 vuole CRLF
  return lines.join('\r\n') + '\r\n';
}

/* ═══════════════ main ═══════════════ */

async function main() {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const horizonEnd = today + CONFIG.horizonDays * DAY;

  const [remote, direct] = await Promise.all([
    Promise.all(CONFIG.sources.map(fetchSource)),
    loadDirectBookings(),
  ]);

  const nights = buildNightMap({ remote, direct, today, horizonEnd });
  const conflicts = findConflicts(nights);

  const availability = {
    updated: now.toISOString(),
    timezone: CONFIG.timezone,
    minNights: CONFIG.minNights,
    checkinFrom: CONFIG.checkinFrom,
    checkoutBy: CONFIG.checkoutBy,
    horizon: { from: toISO(today), to: toISO(horizonEnd) },
    ranges: compactRanges(nights),
    sources: Object.fromEntries(
      remote.map((s) => [
        s.id,
        { label: s.label, ok: s.ok, events: s.events.length, ...(s.error ? { error: s.error } : {}) },
      ]),
    ),
    conflicts,
  };

  // Se TUTTE le sorgenti falliscono non sovrascriviamo il file buono con uno
  // vuoto: il sito mostrerebbe tutto libero. Meglio tenere il dato vecchio.
  const anyOk = remote.some((s) => s.ok);
  if (!anyOk && direct.length === 0) {
    console.error('✖ Nessuna sorgente raggiungibile — availability.json NON aggiornato.');
    for (const s of remote) console.error(`  ${s.id}: ${s.error}`);
    process.exit(1);
  }

  await mkdir(resolve(ROOT, 'data'), { recursive: true });
  await mkdir(resolve(ROOT, 'calendar'), { recursive: true });
  await writeFile(resolve(ROOT, 'data/availability.json'), JSON.stringify(availability, null, 2) + '\n');
  await writeFile(resolve(ROOT, 'calendar/direct.ics'), buildDirectICS(direct));

  /* ── report ── */
  // `::warning::` diventa un'annotazione visibile nella pagina del run.
  // Serve perché una sorgente muta è il guasto peggiore di tutti: il run
  // resta verde, il sito continua a promettere "sincronizzato con X" e le
  // date vendute su quella piattaforma restano offerte come libere.
  const gha = Boolean(process.env.GITHUB_ACTIONS);
  const warn = (msg) => console.log(gha ? `::warning::${msg}` : `⚠ ${msg}`);

  for (const s of remote) {
    if (s.ok) {
      console.log(`✔ ${s.label}: ${s.events.length} eventi`);
      continue;
    }
    console.log(`✖ ${s.label}: ${s.error}`);
    warn(
      `${s.label} non sincronizza (${s.error}). Le prenotazioni ricevute su ` +
      `${s.label} NON bloccano le date sul sito: rischio doppia prenotazione. ` +
      `Aggiungi l'URL di export iCal nel secret corrispondente.`,
    );
  }
  console.log(`• Dirette: ${direct.length}`);
  console.log(`• Notti occupate: ${nights.size} in ${availability.ranges.length} intervalli`);

  if (conflicts.length) {
    console.error(`\n⚠ ATTENZIONE — ${conflicts.length} sovrapposizione/i tra piattaforme:`);
    for (const c of conflicts) {
      console.error(`  ${c.from} → ${c.to} bloccato da: ${c.sources.join(' + ')}`);
    }
    console.error('\nVerifica subito su Airbnb e Booking.com: rischio doppia prenotazione.');
    // Exit 2: il workflow marca il run come fallito così arriva l'email.
    // Il file è già stato scritto, quindi il sito resta comunque aggiornato.
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
