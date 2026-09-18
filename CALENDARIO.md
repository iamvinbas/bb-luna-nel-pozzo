# Calendario disponibilità — come funziona e come si usa

Il sito mostra la disponibilità reale leggendo il calendario iCal di Airbnb.
Nessun server, nessun costo, nessun servizio esterno: un'azione GitHub gira ogni
15 minuti, scarica il feed e aggiorna un file nel repo.

```
Airbnb ──► GitHub Actions (ogni 15 min) ──► data/availability.json ──► calendario sul sito
```

**Airbnb è il calendario padrone.** Prenotazioni e blocchi manuali li fai lì —
dall'app che hai già in tasca — e il sito si allinea da solo. Non devi toccare
codice per gestire le prenotazioni.

> Booking.com non è ancora collegato. Quando lo colleghi, leggi la sezione 5.

---

## 1. Stato attuale

| Pezzo | Stato |
|---|---|
| Feed Airbnb (`ICAL_AIRBNB`) | ✅ configurato |
| Calendario sul sito | ✅ online |
| Sincronizzazione automatica | ✅ ogni 15 minuti |
| Feed Booking (`ICAL_BOOKING`) | ⬜ da fare |
| Export `calendar/direct.ics` | ✅ generato, non ancora importato da nessuno |

Il sito è: https://iamvinbas.github.io/bb-luna-nel-pozzo/#availability

---

## 2. Uso quotidiano — arriva una richiesta dal sito

Il modulo del sito **non prenota**: apre WhatsApp con le date già compilate.
Non c'è pagamento online, quindi non esiste un evento automatico che blocchi la
data. Il blocco scatta quando decidi tu che la prenotazione è valida.

1. Rispondi su WhatsApp, concorda date e caparra.
2. **App Airbnb** → Calendario → seleziona le date → **Blocca**.
3. Fatto. Il sito mostra quelle notti occupate entro ~15-20 minuti.

Per liberarle, le sblocchi su Airbnb allo stesso modo.

> Airbnb esporta i blocchi manuali (`Airbnb (Not available)`) insieme alle
> prenotazioni vere (`Reserved`). Al sito interessa solo la differenza tra
> libero e occupato, quindi funzionano entrambi allo stesso modo.

### Il rischio da conoscere

Tra la conferma su WhatsApp e il blocco su Airbnb, quelle date restano vendibili
ovunque. **Blocca subito, prima di rispondere al prossimo ospite.** È l'unico
punto fragile del sistema e non è risolvibile senza pagamento online.

---

## 3. Notti, non giornate

L'unità venduta è la **notte**. Il giorno di partenza non è una notte, quindi
resta libero come arrivo per l'ospite successivo — check-out entro le 11:00,
check-in dalle 15:00. Lo stesso giorno di calendario può appartenere a due
ospiti diversi.

Il calendario del sito applica questa regola: chi prenota può scegliere come
partenza un giorno in cui un altro ospite arriva. Senza, perderesti una notte
vendibile a ogni cambio.

Stati mostrati: **libero** e **occupato**. Nient'altro.

---

## 4. Manutenzione

### Se il calendario sparisce dal sito

Il sito mostra *"Calendario temporaneamente non disponibile"* quando
`data/availability.json` manca o non si carica. È voluto: mostrare un calendario
vuoto come "tutto libero" sarebbe peggio che non mostrarlo.

GitHub → **Actions** → *Sincronizza calendario* → **Run workflow**.

### Diagnosi

| Sintomo | Causa | Rimedio |
|---|---|---|
| Calendario non disponibile | `availability.json` manca | Run workflow a mano |
| Mesi lontani tutti occupati | Airbnb esporta come "non disponibile" tutto ciò che cade oltre la tua finestra di prenotazione | Airbnb → Calendario → Disponibilità → **Preavviso e finestra di prenotazione** → allarga (es. 12 mesi) |
| Workflow rosso, "URL iCal non configurato" | Secret mancante o rinominato | [Secrets](https://github.com/iamvinbas/bb-luna-nel-pozzo/settings/secrets/actions) → ricontrolla `ICAL_AIRBNB` |
| Date vecchie sul sito | Il cron di GitHub può ritardare sotto carico | Normale fino a ~20 min; per forzare, Run workflow |

### Impostazioni

In `scripts/sync-ical.mjs`, oggetto `CONFIG`:

| Campo | Default | Cosa fa |
|---|---|---|
| `minNights` | `2` | soggiorno minimo imposto dal calendario e dal modulo |
| `horizonDays` | `365` | giorni pubblicati (12 mesi: la finestra che le OTA esportano davvero) |
| `checkinFrom` | `15:00` | orario di arrivo, mostrato sul sito e nella richiesta WhatsApp |
| `checkoutBy` | `11:00` | orario di partenza |

Gli orari stanno solo qui: finiscono in `availability.json` e il calendario li
legge da lì. Cambiarli in un punto li cambia ovunque.

Frequenza: il `cron` in `.github/workflows/sync-calendar.yml`
(`'*/15 * * * *'` = ogni 15 minuti). Il repo è pubblico, quindi i minuti Actions
sono gratis: il limite non è il costo ma il ritardo di coda di GitHub, che sotto
le 15' mangia il guadagno.

Prova in locale:

```bash
ICAL_AIRBNB="https://..." node scripts/sync-ical.mjs
```

---

## 5. Quando colleghi Booking.com

### a) Aggiungi il feed

Extranet Booking → **Tariffe e disponibilità** → **Sincronizza calendari** →
**Esporta** → copia l'URL. Poi
[Secrets](https://github.com/iamvinbas/bb-luna-nel-pozzo/settings/secrets/actions)
→ nuovo segreto `ICAL_BOOKING`.

Da quel momento il sito mostra l'unione dei due: una notte è occupata se
*almeno una* piattaforma la blocca. Non mostrerà mai libero ciò che è già
venduto altrove.

### b) La scelta che dovrai fare

Con due piattaforme nasce il rischio che entrambe vendano le stesse notti. Ci
sono due strategie e **si escludono a vicenda**:

**Prevenire** — fai importare a Booking il calendario di Airbnb e viceversa.
Ogni prenotazione blocca l'altra piattaforma entro poche ore: quella cadenza la
decidono loro, non noi, ed è il tratto più lento dell'intera catena. Massima
protezione, ma l'allarme sovrapposizioni diventa cieco: non distingue più un
overbooking reale dall'eco di una prenotazione rimbalzata tra i due feed.

**Rilevare** — le lasci indipendenti. Se entrambe bloccano le stesse notti senza
una prenotazione diretta a spiegarlo, l'overbooking è *già* avvenuto: lo script
lo rileva, fa fallire l'esecuzione e GitHub ti manda un'email con le date esatte.
Preciso, ma arriva a danno fatto.

La prevenzione vale più del rilevamento, ma decidilo quando ci arrivi.

### c) `direct.ics` — a cosa serve allora

Con due piattaforme, bloccare a mano su Airbnb non basta più: dovresti bloccare
anche su Booking. Per evitarlo esiste `data/direct-bookings.json`: ogni riga
diventa un evento in `calendar/direct.ics`, che **entrambe** le piattaforme
possono importare da:

```
https://iamvinbas.github.io/bb-luna-nel-pozzo/calendar/direct.ics
```

Un blocco scritto una volta si propaga ovunque. Forma di una riga:

```json
{
  "id": "rossi-2027-07-14",
  "checkin": "2027-07-14",
  "checkout": "2027-07-19",
  "guest": "Mario Rossi"
}
```

`checkout` è il giorno di partenza: non conta come notte occupata. Per liberare
delle date, cancella la riga.

Oggi il file è vuoto e nessuno importa `direct.ics`: con la sola Airbnb, bloccare
dall'app è più veloce e ottiene lo stesso risultato.
