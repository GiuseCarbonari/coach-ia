# Periodo Infortunio — Piano di Implementazione

Data: 2026-06-25  
Milestone: M10

---

## Obiettivo

Permettere all'atleta di dichiarare un **periodo di infortunio** (range di date) durante il quale il planner non genera sedute e la UI mostra un visual cue chiaro. Alla fine del periodo, il planner riprende normalmente.

---

## Contesto architetturale

| Pezzo | File | Note |
|---|---|---|
| Tipi piano | `lib/planner/build-week.ts:168-202` | `BuiltSession` ha già `rest: boolean` e `blocked_by_user` |
| DB piani | `supabase/migrations/008_weekly_plan.sql` | Tabella `weekly_plans`, sessions JSONB |
| Profilo atleta | `supabase/migrations/006_dossier.sql` | `athlete_profiles`, colonna `infortuni_attuali text` (solo nota) |
| Generazione piano | `app/api/planner/generate/route.ts:126+` | Pipeline che chiama `computeAvailableDays` → `selectSessions` → `buildWeek` |
| Disponibilità giorni | `lib/planner/session-selector.ts:25-65` | `computeAvailableDays` legge `giorni_impossibili` dal dossier |
| UI griglia | `components/plan/week-grid.tsx` | Renderizza 7 card; colori da `sessionTone` |
| Form dossier/settings | `app/settings/profile/` o wizard onboarding | Dove va il form nuovo |

---

## Approccio (ponytail)

Riusa il meccanismo esistente dei **giorni bloccati** (`blocked_by_user`), estendendolo con un range multi-settimana. Non serve una nuova tabella: aggiungiamo una colonna JSONB `injury_periods` in `athlete_profiles`.

Il planner già salta i giorni con `blocked_by_user = true`; basta che, prima di generare, espanda il range infortunio nei giorni concreti e li marchi come bloccati.

---

## Operazioni da fare (in ordine)

### 1. Migrazione DB — nuova colonna `injury_periods`

**File:** `supabase/migrations/013_injury_periods.sql` *(nuovo)*

```sql
-- Migration 013: injury_periods su athlete_profiles
ALTER TABLE public.athlete_profiles
  ADD COLUMN IF NOT EXISTS injury_periods jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.athlete_profiles.injury_periods IS
  'Array di {start: YYYY-MM-DD, end: YYYY-MM-DD, note?: string}';
```

Nessuna nuova tabella. Zero join. Array JSONB già usato altrove nel dossier.

---

### 2. Tipo TypeScript per il range infortunio

**File:** `lib/onboarding/dossier.ts`

Aggiungi dopo le interfacce esistenti (vicino a `DossierForm`, riga ~67):

```typescript
export interface InjuryPeriod {
  start: string;  // YYYY-MM-DD
  end: string;    // YYYY-MM-DD
  note?: string;
}
```

Aggiungi `injury_periods: InjuryPeriod[]` alla whitelist `DOSSIER_COLUMNS` se quella lista filtra le colonne scritte su DB.

---

### 3. Funzione helper — date in infortunio

**File:** `lib/planner/injury.ts` *(nuovo, ~20 righe)*

```typescript
import type { InjuryPeriod } from '@/lib/onboarding/dossier';

/** Restituisce true se `date` (YYYY-MM-DD) cade in uno dei periodi di infortunio. */
export function isInjured(date: string, periods: InjuryPeriod[]): boolean {
  return periods.some(p => date >= p.start && date <= p.end);
}

/** Ritorna le date YYYY-MM-DD della settimana corrente che cadono in infortunio. */
export function injuredDatesInWeek(
  weekDates: string[],
  periods: InjuryPeriod[],
): Set<string> {
  return new Set(weekDates.filter(d => isInjured(d, periods)));
}
```

Test inline (eseguibile con `npx tsx lib/planner/injury.ts`):

```typescript
// ponytail: self-check — rimuovi prima del merge se preferisci
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  const periods = [{ start: '2026-07-01', end: '2026-07-10' }];
  console.assert(isInjured('2026-07-05', periods) === true);
  console.assert(isInjured('2026-06-30', periods) === false);
  console.assert(isInjured('2026-07-10', periods) === true);  // incluso
  console.log('injury.ts OK');
}
```

---

### 4. Integrare nel planner — saltare giorni in infortunio

**File:** `app/api/planner/generate/route.ts`

Nella funzione `lockedDates()` (o subito dopo, dove si costruisce `availableDays`), aggiungi il blocco infortunio.

Cerca la zona intorno alla riga 278 dove si preservano i locked dates. Aggiungi:

```typescript
// Leggi injury_periods dal profilo atleta (già letto sopra come `profile`)
const injuryPeriods: InjuryPeriod[] = profile.injury_periods ?? [];

// Marca come blocked_by_user tutte le sessioni in infortunio
// PRIMA di passare sessions a buildWeek
for (const session of sessions) {
  if (isInjured(session.date, injuryPeriods)) {
    session.blocked_by_user = true;
    session.rest = true;
    session.title = 'Infortunio';
    session.description = ''; // ponytail: non serve narrativa
  }
}
```

Import in cima al file:

```typescript
import { isInjured, type InjuryPeriod } from '@/lib/planner/injury';
```

> **Alternativa più robusta:** Aggiungi `injuryPeriods` come input di `computeAvailableDays` in `session-selector.ts` e filtra lì, prima ancora di selezionare le sedute. Così il planner non spreca lavoro a generare una seduta che poi butta. Vedi sezione "Opzione avanzata" in fondo.

---

### 5. Visual cue nella griglia — card "Infortunio"

**File:** `components/plan/week-grid.tsx`

La `sessionTone` esistente mappa il tipo di seduta al colore. Aggiungi un caso per l'infortunio:

```typescript
// Vicino a sessionTone (riga ~14-28), aggiungi:
function sessionTone(s: BuiltSession) {
  if (s.title === 'Infortunio') return 'injury';  // nuovo
  if (s.rest) return 'rest';
  if (s.is_hard) return 'hard';
  // ... resto invariato
}
```

Nella card del giorno, aggiungi il visual cue se `tone === 'injury'`:

```tsx
{tone === 'injury' && (
  <div className="flex items-center gap-1 text-xs text-muted-foreground italic">
    <span>🩹</span>
    <span>Periodo infortunio</span>
    {session.coach_notes && <span>— {session.coach_notes}</span>}
  </div>
)}
```

Colore bordo sinistro (Tailwind, nella stessa logica dei `border-l-*`):

```tsx
// Aggiorna la mappa colori bordo:
const borderColor = {
  injury:  'border-l-orange-400',
  rest:    'border-l-border',
  hard:    'border-l-ready-skip',
  medium:  'border-l-brand',
  easy:    'border-l-accent2',
}[tone];
```

---

### 6. Form UI — dichiarare il periodo

**File:** `app/settings/profile/page.tsx` *(o la pagina profilo esistente)*

Sezione "Infortuni" con due `<input type="date">` e un campo note opzionale:

```tsx
// Componente minimale — non serve una libreria date-picker
function InjuryPeriodForm({ periods, onSave }: {
  periods: InjuryPeriod[];
  onSave: (updated: InjuryPeriod[]) => void;
}) {
  const [start, setStart] = useState('');
  const [end, setEnd]   = useState('');
  const [note, setNote] = useState('');

  function add() {
    if (!start || !end || end < start) return;
    onSave([...periods, { start, end, note: note || undefined }]);
    setStart(''); setEnd(''); setNote('');
  }

  function remove(i: number) {
    onSave(periods.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Periodi infortunio</h3>
      {periods.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span>{p.start} → {p.end}</span>
          {p.note && <span className="text-muted-foreground">({p.note})</span>}
          <button onClick={() => remove(i)} className="text-destructive text-xs">Rimuovi</button>
        </div>
      ))}
      <div className="flex gap-2">
        <input type="date" value={start} onChange={e => setStart(e.target.value)} />
        <input type="date" value={end}   onChange={e => setEnd(e.target.value)}   min={start} />
        <input placeholder="Nota (opz.)" value={note} onChange={e => setNote(e.target.value)} />
        <button onClick={add}>Aggiungi</button>
      </div>
    </div>
  );
}
```

Al salvataggio, chiama l'API profilo esistente con `injury_periods: updatedPeriods`.

---

### 7. Aggiornare `DOSSIER_COLUMNS` whitelist

**File:** `lib/onboarding/dossier.ts:177-218`

```typescript
// Aggiungi 'injury_periods' alla whitelist DOSSIER_COLUMNS
export const DOSSIER_COLUMNS = [
  // ... esistenti ...
  'injury_periods',  // nuovo
] as const;
```

---

## Flusso completo (end-to-end)

```
Utente dichiara infortunio (01/07 – 10/07)
  → salva injury_periods in athlete_profiles
  → utente o cron triggerizza /api/planner/generate
  → planner legge injury_periods
  → giorni 01-10/07 → blocked_by_user = true, title = 'Infortunio'
  → week-grid mostra card arancione "Periodo infortunio"
  → fase detection e mesocycle ignorano quei giorni (già esclusi)
  → 11/07: ripresa normale, planner genera sedute
```

---

## Opzione avanzata (solo se serve)

Invece di bloccare le sessioni a posteriori, filtrare **a monte** in `computeAvailableDays`:

**File:** `lib/planner/session-selector.ts`

```typescript
// Aggiungi parametro alla funzione
export function computeAvailableDays(
  dossier: PlannerDossier,
  weekDates: string[],
  injuryPeriods: InjuryPeriod[] = [],  // nuovo
): DayKey[] {
  return weekDates
    .filter(d => !isInjured(d, injuryPeriods))  // nuovo filtro
    .filter(d => !dossier.giorni_impossibili.includes(dateToDayKey(d)))
    .map(dateToDayKey);
}
```

Questo evita che il LLM generi narrativa per settimane completamente in infortunio.  
**Aggiungilo solo se la narrativa AI diventa un problema pratico.**

---

## Riepilogo file toccati

| File | Operazione |
|---|---|
| `supabase/migrations/013_injury_periods.sql` | **NUOVO** — colonna `injury_periods` |
| `lib/onboarding/dossier.ts` | Tipo `InjuryPeriod` + whitelist |
| `lib/planner/injury.ts` | **NUOVO** — helper `isInjured` |
| `app/api/planner/generate/route.ts` | Blocca sessioni in infortunio |
| `components/plan/week-grid.tsx` | Visual cue card arancione |
| `app/settings/profile/page.tsx` | Form date-picker inizio/fine |

**File NON toccati:** session-selector, mesocycle, phase-detector, redistribute — già funzionano correttamente con sessioni `blocked_by_user`.

---

## Ordine di esecuzione consigliato

1. Migrazione DB (013)
2. Tipo + whitelist (dossier.ts)
3. Helper injury.ts + self-check
4. Route generate (blocco sessioni)
5. week-grid (visual)
6. Form settings

Ogni step è autonomo e testabile prima del successivo.
