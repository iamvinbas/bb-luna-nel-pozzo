# La Luna nel Pozzo — Molfetta, Bari

Sito web dell'appartamento **La Luna nel Pozzo** a Molfetta (Bari).

Il progetto è realizzato per avere un sito dedicato all'appartamento, dove gli
ospiti possono vedere foto, servizi e posizione, controllare la disponibilità
reale e chiedere una prenotazione diretta via WhatsApp, senza passare per i
portali.

👉 Sito online: https://iamvinbas.github.io/bb-luna-nel-pozzo/

## Cosa fa

- **Vetrina dell'appartamento** — foto, descrizione, servizi e come arrivare.
- **Calendario disponibilità** — sincronizzato in automatico con Airbnb e
  Booking.com tramite i feed iCal.
- **Richiesta di prenotazione** — il modulo apre WhatsApp con le date già
  compilate; nessun pagamento online.

## Come funziona

Sito statico, nessun server e nessun costo: è ospitato su **GitHub Pages**.
Un'azione GitHub (`.github/workflows/sync-calendar.yml`) scarica ogni 15 minuti
i calendari dei portali e aggiorna `data/availability.json`, che il sito legge
per mostrare le notti libere e occupate.

```
Airbnb / Booking ──► GitHub Actions (ogni 15 min) ──► data/availability.json ──► sito
```

## Struttura

| Percorso | Contenuto |
|---|---|
| `index.html` | Pagina del sito |
| `css/` | Stili (desktop e mobile) |
| `js/` | Logica del sito e del calendario |
| `data/` | Disponibilità e prenotazioni dirette |
| `calendar/direct.ics` | Export iCal delle prenotazioni dirette |
| `scripts/sync-ical.mjs` | Script di sincronizzazione dei calendari |
| `images/` | Foto dell'appartamento |

Per la gestione quotidiana del calendario vedi [CALENDARIO.md](CALENDARIO.md).
