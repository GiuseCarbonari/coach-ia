# PRD — Coach AI Endurance basato su Section 11 e Intervals.icu

**Prodotto:** Coach AI Endurance  
**Versione documento:** 0.1 MVP  
**Data:** 11 giugno 2026  
**Owner prodotto:** Giuseppe Carbonari  
**Obiettivo del documento:** fornire una specifica chiara da usare con Claude Code, Codex o un team tecnico per costruire un MVP funzionante.

---

## Revisione v2 — changelog (allineamento Section 11 + modulo profilo)

Questa revisione applica nove migliorie di conformita al protocollo Section 11 e integra il Modulo Profilo Atleta (annesso §33).

1. **Read-only sui derivati** (§4, §8): l'app legge gli output pre-calcolati di Section 11, non li ricalcola.
2. **Riuso di `sync.py`** (§7.2, §9.2, §27): consumo del mirror JSON Tier-1, niente Data Mirror proprietario.
3. **Soglie readiness ufficiali** (§14.4–14.5): priority ladder P0–P3 e correzione "TSB −10/−30 e normale".
4. **Workout Library** (§15.3, §23.3): sedute selezionate dalla libreria Section 11, non inventate.
5. **`validation_metadata` Section 11 C** (§19, §20, §23.3): audit log conforme al protocollo, con `frameworks_cited`.
6. **Gate sorgente Strava** (§11, §12): blocco dati spogliati via Strava in onboarding.
7. **Terreno via `routes.json`** (§9.2, §33): consumo read-only, base della gap analysis.
8. **Inversione privacy** (§24.2): l'hosting rende Coach IA titolare di dati art. 9 → DPIA obbligatoria.
9. **Determinismo** (§8, §30): l'AI fa narrativa e selezione vincolata, mai i numeri o la decisione.

---

## 1. Visione del prodotto

> **Coach IA Endurance è l'implementazione web multi-utente del protocollo Section 11.**
>
> Section 11 è il motore di coaching — definisce la scienza, le regole, le metriche e la logica decisionale. Coach IA è il layer prodotto che lo rende accessibile a un atleta non tecnico: autentica l'utente su Intervals.icu via OAuth, legge i dati, costruisce la scheda personale dell'atleta, produce il programma di allenamento personalizzato e lo scrive sul calendario di Intervals.icu.
>
> L'utente deve già avere un account su Intervals.icu. Non è richiesta nessuna installazione locale.

L'app è un coach AI per sport endurance che aiuta l'atleta a pianificare, interpretare e correggere l'allenamento usando dati reali provenienti da Intervals.icu e un protocollo decisionale ispirato a Section 11.

L'obiettivo non è creare una chat generica che dà consigli sportivi, ma un sistema di coaching strutturato che:

- legge i dati aggiornati dell'atleta;
- valuta stato di forma, recupero, carico e disponibilità;
- genera piani settimanali, mensili e stagionali;
- modifica le sedute quando i dati suggeriscono fatica, rischio o mancata disponibilità;
- scrive gli allenamenti pianificati direttamente su Intervals.icu;
- spiega le decisioni in modo comprensibile;
- mantiene un audit log delle decisioni prese.

La promessa commerciale va formulata con attenzione. Non usare claim assoluti come “sostituisce al 100% un preparatore atletico”. La proposta più corretta è:

> Un coach AI endurance più economico di un preparatore tradizionale, capace di seguire l'atleta quotidianamente con dati reali, regole verificabili e adattamenti continui.

---

## 2. Problema da risolvere

Molti atleti amatoriali endurance vogliono allenarsi meglio, ma:

- non possono permettersi un preparatore atletico individuale;
- usano piattaforme come Intervals.icu, Garmin, Strava o Zwift, ma non sanno interpretare bene i dati;
- seguono piani generici che non si adattano alla fatica reale;
- saltano sedute, accumulano carico o arrivano stanchi agli obiettivi;
- non sanno quando fare test, recuperare, aumentare volume o ridurre intensità;
- ricevono troppi grafici e poche decisioni pratiche.

L'app deve trasformare dati complessi in decisioni semplici:

- “Oggi fai questa seduta.”
- “Oggi modifica così.”
- “Oggi recupera.”
- “Questa settimana il carico sale/scende per questo motivo.”
- “Serve un test perché le zone potrebbero non essere più aggiornate.”

---

## 3. Utenti target

### 3.1 Target principale MVP

Atleti amatoriali evoluti di endurance che usano già Intervals.icu o sono disposti a usarlo.

Sport iniziali:

- ciclismo;
- MTB;
- gravel;
- running, in seconda fase;
- triathlon, in fase successiva.

### 3.2 Persona principale

**Nome tipo:** atleta amatoriale 25–50 anni  
**Obiettivo:** migliorare prestazione, arrivare preparato a gare o eventi endurance  
**Problema:** ha dati ma non sa interpretarli o non ha un coach  
**Disponibilità economica:** inferiore al costo di un preparatore umano  
**Disponibilità tecnica:** media; sa usare app sportive ma non vuole configurazioni complicate  
**Valore atteso:** sapere cosa fare oggi e perché

---

## 4. Principi fondamentali del prodotto

1. **Data-first**  
   Nessuna metrica deve essere inventata. Ogni numero usato dal coach deve derivare dal **mirror JSON di Section 11** (`latest.json` / `history.json` / `intervals.json` / `routes.json`), un *Tier-1 verified mirror* di Intervals.icu. L'app **legge e mostra** i valori e le decisioni gia pre-calcolati da `sync.py` (CTL, ATL, TSB, ACWR, Recovery Index, `readiness_decision`, fasi, durabilita) e **non li ricalcola** — regola "No Virtual Math" di Section 11 A. Section 11 è il motore; Coach IA è il prodotto che lo espone.

2. **AI controllata, non libera**  
   L'AI non deve decidere senza regole. Deve ricevere dati, vincoli, protocollo e output atteso.

3. **Decisioni verificabili**  
   Ogni consiglio importante deve avere una motivazione: dati letti, regola attivata, modifica applicata.

4. **Più dati = più precisione**  
   L'app deve spiegare all'utente che la qualità del coaching dipende dalla quantità e qualità dei dati disponibili.

5. **Sicurezza prima della performance**  
   Dolore, malattia, segnali anomali o recupero insufficiente devono ridurre o bloccare la seduta.

6. **Chiarezza per atleti non esperti**  
   Il coach deve parlare in modo comprensibile: poche metriche, decisioni chiare, spiegazioni semplici.

7. **Progressione sostenibile**  
   Il sistema non deve inseguire solo il carico. Deve proteggere continuità, recupero e adattamento.

---

## 5. Posizionamento

### 5.1 Posizionamento consigliato

> Coach AI endurance connesso a Intervals.icu che pianifica, adatta e spiega l'allenamento usando dati reali e un protocollo verificabile.

### 5.2 Claim da evitare

Evitare frasi come:

- “Sostituisce completamente un preparatore atletico.”
- “Ha la stessa efficacia di un coach umano.”
- “Previene gli infortuni.”
- “Garantisce miglioramenti.”
- “Diagnostica sovrallenamento o problemi medici.”

### 5.3 Claim accettabili

- “Aiuta a prendere decisioni quotidiane sull'allenamento.”
- “Adatta il piano in base ai dati disponibili.”
- “Riduce il bisogno di interpretare grafici complessi.”
- “Offre un supporto continuo più economico di un coach individuale.”
- “Non sostituisce medico, fisioterapista o professionista sanitario.”

---

## 6. Scope MVP

L'MVP deve risolvere una cosa molto bene:

> Ogni giorno l'atleta deve sapere come sta, cosa deve fare e perché.

### 6.1 Funzionalità incluse nel MVP

- Registrazione e login utente.
- Collegamento account Intervals.icu via OAuth.
- Lettura dati atleta da Intervals.icu.
- Creazione profilo atleta/dossier.
- Valutazione giornaliera readiness.
- Raccomandazione Go / Modify / Skip.
- Piano settimanale automatico.
- Scrittura allenamenti su calendario Intervals.icu.
- Report post-allenamento.
- Chat coach limitata ai dati disponibili.
- Audit log decisionale.
- Dashboard semplice.
- Gestione dati mancanti.
- Privacy policy e consenso esplicito.

### 6.2 Funzionalità escluse dal MVP

- App nativa iOS/Android.
- Piani triathlon completi.
- Nutrizione avanzata personalizzata.
- Integrazione AnalyzeMe automatica, salvo API/export verificati.
- Diagnosi mediche.
- Marketplace coach umani.
- Social/community.
- Integrazione diretta Garmin/Strava nella prima versione, se Intervals.icu è già la fonte centrale.
- Modelli predittivi proprietari complessi.

---

## 7. Piattaforma iniziale

### 7.1 Scelta consigliata

Costruire prima una **web app responsive/PWA**, non un'app nativa.

Motivi:

- sviluppo più veloce;
- un solo codice per desktop e mobile;
- meno costi;
- niente App Store/Play Store all'inizio;
- più semplice usare pagamenti web;
- più facile iterare con Claude Code/Codex.

### 7.2 Stack suggerito

Frontend:

- Next.js;
- React;
- Tailwind CSS.

Backend:

- Next.js API routes oppure FastAPI;
- **pipeline dati = riuso di `sync.py` di Section 11** (worker Python) che pre-calcola le metriche e produce `latest/history/intervals/routes.json`; l'app consuma questi file invece di costruire un mirror proprietario (compatibile con local-sync o GitHub Actions a monte);
- job scheduler per report e refresh.

Database:

- Supabase PostgreSQL consigliato;
- alternativa: Firebase.

Auth:

- Supabase Auth;
- OAuth Intervals.icu per collegamento dati.

AI:

- OpenAI API o Anthropic API;
- modello economico per report semplici;
- modello più forte per pianificazione settimanale/mensile.

Hosting:

- Vercel per frontend;
- Supabase per database;
- eventuale worker su Railway/Render/Fly.io se servono job background più stabili.

Pagamenti:

- Stripe.

Repository:

- GitHub.

Sviluppo assistito:

- Claude Code o Codex.

---

## 8. Architettura ad alto livello

Prerequisito utente: **account Intervals.icu già esistente**.

Flusso:

1. L'utente apre Coach IA e si autentica via **OAuth Intervals.icu** (nessuna password separata).
2. L'app ottiene i token OAuth e li cifra nel database.
3. `sync.py` (Section 11) legge i dati da Intervals.icu e produce il mirror JSON Tier-1 (`latest.json`, `history.json`, `intervals.json`, `routes.json`).
4. L'app costruisce/aggiorna la **scheda personale dell'atleta**: profilo fenotipo (RPP, CP/W′, APR, gap analysis vs evento target) — Modulo Profilo Atleta (§33).
5. L'app legge `readiness_decision` e `derived_metrics` da `latest.json` (pre-calcolati da `sync.py`, priority ladder P0–P3 di Section 11) e li mostra in dashboard. Non ricalcola.
6. Il coach AI (Section 11) genera il **programma di allenamento personalizzato**: usa il fenotipo della scheda personale per selezionare le sedute dalla Workout Library, vincolato dalla readiness del giorno.
7. Il validatore (Section 11 C) controlla conformità e produce `validation_metadata`.
8. L'app mostra output all'utente (dashboard oggi + piano settimanale + scheda atleta).
9. Se autorizzato, l'app scrive i workout sul calendario di Intervals.icu via API.

Formula architetturale:

> OAuth Intervals.icu → `sync.py` Section 11 → mirror JSON Tier-1 → Scheda Atleta (Modulo §33) + Readiness Dashboard → Programma Personalizzato Section 11 → Validator 11 C → User + Intervals Calendar

> **Section 11 è il motore, Coach IA è il prodotto.** La scienza sportiva e la logica decisionale vivono in `SECTION_11.md` + `sync.py`. L'app autentica, orchestra, costruisce la scheda personale, presenta e scrive sul calendario di Intervals.icu.

---

## 9. Integrazione Intervals.icu

### 9.1 Obiettivo

Intervals.icu è la fonte principale dei dati atleta e il calendario su cui scrivere gli allenamenti.

### 9.2 Dati da leggere — via mirror JSON Section 11

**Fonte primaria:** l'app consuma il mirror JSON prodotto da `sync.py` (Section 11 A — Data Mirror Integration), un **Tier-1 verified mirror** gia normalizzato e arricchito di metriche derivate. Gerarchia d'uso (Section 11): `latest.json` sempre primario (stato corrente, readiness, go/modify/skip); `history.json` solo contesto/trend; `intervals.json` on-demand per sessioni con `has_intervals`/`has_dfa`; `routes.json` per il terreno degli eventi (vedi annesso §33).

I campi grezzi sotto restano come riferimento di copertura minima; **non vanno ricalcolati** se gia presenti nel mirror:

- profilo atleta;
- sport praticati;
- FTP/eFTP;
- soglie HR;
- zone potenza;
- zone frequenza cardiaca;
- attività recenti;
- durata attività;
- distanza;
- dislivello;
- potenza media;
- potenza normalizzata, se disponibile;
- FC media e massima;
- TSS/carico;
- intensità;
- calendario pianificato;
- wellness, se disponibile;
- HRV, se disponibile;
- RHR, se disponibile;
- sonno, se disponibile;
- peso, se disponibile;
- RPE, se disponibile;
- note attività, se disponibili.

### 9.3 Dati da scrivere

L'app deve poter scrivere:

- workout pianificati;
- note al workout;
- eventuali test programmati;
- modifiche a workout esistenti;
- cancellazione o spostamento workout, se confermato dall'utente;
- annotazioni post-analisi, in fase successiva.

### 9.4 OAuth e permessi

L'app deve richiedere solo i permessi necessari.

Permessi minimi stimati:

- leggere attività;
- leggere wellness;
- leggere calendario;
- scrivere calendario;
- leggere impostazioni/soglie.

I token devono essere cifrati nel database.

---

## 10. Integrazione AnalyzeMe

AnalyzeMe viene considerato come integrazione futura.

Prima di inserirlo nel prodotto servono risposte tecniche precise:

- esiste una API pubblica?
- esiste OAuth?
- esiste export dati?
- quali metriche fornisce?
- con quale licenza/permesso possono essere usate?
- l'utente può autorizzare l'accesso ai dati?

Nel MVP non basare funzionalità critiche su AnalyzeMe. **Nota (rev. v2):** la funzione diagnostica che cercavamo in AnalyzeMe (profilazione fenotipo, gap analysis, stima prestazione) e ora coperta in-house e in modo deterministico dal **Modulo Profilo Atleta** (annesso §33), che non dipende da API di terze parti. AnalyzeMe resta integrazione futura solo se esporrà un'API pubblica con licenza d'uso.

### 10.1 Uso futuro possibile

Se disponibile, AnalyzeMe potrebbe arricchire:

- profilo fisiologico;
- trend di performance;
- analisi fatica;
- test;
- metriche complementari.

Ma Intervals.icu deve restare la fonte primaria nella prima versione.

---

## 11. Livelli di qualità dati

L'app deve spiegare all'utente che la precisione del coach dipende dai dati disponibili.

> ⚠️ **Gate di integrita dati — sorgente del dispositivo (rev. v2).** Se il dispositivo (Garmin/Wahoo) sincronizza su Intervals.icu **passando da Strava**, l'API di Intervals restituisce campi spogliati o nulli (potenza, FC) per i termini d'uso Strava — con coaching silenziosamente degradato. In onboarding (§12) l'app deve verificare la presenza dei campi attesi e, se nulli, chiedere all'utente di **collegare il dispositivo direttamente a Intervals.icu**, non via Strava. Controllo bloccante per i livelli ≥2.

### Livello 0 — Dati insufficienti

Dati disponibili:

- solo profilo manuale;
- nessuna attività recente;
- nessun dato wellness.

Output consentito:

- piano molto prudente;
- onboarding;
- richiesta di collegare Intervals e registrare attività;
- nessun consiglio avanzato.

### Livello 1 — Dati base

Dati disponibili:

- attività recenti;
- durata/distanza;
- sport praticato.

Output consentito:

- piano base;
- progressione prudente;
- analisi carico semplice.

Limiti:

- niente decisioni accurate su intensità;
- niente readiness fisiologica.

### Livello 2 — Dati allenanti

Dati disponibili:

- potenza o frequenza cardiaca;
- FTP o zone HR;
- almeno 14–28 giorni di storico.

Output consentito:

- piani strutturati;
- zone di allenamento;
- primi Go/Modify/Skip affidabili.

### Livello 3 — Dati completi

Dati disponibili:

- potenza;
- FC;
- HRV;
- RHR;
- sonno;
- TSS/carico;
- almeno 28–90 giorni di storico;
- calendario obiettivi.

Output consentito:

- adattamenti giornalieri;
- pianificazione settimanale accurata;
- report post-workout approfonditi;
- test pianificati in modo sensato.

### Livello 4 — Dati avanzati

Dati disponibili:

- 90+ giorni di storico;
- RPE;
- note sensazioni;
- peso;
- eventi target;
- percorsi/gare;
- eventuali intervalli dettagliati;
- terrain data, se disponibili.

Output consentito:

- pianificazione mensile/stagionale;
- taper;
- analisi gara;
- preparazione obiettivo;
- test mirati;
- adattamenti avanzati.

---

## 12. Onboarding utente

### 12.1 Step onboarding

1. Creazione account.
2. Collegamento Intervals.icu.
3. Consenso privacy e dati salute.
4. Import dati iniziale.
4b. **Verifica integrita sorgente:** controllo che le attivita non arrivino spogliate via Strava (vedi §11). Se i campi potenza/FC sono nulli, guidare l'utente a collegare il device direttamente a Intervals.icu.
5. Creazione dossier atleta.
6. Definizione obiettivo principale.
7. Definizione disponibilità settimanale.
8. Definizione sport e attrezzatura.
9. Definizione limiti/infortuni.
10. Prima analisi coach.
11. Generazione prima settimana.

### 12.2 Dati dossier atleta

Il dossier deve includere:

- nome;
- età;
- sesso, opzionale ma utile per alcune interpretazioni;
- altezza;
- peso;
- sport principali;
- livello esperienza;
- obiettivi;
- gare target;
- data obiettivo;
- disponibilità settimanale ore;
- giorni preferiti;
- giorni impossibili;
- durata massima sedute weekday;
- durata massima weekend;
- indoor/outdoor;
- rulli sì/no;
- misuratore potenza sì/no;
- fascia cardio sì/no;
- smartwatch sì/no;
- infortuni attuali;
- dolore attuale;
- preferenze allenamento;
- limiti principali;
- note personali.

### 12.3 Messaggio educativo iniziale

L'app deve spiegare:

> Più dati hai su Intervals.icu, più il coach sarà preciso. Con soli dati base possiamo creare un piano prudente. Con potenza, frequenza cardiaca, HRV, sonno e storico possiamo adattare meglio carico, recupero e intensità.

---

## 13. Modulo Coach AI

### 13.1 Responsabilità

Il Coach AI deve:

- leggere il contesto atleta;
- ricevere dati già normalizzati;
- rispettare il protocollo decisionale;
- spiegare le decisioni;
- evitare diagnosi mediche;
- evitare numeri non presenti;
- dichiarare limiti dati;
- proporre azioni concrete;
- mantenere tono chiaro, utile e non allarmistico.

### 13.2 Cosa non deve fare

Il Coach AI non deve:

- inventare metriche;
- fingere precisione quando i dati mancano;
- diagnosticare malattie;
- ignorare dolore o infortuni;
- aumentare carico aggressivamente senza motivo;
- proporre test massimali in condizioni di fatica alta;
- modificare il calendario senza conferma o senza regole autorizzate.

---

## 14. Motore decisionale Go / Modify / Skip

### 14.1 Obiettivo

Dare ogni giorno una decisione semplice:

- **GO** — esegui la seduta prevista;
- **MODIFY** — fai una versione ridotta/modificata;
- **SKIP** — recupera o fai solo mobilità/attività leggerissima.

### 14.2 Gerarchia decisionale

Il sistema valuta in quest'ordine:

1. Sicurezza e sintomi.
2. Readiness fisiologica.
3. Carico recente.
4. Compliance e fatica percepita.
5. Obiettivo e fase del piano.
6. Disponibilità dell'utente.
7. Meteo/terreno, se rilevanti.

### 14.3 Safety override

Se l'utente segnala uno di questi elementi, il sistema deve suggerire stop o prudenza:

- dolore toracico;
- svenimento;
- febbre;
- malattia acuta;
- dolore acuto o peggiorativo;
- trauma recente;
- sintomi neurologici;
- forte dolore alla schiena;
- peggioramento non spiegato;
- richiesta esplicita di allenarsi nonostante dolore importante.

Output:

- raccomandazione Skip;
- messaggio prudente;
- invito a sentire medico/fisioterapista/professionista.

### 14.4 Regole iniziali MVP

**Rev. v2 — allineamento Section 11.** Le decisioni Go/Modify/Skip **non sono ricalcolate dall'app**: l'app legge l'oggetto `readiness_decision` gia pre-calcolato in `latest.json` da `sync.py`, basato sulla priority ladder deterministica P0–P3 di Section 11. Le condizioni verde/gialla/rossa sotto descrivono **i segnali sottostanti** a scopo divulgativo, ma le soglie operative ufficiali sono quelle di §14.5. Correzione importante rispetto alla v0: **un TSB tra −10 e −30 e normale e NON giustifica da solo MODIFY/SKIP**.

#### Readiness verde

Possibili condizioni:

- HRV stabile rispetto alla baseline;
- RHR stabile;
- sonno sufficiente;
- TSB non eccessivamente negativo;
- nessun dolore segnalato;
- carico settimanale coerente.

Decisione probabile:

- GO.

#### Readiness gialla

Possibili condizioni:

- HRV sotto baseline;
- RHR sopra baseline;
- sonno basso;
- TSB sotto la soglia di fase (definizione operativa in §14.5);
- ACWR elevato;
- RPE recente più alta del previsto;
- due o più giorni intensi ravvicinati;
- dolore lieve.

Decisione probabile:

- MODIFY.

Esempi modifica:

- ridurre durata del 20–40%;
- trasformare intensità in Z2;
- togliere intervalli VO2/soglia;
- fare recupero attivo;
- spostare seduta intensa.

#### Readiness rossa

Possibili condizioni:

- malattia;
- dolore significativo;
- HRV molto depressa più giorni;
- RHR molto elevata;
- sonno molto basso;
- carico acuto eccessivo;
- peggioramento marcato sensazioni;
- rischio sovraccarico.

Decisione probabile:

- SKIP.

---

### 14.5 Priority ladder e soglie ufficiali (lette da `readiness_decision`, Section 11)

Queste sono le soglie ufficiali, pre-calcolate da `sync.py` e **lette** dall'app. La decisione e la prima condizione che fa match (first match wins).

| Priorita | Condizione | Risultato |
|---|---|---|
| **P0 — Safety stop** | RI < 0.6, oppure un qualsiasi alarm tier-1 attivo | **Skip** (non negoziabile) |
| **P1 — Sovraccarico acuto** | ACWR ≥ 1.5, oppure (TSB < −30 + HRV ↓>10%), oppure (RI < 0.7 + alert tier-1 ≥2 giorni) | **Skip** |
| **P1 — Sovraccarico (modify)** | ACWR ≥ 1.3, oppure (TSB < −25 + HRV ↓>10%) | **Modify** |
| **P2 — Fatica accumulata** | segnali rossi ≥ 2, oppure 1 rosso in fase tightened, oppure ambra ≥ soglia di fase | **Modify** (Skip se 2+ rossi) |
| **P3 — Via libera** | nessuna delle precedenti | **Go** |

**Classificazione segnali:**

| Segnale | Verde | Ambra | Rosso |
|---|---|---|---|
| HRV | entro ±10% baseline 7g | ↓ 10–20% | ↓ >20% |
| RHR | ≤ baseline | ↑ 3–4 bpm | ↑ ≥5 bpm |
| Sonno | ≥ 7h | 5–7h | < 5h |
| TSB | > soglia di fase (default −15) | tra soglia e −30 | < −30 |
| ACWR | < 1.3 | ≥ 1.3 e < 1.5 | ≥ 1.5 |
| RI | ≥ 0.7 (o singolo giorno 0.6–0.69) | < 0.7 per 2+ giorni | < 0.6 |

**Interpretazione TSB (correzione chiave vs v0):**
- TSB da −10 a −30: **tipicamente normale** — e il meccanismo dell'adattamento, non un allarme.
- TSB < −30: monitorare, cercare segnali di fatica concomitanti.
- Una raccomandazione di recupero basata sul **solo** TSB **non e giustificata** se non accompagnata da HRV ↓>20%, RHR ↑≥5 bpm, Feel ≥4/5 o calo di prestazione.

**Override Feel/RPE:** escalation (Go→Modify→Skip) sempre ammessa se l'atleta sta peggio dei dati; de-escalation (Modify→Go) solo a P2 e con motivo dichiarato; P0/P1 non sono override-abili. ACWR basso (<0.8) non e una penalita di readiness.

**Trigger di progressione (green-light, tutti i disponibili devono valere):** Durability Index ≥ 0.97 per ≥3 lunghi (≥2h); HR drift < 3%; RI ≥ 0.85 (media mobile 7g); ACWR 0.8–1.3; Monotony < 2.5; Feel ≤ 3/5.

---

## 15. Pianificazione allenamenti

### 15.1 Tipi di piano

Il sistema deve supportare progressivamente:

1. piano giornaliero;
2. piano settimanale;
3. piano mensile;
4. piano stagionale;
5. piano gara/evento.

Nel MVP: giornaliero + settimanale.

### 15.2 Regole base piano settimanale

Il piano settimanale deve rispettare:

- disponibilità ore utente;
- giorni disponibili;
- massimo 2 sedute intense a settimana per atleta amatoriale standard;
- niente sedute intense back-to-back, salvo casi specifici;
- almeno 1 giorno facile o riposo dopo seduta molto intensa;
- lungo nel weekend se indicato;
- progressione carico prudente;
- settimana di scarico ogni 3–4 settimane, salvo adattamenti;
- taper prima di gara target;
- forza/mobilità se previste;
- tecnica, se sport MTB/trail.

### 15.3 Tipologie workout MVP ciclismo/MTB

> **Rev. v2 — selezione dalla Workout Library di Section 11.** Le sedute non vanno inventate liberamente dall'AI: vanno **selezionate dalla libreria** `examples/workout-library/` (Section 11 B §8), che definisce strutture e target. Le categorie sotto corrispondono alle famiglie presenti in libreria; la struttura intervalli concreta proviene dalla libreria, non da generazione libera.

- Endurance Z2;
- recovery ride;
- sweet spot;
- soglia;
- VO2max;
- sprint/neuromuscolare;
- forza resistente/salite;
- lungo endurance;
- tecnica MTB;
- test FTP;
- test endurance/decoupling;
- test soglia FC, se running/ciclismo senza potenza.

### 15.4 Scrittura workout su Intervals

Ogni workout generato deve avere:

- titolo;
- sport;
- data;
- durata stimata;
- obiettivo seduta;
- descrizione semplice;
- struttura intervalli;
- target potenza/HR/RPE;
- note coach;
- motivo della seduta;
- alternativa in caso di fatica.

---

## 16. Test e rivalutazioni

### 16.1 Quando pianificare un test

Il coach può proporre un test quando:

- FTP non aggiornata da molto tempo;
- prestazioni recenti suggeriscono cambio soglia;
- l'atleta completa lavori sopra target con RPE bassa;
- l'atleta fallisce ripetutamente lavori teoricamente sostenibili;
- inizia un nuovo blocco;
- è conclusa una fase di base/build;
- mancano dati affidabili di zone.

### 16.2 Quando non pianificare un test

Non proporre test se:

- readiness gialla/rossa;
- malattia o dolore;
- periodo di carico troppo alto;
- gara vicina;
- sonno/HRV/RHR indicano recupero scarso;
- l'atleta è appena rientrato da infortunio.

### 16.3 Test supportati MVP

- Ramp test FTP;
- 20-minute FTP test;
- test 5 min + 20 min, versione avanzata;
- endurance decoupling test 90–150 min;
- test LTHR, se dati HR affidabili;
- test tecnico MTB, solo come checklist qualitativa.

---

## 17. Reportistica

### 17.1 Report giornaliero pre-workout

Deve rispondere a:

- Come sto oggi?
- Posso fare la seduta prevista?
- Cosa devo modificare?
- Perché?

Formato:

- stato dati;
- readiness;
- carico recente;
- workout previsto;
- decisione Go/Modify/Skip;
- spiegazione breve;
- istruzioni pratiche;
- cosa monitorare durante la seduta.

### 17.2 Report post-workout

Deve includere:

- cosa era previsto;
- cosa è stato fatto;
- compliance;
- durata;
- carico;
- intensità;
- zone;
- FC/potenza, se disponibili;
- RPE, se disponibile;
- commento coach;
- impatto sul piano;
- eventuale modifica ai giorni successivi.

### 17.3 Report settimanale

Deve includere:

- ore totali;
- TSS/carico;
- compliance;
- distribuzione intensità;
- migliore seduta;
- criticità;
- recupero;
- andamento obiettivo;
- piano settimana successiva.

### 17.4 Report mensile/stagionale

Fuori MVP completo, ma da progettare.

Deve includere:

- fase allenamento;
- trend CTL/ATL/TSB;
- progressione volume;
- qualità intensità;
- test;
- blocchi di carico/scarico;
- obiettivi futuri.

---

## 18. Chat coach

### 18.1 Scopo

Permettere all'utente di fare domande come:

- “Come è andato l'allenamento di oggi?”
- “Domani cosa faccio?”
- “Sono stanco, modifico?”
- “Quando faccio il prossimo test FTP?”
- “Perché mi hai messo Z2?”
- “Questa settimana ho poco tempo, sistema il piano.”

### 18.2 Vincoli chat

La chat deve:

- leggere dati aggiornati prima di rispondere a domande di coaching;
- non usare memoria vecchia come fonte numerica;
- dichiarare dati mancanti;
- rispondere in modo pratico;
- proporre azioni, non solo spiegazioni;
- non dare diagnosi mediche.

---

## 19. Validatore output

Prima di mostrare o scrivere un piano, il sistema deve validare:

- durata totale settimanale entro disponibilità;
- carico coerente con storico;
- nessun aumento eccessivo non motivato;
- massimo numero sedute intense rispettato;
- recupero dopo intensità;
- assenza di conflitti calendario;
- workout compatibile con sport e strumenti disponibili;
- dati usati realmente presenti;
- linguaggio senza claim medici;
- eventuale modifica Intervals confermata o autorizzata.

Se il validatore fallisce, l'AI deve rigenerare o il sistema deve applicare fallback deterministico.

**Rev. v2 — schema Section 11 C.** Il validatore produce e persiste il `validation_metadata` standard di Section 11 C, non uno schema fatto in casa. Campi minimi: `data_source_fetched`, `json_fetch_status`, `protocol_version`, `checklist_passed` (item 0–10 della AI Self-Validation Checklist, inclusi 5b/6b), `checklist_failed`, `confidence` (high/medium/low), `missing_inputs`, `frameworks_cited` (ogni raccomandazione cita la scienza applicata — requisito Section 11 A), `phase_detected`. Cosi l'audit log e conforme al protocollo per costruzione.

---

## 20. Modello dati database

### 20.1 Tabelle principali

#### users

- id;
- email;
- name;
- created_at;
- plan_type;
- timezone;
- consent_health_data;
- consent_ai_processing;
- deleted_at.

#### athlete_profiles

- user_id;
- sport_primary;
- sport_secondary;
- birth_year;
- sex;
- height;
- weight_latest;
- goals;
- target_events;
- weekly_hours_available;
- weekday_constraints;
- weekend_constraints;
- equipment;
- injury_notes;
- preferences;
- experience_level.

#### intervals_connections

- user_id;
- access_token_encrypted;
- refresh_token_encrypted;
- scopes;
- expires_at;
- connected_at;
- status.

#### athlete_metrics_snapshots

- user_id;
- source;
- snapshot_date;
- latest_json;
- history_json;
- data_quality_level;
- created_at.

#### activities

- user_id;
- external_activity_id;
- sport;
- start_time;
- duration;
- distance;
- elevation;
- avg_power;
- normalized_power;
- avg_hr;
- max_hr;
- tss;
- intensity_factor;
- rpe;
- raw_json.

#### planned_workouts

- user_id;
- external_event_id;
- date;
- sport;
- title;
- description;
- duration;
- workout_structure;
- status;
- generated_by;
- created_at;
- updated_at.

#### coach_decisions

- user_id;
- date;
- decision_type;
- recommendation;
- input_snapshot_id;
- rules_triggered;
- ai_summary;
- validator_status;
- validation_metadata; // JSONB — schema Section 11 C (checklist_passed, protocol_version, frameworks_cited, confidence, missing_inputs)
- readiness_decision_snapshot; // copia dell'oggetto letto da latest.json
- created_at.

#### coach_messages

- user_id;
- role;
- content;
- input_snapshot_id;
- created_at.

#### audit_logs

- user_id;
- action;
- source;
- payload;
- created_at.

---

## 21. API interne MVP

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`

### Intervals

- `GET /api/integrations/intervals/connect`
- `GET /api/integrations/intervals/callback`
- `POST /api/integrations/intervals/disconnect`
- `POST /api/intervals/sync`

### Coach

- `POST /api/coach/readiness`
- `POST /api/coach/generate-week`
- `POST /api/coach/pre-workout-report`
- `POST /api/coach/post-workout-report`
- `POST /api/coach/chat`
- `POST /api/coach/validate-plan`

### Workouts

- `GET /api/workouts/planned`
- `POST /api/workouts/create`
- `POST /api/workouts/push-to-intervals`
- `POST /api/workouts/modify`
- `DELETE /api/workouts/:id`

---

## 22. UI MVP

### 22.1 Schermate principali

#### Landing page

Obiettivo:

- spiegare il prodotto;
- mostrare promessa;
- CTA registrazione;
- spiegare “più dati = più precisione”.

#### Onboarding

Step guidato:

- collega Intervals;
- importa dati;
- completa profilo;
- scegli obiettivo;
- genera prima analisi.

#### Dashboard oggi

Elementi:

- readiness;
- decisione Go/Modify/Skip;
- workout di oggi;
- perché;
- pulsante “scrivi/modifica su Intervals”;
- chat rapida.

#### Piano settimanale

Elementi:

- calendario settimana;
- sedute pianificate;
- carico totale;
- ore totali;
- modifica manuale;
- invio a Intervals.

#### Analisi

Elementi:

- report post-workout;
- trend settimana;
- compliance;
- note coach.

#### Chat coach

Elementi:

- conversazione;
- pillole suggerite;
- avviso dati usati;
- limiti dati.

#### Impostazioni

Elementi:

- account;
- Intervals connection;
- privacy;
- cancellazione dati;
- piano abbonamento.

---

## 23. Prompt e comportamento AI

### 23.1 System prompt base

Il coach AI deve ricevere istruzioni simili:

> Sei un coach endurance AI. Devi usare solo i dati forniti nel payload corrente. Non inventare metriche. Se i dati mancano, dichiaralo. Segui il protocollo decisionale dell'app. Produci raccomandazioni pratiche. Non fare diagnosi mediche. In caso di segnali di rischio, suggerisci prudenza e confronto con professionista qualificato.

### 23.2 Payload minimo per risposta coach

Ogni chiamata AI deve ricevere:

- profilo atleta;
- obiettivo;
- disponibilità;
- dati recenti;
- storico rilevante;
- piano attuale;
- regole attive;
- decisione deterministica preliminare;
- formato output richiesto.

### 23.3 Output strutturato richiesto

L'AI deve restituire JSON strutturato, non solo testo libero:

```json
{
  "decision": "GO | MODIFY | SKIP",
  "confidence": "low | medium | high",
  "data_quality": "level_0 | level_1 | level_2 | level_3 | level_4",
  "summary": "string",
  "reasons": ["string"],
  "recommended_workout": { "library_id": "string" },
  "modifications": [],
  "warnings": [],
  "frameworks_cited": ["string"],
  "protocol_version": "string",
  "checklist_passed": [0,1,2,3,4,5,"5b",6,"6b",7,8,9,10],
  "missing_inputs": ["string"],
  "user_message": "string"
}
```

Il testo mostrato all'utente viene preso da `user_message`, ma la logica usa i campi strutturati.

**Rev. v2:** `recommended_workout` deve referenziare un `library_id` della Workout Library di Section 11, non una struttura inventata. `frameworks_cited` e obbligatorio (Section 11 A). La decisione Go/Modify/Skip deve coincidere con `readiness_decision` di `latest.json`, salvo override esplicito e motivato dall'AI.

---

## 24. Guardrail legali e sicurezza

### 24.1 Disclaimer prodotto

L'app deve chiarire:

- non è un dispositivo medico;
- non fornisce diagnosi;
- non sostituisce medico, fisioterapista o professionista sanitario;
- le raccomandazioni sono supporto all'allenamento;
- l'utente è responsabile di ascoltare segnali fisici e interrompere in caso di sintomi.

### 24.2 GDPR e dati sensibili

L'app tratta dati potenzialmente sensibili:

- frequenza cardiaca;
- HRV;
- sonno;
- peso;
- wellness;
- infortuni/dolori;
- prestazioni fisiche.

Requisiti:

- consenso esplicito;
- privacy policy;
- possibilità di cancellazione account;
- possibilità di cancellazione dati;
- cifratura token;
- minimizzazione dati;
- log accessi;
- retention policy;
- DPA con fornitori cloud/AI;
- **DPIA obbligatoria** prima del lancio pubblico (non solo "valutare").

> **Coach IA come SaaS Section 11 (nota GDPR).** Section 11 è un protocollo progettato per essere implementato da prodotti come Coach IA. In quanto servizio web multi-utente che tratta dati di salute per conto degli utenti (HRV, FC, sonno, peso, infortuni), Coach IA è **titolare del trattamento** di dati di categoria particolare ex art. 9 GDPR. Obblighi standard per questo tipo di SaaS: base giuridica = consenso esplicito ex art. 9(2)(a); DPIA ex art. 35; DPA con tutti i sub-responsabili (cloud, provider AI); cifratura a riposo oltre che dei token; minimizzazione e retention definite; export/cancellazione reali.

---

## 25. Pricing ipotetico

### 25.1 Piani possibili

#### Free

- collegamento Intervals;
- data quality check;
- report settimanale base;
- chat limitata;
- nessuna scrittura automatica calendario.

#### Base — 9/12 €/mese

- readiness giornaliera;
- Go/Modify/Skip;
- piano settimanale;
- report post-workout;
- scrittura workout su Intervals;
- chat limitata.

#### Pro — 19/29 €/mese

- pianificazione mensile;
- test programmati;
- analisi più avanzate;
- chat più ampia;
- adattamento automatico settimana;
- preparazione gara.

#### Premium futuro — 49 €/mese

- stagione completa;
- multi-sport avanzato;
- analisi gara;
- supporto nutrizione base;
- eventuale supervisione umana opzionale.

### 25.2 Costi vivi stimati MVP

Costi minimi:

- dominio: 10–20 €/anno;
- hosting: 0–30 €/mese;
- database: 0–30 €/mese iniziali;
- AI API: variabile, stimare 1–10 €/utente/mese in base all'uso;
- Stripe: commissione per transazione;
- strumenti sviluppo: eventuale abbonamento Claude/Codex;
- legale/privacy: costo una tantum da valutare.

---

## 26. Metriche di successo MVP

### 26.1 Metriche prodotto

- utenti registrati;
- percentuale utenti che collegano Intervals;
- percentuale onboarding completato;
- numero report generati;
- numero piani settimanali generati;
- numero workout scritti su Intervals;
- retention 7 giorni;
- retention 30 giorni;
- tasso conversione free → paid.

### 26.2 Metriche coaching

- sedute completate / sedute pianificate;
- modifiche accettate dall'utente;
- giorni Skip corretti percepiti dall'utente;
- feedback utilità report;
- numero errori o consigli incoerenti;
- frequenza dati mancanti;
- accuratezza percepita.

### 26.3 Metriche sicurezza

- numero safety override;
- numero output bloccati dal validatore;
- numero escalation verso professionista;
- segnalazioni utente.

---

## 27. Milestone sviluppo

### Milestone 0 — Preparazione

Output:

- repository GitHub;
- PRD approvato;
- schema database;
- design base;
- chiavi Intervals OAuth;
- ambiente sviluppo.

### Milestone 1 — Auth + Intervals connect

Output:

- registrazione utente;
- login;
- collegamento Intervals;
- salvataggio sicuro token;
- sync manuale dati base.

### Milestone 2 — Integrazione mirror Section 11 (`sync.py`)

Output:

- integrazione/riuso di `sync.py` come pipeline dati (no mirror proprietario);
- ingestione di `latest/history/intervals/routes.json`;
- verifica integrita sorgente (gate Strava, §11);
- snapshot dati + data quality level;
- esposizione `readiness_decision` e `derived_metrics` all'app (read-only).

### Milestone 3 — Readiness + Go/Modify/Skip

Output:

- motore regole v0;
- dashboard oggi;
- report pre-workout;
- audit log.

### Milestone 4 — Piano settimanale

Output:

- generazione settimana;
- validatore piano;
- visualizzazione calendario;
- modifica manuale.

### Milestone 5 — Scrittura Intervals

Output:

- push workout su Intervals;
- modifica workout;
- cancellazione/spostamento;
- conferma utente.

### Milestone 6 — Report post-workout

Output:

- rilevamento attività completata;
- confronto previsto vs fatto;
- report semplice;
- modifica piano giorni successivi.

### Milestone 7 — Beta privata

Output:

- 5–10 utenti;
- feedback;
- correzione bug;
- controllo costi AI;
- revisione legale/privacy.

---

## 28. Criteri di accettazione MVP

L'MVP è accettabile quando:

- un utente può registrarsi;
- può collegare Intervals;
- l'app importa dati reali;
- il sistema mostra qualità dati;
- il coach genera report giornaliero;
- il sistema produce Go/Modify/Skip;
- il coach genera un piano settimanale;
- il piano viene validato;
- l'utente può inviare i workout a Intervals;
- dopo una seduta, l'app produce analisi;
- le decisioni sono salvate in audit log;
- i dati mancanti vengono dichiarati;
- l'AI non inventa metriche;
- il sistema gestisce casi di rischio con prudenza.

---

## 29. Rischi principali

### 29.1 Rischio tecnico

OAuth, sync dati e scrittura calendario possono essere più complessi del previsto.

Mitigazione:

- iniziare da lettura dati;
- poi scrittura calendario;
- testare con un solo account.

### 29.2 Rischio AI

L'AI può inventare, esagerare o produrre output incoerenti.

Mitigazione:

- output JSON strutturato;
- validatore;
- regole deterministiche;
- audit log;
- test automatici.

### 29.3 Rischio legale

Il prodotto usa dati salute/prestazione.

Mitigazione:

- privacy by design;
- consenso esplicito;
- disclaimer;
- revisione legale prima del lancio pubblico.

### 29.4 Rischio posizionamento

Promettere troppo rispetto a ciò che il prodotto può fare.

Mitigazione:

- comunicazione realistica;
- beta privata;
- claim misurabili;
- evitare “sostituisce completamente il coach”.

### 29.5 Rischio costi AI

Chat e report lunghi possono rendere il costo per utente troppo alto.

Mitigazione:

- modelli piccoli per report semplici;
- cache dei dati;
- prompt compatti;
- limiti per piano;
- generazione programmata, non continua.

---

## 30. Prompt iniziale per Claude Code/Codex

Usare questo prompt nel repository dopo aver creato il progetto:

```text
Stiamo costruendo una web app/PWA chiamata Coach AI Endurance.

Leggi il file PRD e aiutami a implementare il progetto per milestone, senza saltare passaggi.

Regole:
- Non costruire tutto insieme.
- Prima crea architettura, schema database e setup progetto.
- Poi procedi milestone per milestone.
- Ogni modifica deve essere spiegata.
- Ogni funzione critica deve avere test.
- Non inventare endpoint Intervals: quando servono, chiedimi documentazione o crea wrapper isolati.
- L'AI coach non deve mai inventare metriche: ogni numero deve venire dal mirror JSON di Section 11 (latest/history/intervals/routes.json) o dal payload corrente. Regola "No Virtual Math": le metriche derivate (CTL/ATL/TSB/ACWR/RI/fasi/durabilita) e la decisione readiness sono GIA pre-calcolate da sync.py — leggerle, non ricalcolarle.
- Prima di generare workout, implementa un validatore deterministico.
- Mantieni il codice semplice, leggibile e adatto a un founder non programmatore.

Stack preferito:
- Next.js
- TypeScript
- Tailwind
- Supabase
- PostgreSQL
- Stripe futuro
- OpenAI/Anthropic come provider AI configurabile

Primo task:
1. Crea la struttura progetto.
2. Crea schema database iniziale.
3. Crea pagina landing, login e onboarding placeholder.
4. Crea modulo integrazione Intervals con funzioni stub.
5. Non implementare ancora chiamate reali finché non confermiamo endpoint e OAuth.
```

---

## 31. Primo passo operativo consigliato

Prima di scrivere codice vero, fare questi 5 passaggi:

1. creare repository GitHub;
2. salvare questo PRD in `/docs/PRD.md`;
3. creare `/docs/ARCHITECTURE.md`;
4. creare `/docs/DECISION_ENGINE.md` con la matrice Go/Modify/Skip;
5. creare `/docs/INTERVALS_API_NOTES.md` con endpoint, scope OAuth e test account.

Solo dopo iniziare con Claude Code/Codex.

---

## 32. Decisione prodotto finale per MVP

Il primo MVP non deve promettere coaching completo stagionale.

Deve promettere:

> Accedi con il tuo account Intervals.icu, ottieni la tua scheda personale di atleta, ricevi ogni giorno una decisione chiara sul tuo allenamento, genera un programma personalizzato Section 11 e invialo al tuo calendario.

Questa è la base solida. Tutto il resto — mensile, stagionale, test avanzati, AnalyzeMe, nutrizione, triathlon — arriva dopo.

---

## 33. Modulo Profilo Atleta — diagnostica (annesso)

> **Collocazione nel PRD:** nuovo modulo da inserire dopo la sez. 11 (Livelli di qualità dati) e prima della sez. 13/14 (Coach AI / Motore decisionale). **Sostituisce** la dipendenza da AnalyzeMe descritta nella sez. 10: AnalyzeMe resta integrazione futura *solo se* un giorno esporrà un'API pubblica con licenza d'uso.
>
> **Versione:** v0 (soglie di classificazione da calibrare prima del lancio pubblico, coerentemente con l'approccio "v0, da validare" della sez. 14.4).

---

### A. Scopo e principio architetturale

Section 11 risponde al **quando e quanto** (carico, readiness, periodizzazione, Go/Modify/Skip). Manca la parte **diagnostica**: *che tipo di atleta è*, *dove è forte*, *dove è carente rispetto alle richieste dell'evento target*, e *quali lavori specifici colmano le lacune*. È la differenza tra gestire bene un piano e fare il lavoro di un preparatore, che prima profila l'atleta e poi costruisce le sedute sui suoi limitatori.

Il Modulo Profilo Atleta colma questo vuoto **senza** introdurre un'IA libera che inventa numeri. Vale lo stesso principio del resto del prodotto:

1. Un motore deterministico (`profile.py`, affiancato al `sync.py` di Section 11) **pre-calcola** profilo di potenza, CP/W′, APR, fenotipo e gap analysis, e li scrive in `profile.json`.
2. Tutti i numeri derivano da sforzi massimali realmente registrati su Intervals.icu o da metriche già pre-calcolate da Section 11 (durabilità). Nessuna stima inventata.
3. L'IA **legge** `profile.json` + `SECTION_11.md` + `DOSSIER.md` + `routes.json` e produce la **narrativa** (interpretazione, priorità, spiegazione delle sedute). Non ricalcola.

Questo mantiene il prodotto coerente con il marchio "deterministic, auditable" di Section 11 e rende il modulo un possibile contributo upstream al repo.

---

### B. Input (tutti già disponibili)

| Input | Fonte | Note |
|---|---|---|
| Record Power Profile (RPP): MMP a durate standard | Intervals.icu power curve | 1s, 5s, 15s, 30s, 1min, 3min, 5min, 8min, 12min, 20min, 30min, 60min |
| Peso corporeo | dossier / wellness | per i valori W/kg |
| FTP / eFTP | Intervals.icu | benchmark soglia |
| MAP (potenza aerobica massima) | best 5min o test MAP | per APR |
| Durabilità aggregata + trend | Section 11 (`latest.json`/`history.json`) | già pre-calcolata, non ricalcolare |
| Richieste terreno evento target | `routes.json` di Section 11 (read-only) | `events[].terrain_summary`: `climbs[]` (`position_km`, `distance_km`, `elevation_m`, `avg_gradient_pct`, `max_gradient_pct`, `category` — spesso `null`), `descents[]`, `polyline` 500 m `[km,lat,lon,ele]`, `course_character`, `elevation_per_km` |

---

### C. Motore di analisi (`profile.py`)

#### C.1 Record Power Profile (RPP)

Estrae la Mean Maximal Power a ciascuna durata standard, in assoluto (W) e relativo (W/kg). Mantiene due finestre:

- **Corrente** — ultimi 42–90 giorni (stato di forma attuale).
- **All-time / di riferimento** — miglior valore storico per durata (potenziale).

Per ogni durata registra la **data dello sforzo** e un flag `reliable`: se non esiste uno sforzo verosimilmente massimale a quella durata nella finestra, il valore è marcato non affidabile, escluso dal fit CP e segnalato nella narrativa come dato mancante. *(Base metodologica: Leo et al. 2022 — il power profiling richiede sforzi massimali; valori submassimali falsano il profilo.)*

#### C.2 Critical Power e W′ (modello a 2 parametri)

- **CP** = massima intensità a stato metabolico sostenibile; **W′** = capacità di lavoro anaerobica finita (kJ). *(Poole et al. 2016; Burnley & Jones 2018.)*
- **Finestra di fit valida:** sforzi massimali tra ~3 e ~12–15 minuti, minimo 3 sforzi su almeno 2–3 durate distinte. **Non** includere durate <2 min (dominate da W′) né >20–30 min: il modello a 2 parametri non ha un vero asintoto e a lungo sovrastima la CP per via della durabilità che degrada la potenza. *(Drake, Finke & Ferguson 2024 — power laws vs critical power.)*
- `is_estimate = true` se gli sforzi nella finestra valida sono <3: in quel caso CP/W′ sono indicativi e la confidence del profilo scende.
- **Interpretazione fisiologica (verificata su fonte primaria):** CP/kg elevata riflette capacità ossidativa/aerobica → fenotipo "diesel"/aerobico. Mitchell et al. 2018 (Journal of Applied Physiology) misura la CP che correla con % fibre tipo I (r=0,79), CSA fibre tipo I (r=0,73), rapporto capillari-fibra (r=0,88) e contatti capillari attorno alle fibre tipo I (r=0,94); W′ **non** correla con nessuna variabile morfologica. Implicazione pratica: una CP/kg alta non è un'astrazione, è capillarizzazione e fibre lente; W′ è invece capacità anaerobica indipendente (tamponamento, PCr, attivazione neuromuscolare). Àncora di riferimento per maschi endurance-trained (non pro): CP 303±52 W, W′ 17,0±3,0 kJ, MAP 406±63 W — più rappresentativa del target amatoriale evoluto dei valori WorldTour.
- **Fase 2 (opzionale):** affiancare un modello power-law come confronto per durate ampie, segnalando la discrepanza CP vs power-law come indicatore di durabilità. *(Drake et al. 2024.)*

#### C.3 Anaerobic Power Reserve (APR)

- **APR = MSP − MAP**, dove MSP = potenza di sprint massimale (~1–5s di picco) e MAP = potenza aerobica massima (~best 5min o test MAP).
- Rapporto **APR ratio = MSP / MAP**: alto → fenotipo esplosivo/sprinter; basso → aerobico/diesel.
- Utile per interpretare la prestazione nei brevi sforzi sopramassimali e per capire se una debolezza sui brevi è strutturale o allenabile. *(Sanders & Heijboer 2019.)*
- **Raffinamento MPR (Maximal Power Reserve):** la stima della MAP dipende dal protocollo incrementale e contiene una quota anaerobica, quindi è "sporca". In alternativa si può usare la **CP** al posto della MAP come limite inferiore della riserva (MPR = MSP − CP): separa più nettamente la componente ossidativa stazionaria da quella non stazionaria. Poiché la CP la calcoliamo già (C.2), l'MPR è a costo zero e più pulito dell'APR classico; lo `apr` in `profile.json` può portare entrambi i denominatori (`map_w` e `cp_w`).

#### C.4 Durabilità

Non ricalcolata: si legge l'Aggregate Durability già prodotta da Section 11 e si incrocia col profilo (es. quanto cala la potenza 5min/20min nell'ultima ora dei lunghi rispetto a freschi). Per eventi tipo Esatrail Super Hero (≈88 km, 4300 m D+) la durabilità è spesso **il** limitatore reale, più del valore fresco. *(Leo et al. 2022 sottolinea la durabilità come dimensione oltre l'RPP a fresco.)*

#### C.5 Classificazione fenotipo

Il fenotipo è definito dalla **forma** del profilo (rapporti tra durate), non dai valori assoluti — così è comparabile tra livelli diversi. Il **livello** invece si legge dal percentile W/kg rispetto ai database normativi pro (Valenzuela 2022 maschi; Mateo-March 2022 femmine), caricati come tabelle di percentile per durata.

Quattro pilastri (impianto classico rivisto in Leo et al. 2022) più due assi specifici endurance:

| Pilastro | Durata | Capacità rappresentata |
|---|---|---|
| Neuromuscolare | 5s | sprint puro |
| Anaerobico | 1min | capacità anaerobica |
| Aerobico massimo (MAP) | 5min | VO2max / potenza aerobica |
| Soglia | 20min / FTP / CP | sostenibilità |
| Durabilità | calo % a fatica | resistenza alla fatica |
| APR ratio | MSP/MAP | esplosività relativa |

**Archetipi (output `phenotype.primary` / `secondary`):**

- **Sprinter** — 5s molto alto, APR ratio alto, profilo che crolla in fretta.
- **Puncheur / anaerobico** — 1–3 min alti rispetto a FTP.
- **All-rounder** — profilo bilanciato.
- **Diesel / passista-scalatore** — 20–60 min e CP/kg alti, APR ratio basso, profilo piatto e durabilità alta. (Scalatore vs passista si distingue per W/kg vs W assoluti.)

**Soglie v0 (euristiche di ingegneria, da calibrare — NON valori pubblicati):**

| Asse | Indicatore | Soglia v0 |
|---|---|---|
| Esplosività | APR ratio = MSP/MAP | > ~2.6 esplosivo · < ~2.0 aerobico-orientato |
| Piattezza profilo | (5min W/kg) / (20min W/kg) | vicino a 1 = diesel · molto >1 = anaerobico |
| Punch | (1min W/kg) / (FTP W/kg) | alto = puncheur |

> Le soglie esatte vanno tarate sul database normativo (Valenzuela/Mateo-March) e sui dati reali della beta. Il metodo è fondato sulle fonti; i cutoff numerici sono v0, come per le soglie readiness della sez. 14.4.

#### C.6 Gap analysis vs evento target

> **Confine implementativo (importante per Claude Code/Codex):** l'analisi del terreno **esiste già** in `routes.json` di Section 11 e si **legge**, non si reimplementa. Il `profile.py` costruisce **solo** lo step 2 (terreno → domanda power-duration) e lo step 3 (confronto col fenotipo). Niente parsing GPX, niente rilevamento salite o calcolo pendenze da zero.

**Cosa fornisce già `routes.json`** (verificato sul repo, `sync_version` 3.95+; un evento per ogni gara con GPX/TCX allegato su Intervals). Ogni `events[]` ha un `terrain_summary` con:

- `total_distance_km`, `total_elevation_m`, `elevation_per_km`, `course_character` (`flat` <5 m/km · `rolling` ≥5 · `hilly` ≥20 · `mountain` ≥30 m/km).
- `climbs[]` — salite **sostenute** rilevate, ciascuna con: `position_km` (dove inizia nel percorso), `distance_km` (lunghezza), `elevation_m` (dislivello), `avg_gradient_pct`, `max_gradient_pct`, `start_coords`/`end_coords`, e `category`.
- `descents[]` — stessa struttura (senza categoria/max_gradient): finestre di recupero/rifornimento.
- `polyline` — `[km, lat, lon, elevation_m]` ogni 500 m.

→ **Read-only.** Niente parsing GPX, niente detection salite, niente calcolo pendenze.

> ⚠️ **Due realtà del campo, verificate nel codice, da non ignorare:**
> 1. **`category` è per DISLIVELLO guadagnato (UCI-derived), non per durata o pendenza:** HC ≥1000 m · Cat 1 ≥650 · Cat 2 ≥400 · Cat 3 ≥200 · Cat 4 ≥100 · **`null` sotto i 100 m**. Su percorsi MTB/punchy con tante salite corte e ripide, `category` sarà **`null` quasi ovunque**. La gap analysis **non deve dipendere da `category`**: deriva la domanda da `distance_km` + `avg_gradient_pct` + `elevation_m` + `position_km`.
> 2. **`max_gradient_pct` è su scala ATTENUATA** dallo smoothing della pipeline (12–15% reale legge ~6–8%). La soglia "ripido" di Section 11 è `max_gradient_pct ≥ 8` (≈ 12–15% reale). Usa 8 come trigger di "pitch anaerobico", non il valore nominale.
> 3. **Le kicker corte** sotto la soglia di climb sostenuto **non entrano** in `climbs[]`: si leggono dalla `polyline` (delta quota tra punti a 500 m). Per percorsi con tanti strappi brevi ripetuti, la `polyline` è la fonte, non `climbs[]`.

**Cosa costruisce il `profile.py`:**

1. **Legge** `climbs`/`descents`/`polyline` da `routes.json` (nessuna ricostruzione).
2. **Stima la durata** di ogni salita: non c'è un campo durata. Si stima da `distance_km` e `avg_gradient_pct` incrociati con la velocità attesa dell'atleta a quella pendenza (dal suo CP/peso). Da durata + pendenza deriva il tipo di sforzo: salita >20 min → potenza 20–30 min sostenuta; serie di salite ravvicinate (gap di `descents` brevi) → ripetibilità e ricostituzione di W′; `max_gradient_pct ≥ 8` → picco anaerobico dentro la salita; tratti lunghi da `polyline` a pendenza moderata → sweet spot/durabilità.
3. **Stima la fatica al punto della salita** (`position_km / total_distance_km` → kJ/kg cumulati attesi): una salita al km 70 di 88 va valutata **a fatica**, agganciandola alle tabelle XCO/U23 a fatica (I.2) e al modulo durabilità (C.4). È il ponte che rende la gap analysis realistica invece che a-fresco.
4. **Confronta** domanda evento vs fenotipo (`profile.json`) → lista ordinata di **limitatori** per severità.
5. Ogni limitatore mappa su una **leva di allenamento** → seduta **selezionata dalla Workout Library di Section 11** (`examples/workout-library/`, Section 11 B §8), mai inventata.

Esempio sul tuo target: Esatrail Super Hero ≈ 88 km / 4300 m → `elevation_per_km` ≈ 49 → `course_character` = `mountain`. Le salite lunghe ad alto `position_km` (seconda metà gara) sono il limitatore probabile, da valutare a fatica con la curva di durabilità, non con la CP a fresco.

---

### D. Schema `profile.json`

```json
{
  "meta": {
    "generated_at": "ISO-8601",
    "window_days": 90,
    "data_quality_level": "level_0..4",
    "confidence": "low | medium | high"
  },
  "rpp": [
    { "duration_s": 300, "watts": 0, "wkg": 0.0, "percentile_ref": "string",
      "effort_date": "ISO", "reliable": true }
  ],
  "cp_wprime": {
    "cp_w": 0, "cp_wkg": 0.0, "w_prime_kj": 0.0,
    "model": "2-param", "fit_window_s": [180, 900],
    "n_efforts": 0, "fit_quality": "good | fair | poor", "is_estimate": false
  },
  "apr": {
    "msp_w": 0, "map_w": 0, "apr_w": 0, "apr_ratio": 0.0,
    "category": "explosive | balanced | aerobic"
  },
  "durability": {
    "index": 0.0, "trend": "up | flat | down", "source": "section-11"
  },
  "phenotype": {
    "primary": "diesel | all_rounder | puncheur | sprinter",
    "secondary": "string | null",
    "confidence": "low | medium | high",
    "basis": ["apr_ratio", "profile_flatness", "punch_ratio"]
  },
  "gap_analysis": {
    "event_ref": "routes.json events[].event_id",
    "course_character": "flat|rolling|hilly|mountain",
    "event_demands": [
      {
        "name": "long_sustained_climb",
        "source": "routes.json:climbs",
        "position_km": 0.0,
        "distance_km": 0.0,
        "elevation_m": 0,
        "avg_gradient_pct": 0.0,
        "max_gradient_pct": 0.0,
        "category": "HC|Cat 1..4|null",
        "est_duration_s": 0,
        "est_fatigue_kjkg_at_point": 0.0,
        "evidence": "string"
      }
    ],
    "limiters": [
      {
        "name": "fractional_utilization_long_climb",
        "severity": "high | medium | low",
        "evidence": "string",
        "evaluate_fatigued": true,
        "training_lever": "sweet_spot_long | threshold_long | vo2 | wprime_reconstitution | durability_fatigued",
        "workout_library_refs": ["SS-3x15", "..."]
      }
    ]
  },
  "references": ["Poole2016", "Burnley2018", "Drake2024", "Leo2022",
                 "Valenzuela2022", "MateoMarch2022", "Mitchell2018", "Sanders2019"]
}
```

---

### E. Mappatura limitatore → leva → libreria

| Limitatore tipico | Leva | Tipologia seduta (da library Section 11) |
|---|---|---|
| Utilizzo frazionale CP su salite lunghe debole | sweet spot / soglia lunghi | SS 3×15–20', soglia 2×20' |
| Ripetibilità / ricostituzione W′ scarsa | VO2 / intermittenti | 30/15, VO2 5×4', over-under |
| Durabilità bassa (crolla a fine lunga) | volume Z2 + sforzi a fatica | lungo Z2, blocchi qualità a fine lunga |
| MAP/5min basso | VO2max | 4–6×3–5' a VO2 |
| APR/sprint basso (se rilevante per l'evento) | neuromuscolare | sprint 8–12×10–15" |

---

### F. Regole di determinismo e onestà dati

- Ogni numero proviene da sforzi massimali registrati o da metriche Section 11 pre-calcolate. Mai inventare.
- Durata senza sforzo massimale recente → `reliable: false`, esclusa dal fit, dichiarata mancante.
- CP/W′ con <3 sforzi validi → `is_estimate: true`, confidence ridotta.
- `phenotype.confidence` deriva dalla completezza dati (durate coperte, presenza MSP/MAP, storico).
- Coerenza con il check Strava (sez. 11): se i dati arrivano via Strava con campi nulli, l'RPP è inaffidabile → modulo in stato degradato, segnalato all'utente.

---

### G. Output IA (narrativa) e innesto nel sistema

L'IA, leggendo `profile.json`, produce:

- **Sintesi profilo:** "Sei un diesel con punta anaerobica debole; CP/kg buona, APR basso, durabilità in crescita."
- **Limitatori per l'evento target:** ordinati, con evidenza dai dati.
- **Razionale delle sedute:** perché il blocco lavora su X, citando il framework (requisito `frameworks_cited` di Section 11 A).

Innesto:

- **Planner settimanale (sez. 15):** la selezione delle sedute è guidata dai `limiters` di `profile.json`, sempre entro i vincoli readiness/carico di Section 11. Il profilo dice *cosa* allenare; Section 11 dice *quando e quanto*.
- **Go/Modify/Skip (sez. 14):** invariato — la decisione giornaliera resta funzione delle metriche readiness pre-calcolate. Il profilo non sovrascrive mai la sicurezza.

---

### H. Fasatura

- **MVP:** RPP + CP/W′ + APR + fenotipo + gap analysis vs evento (sfruttando `routes.json`), output `profile.json`, narrativa IA.
- **Fase 2:** stima prestazione gara (modello fisico potenza/pendenza/peso/aerodinamica), confronto power-law vs CP, trend fisiologici longitudinali, eventuale integrazione AnalyzeMe se esporrà un'API.

---

### I. Riferimenti scientifici e mappatura

| Fonte | Cosa fonda nel modulo |
|---|---|
| Poole, Burnley, Vanhatalo, Rossiter & Jones (2016) — *Critical power: an important fatigue threshold* | Definizione e significato di CP come soglia di fatica (C.2) |
| Burnley & Jones (2018) — *Power–duration relationship: physiology, fatigue, limits* | Base fisiologica della relazione potenza-durata (C.2) |
| Drake, Finke & Ferguson (2024) — *Modelling human endurance: power laws vs critical power* | Limiti del modello CP a 2 parametri, finestra di fit, alternativa power-law (C.2) |
| Leo, Spragg, Podlogar, Lawley & Mujika (2022) — *Power profiling and the power-duration relationship in cycling* | Metodologia RPP, durate standard, durabilità, sforzi massimali (C.1, C.4, C.5) |
| Valenzuela et al. (2022) — *Record Power Profile of Male Professional Cyclists* | Tabelle normative W/kg maschili per percentile (C.5) |
| Mateo-March et al. (2022) — *Record Power Profile in Professional Female Cyclists* | Tabelle normative W/kg femminili per percentile (C.5) |
| Mitchell, Martin, Bailey & Ferguson (2018) — *Critical power positively related to capillarity and type I fibers* | Interpretazione fisiologica del fenotipo aerobico/diesel (C.2, C.5) |
| Sanders & Heijboer (2019) — *The anaerobic power reserve and its applicability in professional road cycling* | Definizione e uso dell'APR (C.3, C.5) |

#### I.1 Valori normativi — tabelle di livello (percentili complessivi, verificate)

**Stato fonti:** le tabelle pro **per tipologia** (sprinter/scalatore/passista/all-rounder) esistono nei paper ma sono dietro paywall (IJSPP, Human Kinetics; abstract maschile conferma le categorie: all-rounder n=65, climber n=50, TT n=11, sprinter n=11, GC n=7). Disponibili e **verificate** in accesso libero sono invece le tabelle a **percentile sull'intera popolazione pro** — che è ciò che serve per l'ancoraggio di livello (`percentile_ref`).

**Affidabilità:** punti chiave verificati su fonte secondaria fedele (wattkg.com, dichiaratamente "adopted from Valenzuela 2022") e coerenti con le soglie "competitive" P75 pubblicate dal paper (>6,3 / 5,5 / 4,9 / 4,4 W/kg a 20/60/120/240 min) e, per il femminile, con le medie campione già verificate (P50 5s=15,3 · 1min=8,4 · 10min=5,2). Griglia completa da riproduzioni secondarie, da confermare sui PDF originali per le colonne intermedie.

**Pro maschile — MMP W/kg, percentili popolazione complessiva (Valenzuela 2022):**

| Durata | P10 | P25 | P50 | P75 | P90 |
|---|---:|---:|---:|---:|---:|
| 5 s | 15,71 | 16,59 | 17,99 | 19,78 | 20,83 |
| 1 min | 8,87 | 9,51 | 10,10 | 10,74 | 11,33 |
| 5 min | 6,52 | 6,75 | 7,06 | 7,34 | 7,65 |
| 10 min | 5,92 | 6,19 | 6,45 | 6,77 | 7,00 |
| 20 min | 5,47 | 5,79 | 6,03 | 6,29 | 6,59 |
| 30 min | 5,10 | 5,36 | 5,71 | 6,02 | 6,24 |
| 60 min | 4,71 | 4,91 | 5,15 | 5,47 | 5,76 |

**Pro femminile — MMP W/kg, percentili popolazione complessiva (Mateo-March 2022):**

| Durata | P10 | P25 | P50 | P75 | P90 |
|---|---:|---:|---:|---:|---:|
| 5 s | 13,1 | 14,0 | 15,3 | 16,3 | 17,2 |
| 1 min | 7,3 | 7,7 | 8,4 | 9,0 | 9,4 |
| 5 min | 5,1 | 5,5 | 5,8 | 6,3 | 6,5 |
| 10 min | 4,6 | 4,9 | 5,2 | 5,6 | 6,0 |
| 20 min | 4,3 | 4,5 | 5,0 | 5,2 | 5,5 |
| 30 min | 4,0 | 4,3 | 4,7 | 5,0 | 5,3 |
| 60 min | 3,7 | 3,9 | 4,3 | 4,6 | 4,9 |

> ⚠️ **Non sono tabelle per categoria.** Servono per dire *a che livello* è l'atleta, non *che tipo* è. Il tipo (fenotipo) si deriva dalla forma del suo profilo (C.5).
>
> ⚠️ **Sono percentili PRO.** Un amatore evoluto cadrà spesso sotto il P10: è normale e atteso. Per un ancoraggio più informativo sul target amatoriale serve una normativa non-pro (vedi I.2).

**Da NON inserire nel motore (solo illustrazione di forma):** archetipi iQO2 (top sprinter/climber/all-rounder), benchmark PSP per durate extra (15 s, 4 min, salita), e profili CP per tipologia di Frontiers 2025. Sono costruzioni da specialista-top o modelli (CP ≠ FTP ≠ MMP 60 min), non percentili: utili a *vedere* la forma di un fenotipo, mai come soglia di classificazione.

#### I.2 Normative popolazioni non-pro — più vicine al target amatoriale evoluto

> Questi due paper sono il riferimento più pertinente per un amatore evoluto o semi-élite: non ci si confronta con i WorldTour, ci si colloca rispetto a élite U23 strada e XCO élite mondiale. Entrambi usano la stessa metodologia RPP (MMP da file reali, allenamento + gara) ed escono dallo stesso gruppo di ricerca (Sánchez-Jiménez, Javaloyes, Mateo-March, Moya-Ramón).

##### I.2a XCO élite maschile — Sánchez-Jiménez et al. 2025

**Fonte:** Sánchez-Jiménez JL, Javaloyes A, Peña-González I, Moya-Ramón M, Mateo-March M. *Record Power Profile in Elite Olympic Cross-Country Mountain Bike Cyclists: Normative Values and Fatigue Effects.* Scand J Med Sci Sports. 2025;35:e70170. DOI: 10.1111/sms.70170

**Campione verificato:** 693 file gara XCO élite maschili (2020–2024), Top 10 (n=72) vs Top 11–140 (n=621). MMP misurate su durate 5 s → 5 min, condizioni **fresh** (primo giro, ~188±35 kJ spesa energetica cumulata) e **a fatica** (ultimo giro, ~1250±210 kJ).

**Risultati qualitativi verificati (abstract):** MMP assolute significativamente più alte in condizioni fresh (p<0,001, effect size=1,0 vs condizione affaticata). Top 10 superiori al gruppo Top 11–140 (p<0,001, effect size 0,3–0,6). Correlazione forte tra durate e condizioni.

> ⚠️ **Avviso metodologico critico — non ignorare.** I valori sono estratti da **file gara**, non da test massimali. Il "fresh" è il primo giro di una gara XCO con ~188 kJ già spesi — non è potenza a riposo. Questo li rende **direttamente confrontabili con la prestazione in evento**, ma **sistematicamente più bassi** rispetto a un RPP "vero" costruito su sforzi massimali freschi. Per la gap analysis (cosa riesci a produrre in gara dopo fatica accumulata) sono oro; per la classificazione del fenotipo a fresco sono meno appropriati dei valori Valenzuela/Mateo-March 2022.

**Tabella W/kg:** DA COMPLETARE dal PDF (paywall Wiley). Struttura attesa: righe = durate [5s, 15s, 30s, 1min, 3min, 5min], colonne = [Top10 fresh, Top10 fatigued, Top11-140 fresh, Top11-140 fatigued].

**Dati contestuali verificati da letteratura XCO open access:**

| Indicatore | Valore | Fonte |
|---|---|---|
| MAP media élite XCO internazionale | 6,3 W/kg (411 W) | Inoue et al., 8 ciclisti internazionali, 13 gare |
| Potenza media gara XCO | 4,31 W/kg (~68% MAP) | stesso studio |
| MAP junior/U23 nazionale-internazionale | 5,2 W/kg | revisione fisiologia XCO |
| % gara sopra VT2 | ~37% | revisione fisiologia XCO |
| % gara sopra MAP | ~25% (burst 5–30 s) | revisione fisiologia XCO |

Questi sono i valori contestuali più utili per la gap analysis del percorso (quanto del tuo tempo spenderai sopra soglia in un evento tipo Esatrail), mentre aspetti i valori MMP dal PDF.

---

##### I.2b U23 élite maschile strada — Sánchez-Jiménez et al. 2026

**Fonte:** Sánchez-Jiménez JL, Moya-Ramón M, Javaloyes A et al. *The Record Power Profile of Male Under-23 Cyclists: Normative Values and Fatigue Effects.* Scand J Med Sci Sports. 2026;36:e70278. DOI: 10.1111/sms.70278

**Campione verificato:** 90 ciclisti U23 élite, grandi giri U23 2025 (Giro Next Gen, Tour de l'Avenir, Orlen Nations Grand Prix, Tour de la Paix). MMP per durate **5 s, 30 s, 1 min, 5 min, 20 min**, condizioni fresh e dopo livelli di fatica predefiniti (1000–3000 kJ assoluti = 20–60 kJ/kg relativi; lavoro sopra CP: 100–300 kJ = 2–6 kJ/kg).

> ⚠️ **Avviso metodologico:** dati da file gara strada U23 élite, non da test massimali in laboratorio. Simile a XCO: confrontabili con prestazione in evento, potenzialmente sottostimati rispetto a RPP massimale.

**Tabella W/kg:** DA COMPLETARE dal PDF (paywall Wiley). Struttura attesa: righe = [5s, 30s, 1min, 5min, 20min], colonne = [fresh P10/P50/P90, decadimento a 20/40/60 kJ/kg].

**Perché è rilevante per il tuo target:** un amatore evoluto che gareggia in endurance MTB (Esatrail, gran fondo, Marathon) si colloca spesso nell'intervallo U23 élite strada per le durate medie e lunghe (20 min+), mentre è sistematicamente sotto su durate brevi (sprint puro). È un benchmark realistico, non aspirazionale come i valori WorldTour.

---

##### I.2c Confronto gerarchico popolazioni

| Popolazione | Durate coperte | Tipo di dato | Pertinenza per amatore evoluto |
|---|---|---|---|
| Pro WorldTour/ProTeam (Valenzuela 2022) | 1s–240min | MMP max (training+race) | Aspirazionale, utile per livello assoluto |
| Pro femminile (Mateo-March 2022) | 5s–60min | MMP max (training+race) | Riferimento femminile |
| XCO élite (Sánchez-Jiménez 2025) | 5s–5min | MMP da gara (race-paced) | **Alta**: spec. per gap analysis evento |
| U23 élite strada (Sánchez-Jiménez 2026) | 5s–20min | MMP da gara U23 | **Alta**: benchmark realistico livello |
| Endurance-trained non-pro (Mitchell 2018) | CP, W′ | Test lab (n=14) | **Alta**: ancora di sanity check W′/CP |

#### I.3 Come usare i normativi nel classificatore

- La classificazione del **fenotipo** usa la *forma* del profilo (rapporti tra durate, comparabili tra livelli); il **percentile** esprime il *livello* rispetto a una popolazione di riferimento scelta.
- **Livello (`percentile_ref`): popolabile su più popolazioni.** Le tabelle di I.1 (pro Valenzuela/Mateo-March 2022) e le future tabelle di I.2 (XCO élite, U23 élite) alimentano il campo `percentile_ref` con tag `population` esplicito. Per un amatore evoluto il confronto più utile è `u23_elite_male` per 5–20 min e `xco_elite_male` per la gap analysis a fatica. Rispetto ai pro WorldTour cadrà spesso `<P10`: normale e atteso, va comunicato come tale all'utente.
- **Tipo (fenotipo): solo forma.** Le tabelle per-categoria MMP dei PDF 2022 restano non disponibili in accesso libero. Il fenotipo si deriva dai **rapporti di forma v0** (C.5); iQO2/PSP/Frontiers solo come illustrazione visiva, mai come soglia.
- **Regola dura — non mescolare natura di benchmark diversa.** MMP da test massimale (pro 2022, U23 2026), MMP race-derived (XCO 2025), benchmark specialista-top (PSP), archetipo software (iQO2) e parametro CP (Frontiers) sembrano tutti "W/kg" ma rispondono a domande diverse. Ogni valore normativo in `profile.json` porta i tag `source_type` e `data_type`; il classificatore confronta solo valori con gli stessi tag.
- **Quando le tabelle XCO/U23 arrivano dai PDF:** le inserisci qui e aggiorni `profile.json` aggiungendo le righe `population: xco_elite_male` e `population: u23_elite_male` senza toccare la logica del classificatore.


---

## 34. Mappa di conformita Section 11

Verifica esplicita che ogni requisito chiave del protocollo sia soddisfatto dal PRD.

| Requisito Section 11 | Dove e soddisfatto | Stato |
|---|---|---|
| **Data Mirror Integration** (Tier-1 verified mirror via local/connector/URL) | §7.2, §9.2, §27 M2 | Conforme: consumo di `latest/history/intervals/routes.json` |
| **No Virtual Math** (11 A.1) | §4, §8, §30 | Conforme: app legge i derivati, non li ricalcola |
| **Data Source Usage Hierarchy** (latest primario, history contesto, intervals on-demand) | §9.2 | Conforme |
| **Readiness Decision P0–P3** (letta, non ricalcolata) | §14.4–14.5 | Conforme |
| **TSB Interpretation** (−10/−30 normale; no recovery sul solo TSB) | §14.5 | Conforme (corretto vs v0) |
| **Success & Progression Triggers** (DI, HR drift, RI, ACWR, Monotony, Feel) | §14.5 | Conforme |
| **AI Self-Validation Checklist 0–10** | §19, §20 (coach_decisions), §23.3 | Conforme |
| **Validation Metadata Schema (11 C)** con `frameworks_cited` | §19, §23.3 | Conforme |
| **AI Training Plan: selezione da Workout Library (11 B §8)** | §15.3, §23.3 | Conforme |
| **Route & Terrain Protocol** (`routes.json`) | §9.2, §33 C.6 | Conforme: read-only, campi reali verificati |
| **Determinism / auditability** | §8, §33 A | Conforme: motore deterministico, AI solo narrativa |
| **Privacy posture** (SaaS multi-utente su Section 11) | §24.2 | Conforme: Coach IA è l'implementazione hosted di Section 11; obblighi GDPR SaaS standard |
| **Feel/RPE override, safety-first** | §14.3, §14.5 | Conforme |

**Piena conformità al protocollo.** Coach IA è l'implementazione web multi-utente di Section 11: il protocollo nasce per essere il motore di prodotti come questo. Gli obblighi GDPR di §24.2 sono standard per qualsiasi SaaS che tratta dati di salute, non una deviazione dal protocollo.

---

*Fine documento unico — PRD Coach IA Endurance (rev. v2) + Modulo Profilo Atleta + Mappa di conformita Section 11.*
