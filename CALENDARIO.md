# Calendario disponibilità — come funziona e come si attiva

Il sito mostra la disponibilità reale unendo tre fonti: **Airbnb**, **Booking.com**
e le **prenotazioni dirette**. Nessun server, nessun costo: un'azione GitHub gira
ogni 2 ore, scarica i calendari e aggiorna un file nel repo.

```
Airbnb  ─┐
Booking ─┼─► GitHub Actions (ogni 2h) ─► data/availability.json ─► calendario sul sito
Dirette ─┘            │
                      └──────────────► calendar/direct.ics ─► importato da Airbnb e Booking
```

---

## 1. Attivazione (una volta sola, ~10 minuti)

### a) Copia l'URL iCal di Airbnb

1. Airbnb → **Annunci** → il tuo appartamento → **Calendario**
2. Barra laterale destra → **Disponibilità** → **Sincronizza calendari**
3. **Esporta calendario** → copia l'URL (finisce in `.ics`)

### b) Copia l'URL iCal di Booking.com

1. Extranet Booking.com → **Tariffe e disponibilità** → **Sincronizza calendari**
2. **Esporta calendario** → copia l'URL

### c) Incolla i due URL nei segreti GitHub

Vai su `https://github.com/iamvinbas/bb-luna-nel-pozzo/settings/secrets/actions`
→ **New repository secret**, due volte:

| Nome | Valore |
|---|---|
| `ICAL_AIRBNB` | l'URL del punto (a) |
| `ICAL_BOOKING` | l'URL del punto (b) |

> Vanno nei *Secrets*, non nel codice: contengono un token privato che dà
> accesso in lettura al tuo calendario.

### d) Chiudi il cerchio — importa il nostro calendario sulle OTA

Serve perché una prenotazione ricevuta dal sito blocchi le date **anche** su
Airbnb e Booking. L'URL da importare è:

```
https://iamvinbas.github.io/bb-luna-nel-pozzo/calendar/direct.ics
```

- **Airbnb** → Calendario → Sincronizza calendari → **Importa calendario** → incolla l'URL, nome "Sito"
- **Booking.com** → Sincronizza calendari → **Importa calendario** → stesso URL

### e) Prima esecuzione

GitHub → tab **Actions** → *Sincronizza calendario* → **Run workflow**.
Dopo ~30 secondi il calendario sul sito è vivo.

---

## 2. Uso quotidiano

### Arriva una richiesta dal sito

1. Rispondi su WhatsApp, concorda le date.
2. Apri `data/direct-bookings.json` su GitHub (matita ✏️) e aggiungi:

```json
{
  "id": "rossi-2026-07-14",
  "checkin": "2026-07-14",
  "checkout": "2026-07-19",
  "guest": "Mario Rossi"
}
```

3. Commit. L'azione parte da sola: il sito si aggiorna e `direct.ics`
   propaga il blocco su Airbnb e Booking.

Il calendario ha **due soli stati**: libero e occupato. Ogni riga qui dentro
occupa le sue notti; per liberarle, cancella la riga.

`checkout` è il giorno di partenza: **non** viene contato come notte occupata,
quindi resta libero come arrivo per l'ospite successivo — si vende la notte,
non la giornata (check-out entro le 11:00, check-in dalle 15:00).

---

## 3. Doppie prenotazioni — le tre difese

Il rischio esiste perché le OTA aggiornano i calendari importati ogni 2-4 ore,
non in tempo reale. Ecco come è gestito.

**1. Unione, non media.** Una notte è occupata se *almeno una* fonte la blocca.
Il calendario pubblico non mostrerà mai libero ciò che è già venduto altrove.

**2. Il sito non conferma, chiede.** Il modulo invia una *richiesta di
disponibilità* su WhatsApp, non una prenotazione istantanea. Confermi tu dopo
aver controllato. Questo elimina strutturalmente il rischio nella finestra di
latenza della sincronizzazione — è il motivo per cui il flusso è volutamente
manuale.

**3. Allarme sulle sovrapposizioni.** Se Airbnb e Booking bloccano le stesse
notti senza che ci sia una prenotazione diretta a spiegarlo, significa che un
overbooking è **già** avvenuto. Lo script lo rileva, fa fallire l'esecuzione e
GitHub ti manda un'email con le date esatte.

> Lo script non considera conflitto una notte coperta da prenotazione diretta:
> quella è il riflesso del nostro stesso `direct.ics` re-importato dalle due
> piattaforme, non un doppio booking.

---

## 4. Impostazioni

In `scripts/sync-ical.mjs`, oggetto `CONFIG`:

| Campo | Default | Cosa fa |
|---|---|---|
| `minNights` | `2` | soggiorno minimo imposto dal calendario e dal modulo |
| `horizonDays` | `365` | giorni di calendario pubblicati (12 mesi: la finestra che le OTA esportano davvero) |
| `checkinFrom` | `15:00` | orario di arrivo mostrato sul sito e nella richiesta |
| `checkoutBy` | `11:00` | orario di partenza |

Gli orari stanno solo qui: finiscono in `availability.json` e il calendario li
legge da lì. Cambiarli in un punto li cambia ovunque.

La frequenza di aggiornamento è il `cron` in `.github/workflows/sync-calendar.yml`
(`'17 */2 * * *'` = ogni 2 ore).

---

## 5. Diagnosi

| Sintomo | Causa | Rimedio |
|---|---|---|
| "Calendario temporaneamente non disponibile" | `data/availability.json` manca | Lancia il workflow a mano (Actions → Run workflow) |
| Workflow rosso con "sovrapposizione" | Overbooking reale tra Airbnb e Booking | Apri le due extranet e cancella una delle due prenotazioni |
| Workflow rosso con "URL iCal non configurato" | Secret mancante o rinominato | Ricontrolla il punto (c) |
| Date vecchie sul sito | Il cron di GitHub può ritardare | Normale fino a ~2h; per forzare, Run workflow |
| Mesi lontani tutti occupati | Airbnb esporta come "non disponibile" tutto ciò che cade oltre la tua finestra di prenotazione | Airbnb → Calendario → Disponibilità → **Preavviso e finestra di prenotazione** → allarga la finestra (es. 12 mesi) |

Per provare in locale senza toccare i segreti:

```bash
ICAL_AIRBNB="https://..." ICAL_BOOKING="https://..." node scripts/sync-ical.mjs
```
