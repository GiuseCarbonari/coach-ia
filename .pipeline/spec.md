# Implementation Plan: AI Comments for Coach IA

## ARCHITECTURE OVERVIEW

**Lazy principle applied:** Reuse existing patterns (Anthropic provider abstraction, Section 11 mirror JSON, pre-computed data) and extend with minimal new code. Three sections share one route structure: read pre-calculated data → build context → call LLM → persist comment.

**Current architecture baseline:**
- Scheda OGGI (dashboard/page.tsx): readiness, wellness metrics, today's session
- Scheda PROFILO (profile/page.tsx): profile_data (CP/W′, RPP, fenotipo), ai_comment col
- Analisi Percorso (terrain/page.tsx): gap_analysis, race_estimate
- LLM provider pattern: `lib/ai/provider.ts` (Anthropic) → extend to support Groq

---

## 1. DATABASE SCHEMA CHANGES

**Add three comment columns to `athlete_profiles` (Migration 017):**

```sql
ALTER TABLE public.athlete_profiles
  ADD COLUMN IF NOT EXISTS ai_comment_oggi text,
  ADD COLUMN IF NOT EXISTS ai_comment_oggi_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_comment_profilo text,
  ADD COLUMN IF NOT EXISTS ai_comment_profilo_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_comment_percorso text,
  ADD COLUMN IF NOT EXISTS ai_comment_percorso_at timestamptz;

COMMENT ON COLUMN public.athlete_profiles.ai_comment_oggi IS 
  'AI comment for OGGI section: readiness, how to approach session, metrics, trends';
COMMENT ON COLUMN public.athlete_profiles.ai_comment_profilo IS 
  'AI comment for PROFILO section: phenotype, 14-day variation trends';
COMMENT ON COLUMN public.athlete_profiles.ai_comment_percorso IS 
  'AI comment for ANALISI PERCORSO section: altimetry analysis, nutrition strategy, pacing, recovery';
```

---

## 2. LLM PROVIDER ABSTRACTION

**File: `lib/ai/groq-provider.ts` (NEW)**

Support Groq alongside existing Anthropic. Factory pattern to switch by env var.

```typescript
export interface AICommentInput {
  section: 'oggi' | 'profilo' | 'percorso';
  payload: Record<string, unknown>;
}

export interface AICommentOutput {
  comment: string;
  tokens_used: { prompt: number; completion: number };
}

/**
 * Switch between Anthropic (default) and Groq based on env:
 * COACH_AI_PROVIDER=groq → uses Groq, else Anthropic
 */
export async function generateComment(input: AICommentInput): Promise<AICommentOutput> {
  const provider = process.env.COACH_AI_PROVIDER || 'anthropic';
  if (provider === 'groq') {
    return generateCommentGroq(input);
  }
  return generateCommentAnthropic(input);
}

async function generateCommentGroq(input: AICommentInput): Promise<AICommentOutput> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');
  
  const groq = new Groq({ apiKey });
  const { prompt, systemPrompt } = buildPrompt(input);
  
  const response = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    max_tokens: 300, // ponytail: tight budget, comments ≤150 words
    messages: [{ role: 'user', content: prompt }],
    system: systemPrompt,
  });

  return {
    comment: response.choices[0]?.message?.content || '',
    tokens_used: {
      prompt: response.usage?.prompt_tokens || 0,
      completion: response.usage?.completion_tokens || 0,
    },
  };
}
```

---

## 3. THREE COMMENT ROUTES

### 3A. OGGI Route

**File: `app/api/comments/oggi/route.ts` (NEW)**

Input: User ID, extract from mirror JSON + daily session + injury status
Output: 3-4 sentence comment on readiness, how to approach today, metrics reading

```typescript
/**
 * POST /api/comments/oggi
 * 
 * Scheda OGGI: readiness panorama, how to approach session, metrics reading,
 * 14-day trend interpretation. Special: if injured today, only medical 
 * prescriptions, no workout proposals.
 */

export async function POST(request: Request) {
  const { userId } = await request.json();
  
  // 1. Read data
  const [profile, snapshot, plan] = await Promise.all([
    getAthleteProfile(userId),
    getLatestMirror(userId),      // latest.json equivalent
    getWeeklyPlan(userId),
  ]);
  
  const today = dateToISO();
  const injuredToday = isInjured(today, profile.injury_periods);
  const todaySession = plan?.sessions.find(s => s.date === today);
  
  // 2. Build prompt payload
  const payload = {
    name: profile.nome,
    date: today,
    injured: injuredToday,
    readiness: snapshot.readiness_today,
    ctl: snapshot.wellness_30d[-1]?.ctl,
    atl: snapshot.wellness_30d[-1]?.atl,
    tsb: snapshot.ctl - snapshot.atl,
    acwr: snapshot.atl / snapshot.ctl,
    hrv: snapshot.wellness_30d[-1]?.rmssd,
    rhr: snapshot.wellness_30d[-1]?.restingHR,
    sleep: snapshot.wellness_30d[-1]?.sleep_hours,
    trend_ctl_14d: getTrend(snapshot.wellness_30d, 'ctl', 14),
    trend_atl_14d: getTrend(snapshot.wellness_30d, 'atl', 14),
    trend_hrv_14d: getTrend(snapshot.wellness_30d, 'rmssd', 14),
    session_today: todaySession ? {
      title: todaySession.title,
      duration: todaySession.estimated_duration_min,
      is_hard: todaySession.is_hard,
      target_zone: todaySession.power_target_zone,
    } : null,
  };
  
  // 3. Generate comment
  const comment = await generateComment({
    section: 'oggi',
    payload,
  });
  
  // 4. Persist
  await updateProfileComment(userId, 'oggi', comment.comment);
  
  return { comment: comment.comment, tokens: comment.tokens_used };
}
```

**Prompt template for OGGI section:**
```
Sei un coach ciclismo esperto. Analizza lo stato dell'atleta OGGI e dai 3-4 consigli pratici.

STATO ODIERNO:
- Readiness: {readiness.decision} ({readiness.reason})
- Forma (CTL): {ctl:.1f} (trend 14gg: {trend_ctl_14d})
- Fatica (ATL): {atl:.1f} (trend 14gg: {trend_atl_14d})
- Freschezza (TSB): {tsb:.1f}
- HRV: {hrv:.0f} (trend 14gg: {trend_hrv_14d})
- RHR: {rhr:.0f} bpm
- Sonno: {sleep:.1f} h

{injured ? "⚠️ INFORTUNIO ATTIVO: Non proporre allenamenti. Consiglia solo programma di recupero medico." : ""}

SEDUTA PREVISTA:
{session_today ? f"- {session_today.title} ({session_today.duration} min, {session_today.target_zone})" : "- Nessuna seduta"}

Commenta:
1. Lo stato di readiness e freschezza (forma, fatica, sonno);
2. Se infortunato: solo prudenza e rispetto programma medico;
3. Consiglio specifico per la seduta odierna;
4. Cosa monitorare durante l'allenamento.

Tono: incoraggiante, pratico. Italiano. Max 150 parole.
```

### 3B. PROFILO Route

**File: `app/api/comments/profilo/route.ts` (NEW)**

Input: profile_data (fenotipo, CP/W′, RPP current/best, gap analysis)
Output: Comments on phenotype, 14-day power curve trends

```typescript
/**
 * POST /api/comments/profilo
 * 
 * Scheda PROFILO: phenotype comment, power profile interpretation,
 * 14-day variation trends (RPP current vs best 1y, CP stability).
 */

export async function POST(request: Request) {
  const { userId } = await request.json();
  
  const [profile, activities] = await Promise.all([
    getProfileData(userId),
    getActivities(userId, 14), // last 14 days
  ]);
  
  // Extract current and best RPP (already pre-computed in profile_data)
  const rppCurrent = profile.profile_data?.rpp_current || [];
  const rppBest = profile.profile_data?.rpp_best_1y || [];
  const cpw = profile.profile_data?.cp_wprime || null;
  const fenotipo = profile.profile_data?.fenotipo || null;
  
  // Compute trend: compare RPP points between current and best
  const rppTrend = compareRPPTrends(rppCurrent, rppBest);
  
  const payload = {
    name: profile.nome,
    fenotipo,
    cp_wprime: cpw,
    rpp_current: rppCurrent,
    rpp_best: rppBest,
    rpp_trend_14d: rppTrend,
    weight_kg: profile.profile_data?.weight_kg,
    activities_14d_count: activities.length,
  };
  
  const comment = await generateComment({
    section: 'profilo',
    payload,
  });
  
  await updateProfileComment(userId, 'profilo', comment.comment);
  return { comment: comment.comment, tokens: comment.tokens_used };
}
```

**Prompt template for PROFILO section:**
```
Sei un coach. Commenta il profilo di potenza dell'atleta (fenotipo, CP/W′, RPP trend).

FENOTIPO:
- Tipo: {fenotipo.primary} (confidence: {fenotipo.confidence})
- Sottotipo: {fenotipo.secondary}
- Flatness: {fenotipo.flatness}
- APR ratio: {fenotipo.apr_ratio}

CRITICAL POWER & W′:
- CP: {cp_wprime.cp_w} W ({cp_wprime.cp_wkg} W/kg)
- W′: {cp_wprime.w_prime_kj} kJ

RPP TREND (ultimi 14 giorni vs best 1 anno):
{rpp_trend_14d.map(d => f"- {d.duration}: {d.current_w}W (best: {d.best_w}W, {d.delta:+.0f}%)")}

Commenta:
1. Qual è il fenotipo e cosa significa (aerobico vs esplosivo);
2. Punti forti e limitatori rispetto alla CP;
3. Trend RPP (migliora, degrada, stabile nei 14gg);
4. Consigli brevi su cosa allenare se trend negativo.

Tono: incoraggiante, non allarmistico se i dati sono parziali.
Max 150 parole, italiano.
```

### 3C. PERCORSO Route

**File: `app/api/comments/percorso/route.ts` (NEW)**

Input: gap_analysis + race_estimate + altimetry + fenotipo
Output: Altitude analysis, nutrition strategy in race, pacing recommendations, recovery

```typescript
/**
 * POST /api/comments/percorso
 * 
 * ANALISI PERCORSO: altitude profile analysis, nutrition strategy recommendations,
 * pacing based on fenotipo, recovery plan. 
 * Reads race_estimate (already computed), gap_analysis, and target event terrain.
 */

export async function POST(request: Request) {
  const { userId } = await request.json();
  
  const [profile, activities] = await Promise.all([
    getProfileData(userId),
    getActivities(userId),
  ]);
  
  const gapAnalysis = profile.gap_analysis || null;
  const raceEstimate = profile.race_estimate || null;
  const eventTerrain = profile.event_terrain || null;
  const fenotipo = profile.profile_data?.fenotipo || null;
  
  const payload = {
    name: profile.nome,
    event: profile.gare_target?.[0], // first target event
    event_terrain: eventTerrain,
    gap_analysis: gapAnalysis,
    race_estimate: raceEstimate,
    fenotipo,
    cpw: profile.profile_data?.cp_wprime,
  };
  
  const comment = await generateComment({
    section: 'percorso',
    payload,
  });
  
  await updateProfileComment(userId, 'percorso', comment.comment);
  return { comment: comment.comment, tokens: comment.tokens_used };
}
```

**Prompt template for PERCORSO section:**
```
Sei un coach. Analizza la gara target e dai consigli su altimetria, nutrizione e pacing.

GARA:
- Nome: {event.name}
- Distanza: {event_terrain.distance_km} km
- D+: {event_terrain.elevation_m} m

ALTIMETRIA ANALIZZATA:
{event_terrain.climbs.map(c => f"- {c.position_km}km: {c.distance_km}km @ {c.avg_gradient_pct}% ({c.category})")}

FENOTIPO ATLETA:
- Tipo: {fenotipo.primary}
- CP: {cpw.cp_wkg} W/kg
- Gap vs percorso: {gap_analysis.limiters}

STIMA PERFORMANCE:
- Tempo previsto: {race_estimate.time_estimate}
- Difficoltà relativa: {race_estimate.difficulty}

Commenta:
1. Analisi altimetria: dove sarà impegnativo, come affrontarlo;
2. Strategia nutrizionale (carboidrati, energia, idratazione per durata);
3. Pacing: dove spingere in base a fenotipo, dove risparmiare;
4. Piano di recupero post-gara (durata sonno, nutrizione, dias di riposo).

Tono: motivante, concreto. Max 200 parole, italiano.
```

---

## 4. FRONTEND DISPLAY

**Scheda OGGI** (dashboard/page.tsx):
- New component: `<CoachCommentToday />` 
- Fetch from DB: `ai_comment_oggi`, `ai_comment_oggi_at`
- Show in new card below readiness ring
- CTA button to regenerate (POST /api/comments/oggi)

**Scheda PROFILO** (profile/page.tsx):
- New component: `<CoachCommentProfilo />`
- Display in ProfileTabs component
- Show timestamp, regenerate button

**Analisi PERCORSO** (terrain/page.tsx):
- New component: `<CoachCommentPercorso />`
- Display below gap analysis card
- Show timestamp, regenerate button

All three components follow this pattern:
```tsx
function CoachComment({ 
  section, 
  comment, 
  updatedAt, 
  onRegenerate 
}: {
  section: 'oggi' | 'profilo' | 'percorso';
  comment: string | null;
  updatedAt: string | null;
  onRegenerate: () => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Commento Coach IA</CardTitle>
        <CardDescription>
          {updatedAt ? `Aggiornato ${formatDate(updatedAt)}` : 'Non ancora generato'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed">{comment}</p>
      </CardContent>
      <CardFooter>
        <Button onClick={onRegenerate} size="sm" variant="outline">
          Rigenera
        </Button>
      </CardFooter>
    </Card>
  );
}
```

---

## 5. DEPENDENCY MAPPING & DATA FLOW

| Section | Depends On | Source | Edge Cases |
|---------|-----------|--------|-----------|
| **OGGI** | readiness_today, wellness_30d, sessions, injury_periods | mirror JSON + weekly_plans + athlete_profiles | No data: show "Dati insufficienti"; Injured: skip workout advice |
| **PROFILO** | profile_data (RPP, CP/W′), activities_90d | athlete_profiles + activities | Partial RPP (< 3 points): mark unreliable, lower confidence |
| **PERCORSO** | gap_analysis, race_estimate, event_terrain, fenotipo | athlete_profiles (computed columns) | No event: skip section; No terrain: use distance only; No estimate: use gap limiters |

---

## 6. INJURY HANDLING

**Key rule:** If `isInjured(today, injury_periods) === true` in OGGI section:
- Prompt explicitly states: "⚠️ INFORTUNIO ATTIVO: Non proporre allenamenti"
- LLM must NOT suggest workout modifications or intensity
- Output focuses only on recovery prescriptions (rest, passive mobility, when to resume)
- Medical supervision note added

**Implementation:**
```typescript
// In OGGI prompt building
const prompt = injuredToday
  ? `⚠️ INFORTUNIO ATTIVO: ${getInjuryNote(profile.infortuni_attuali)}
     Consulta il programma medico. Non proporre allenamenti.`
  : `Seduta prevista: ${session?.title || 'nessuna'}`;
```

---

## 7. GROQ INTEGRATION CHECKLIST

- [ ] Add `GROQ_API_KEY` to `.env.local` and env secrets
- [ ] Add `COACH_AI_PROVIDER=groq` to select provider (default: anthropic)
- [ ] Model: `openai/gpt-oss-120b`
- [ ] Max tokens per comment: 300 (tight budget → ≤150 words output)
- [ ] Cost estimate: 3 comments/user × 300 tokens × 0.0001 $/token ≈ $0.0001/user/generation
- [ ] Rate limit: 1 generation per section per user per day (avoid token waste)

---

## 8. OPEN QUESTIONS & UNKNOWNS

**NONE** — All critical dependencies confirmed:

1. ✅ **Fenotipo field location:** Confirmed at `profile_data.fenotipo` with fields `primary, secondary, confidence, flatness, punch_ratio, apr_ratio`.

2. ✅ **Readiness calculation:** Pre-computed in mirror JSON as `readiness_today: { decision, reason, confidence }`. App reads only, does NOT recalculate.

3. ✅ **14-day metrics retrieval:** `mirror.wellness_30d[-14:]` array of { date, ctl, atl, hrv, rhr, sleep, ... }. Compute trend as linear regression or simple delta (oldest vs newest). Ponytail: use simple delta.

4. ✅ **Injury active identification:** Already modeled in M10 (`athlete_profiles.injury_periods` array of {start, end, note}). Helper `isInjured(dateISO, periods)` exists.

5. ✅ **Altitude retrieval:** Pre-computed in `profile.event_terrain` (from `gap-analysis` route). Structure: `{ distance_km, elevation_m, climbs: [{ position_km, distance_km, elevation_m, avg_gradient_pct, max_gradient_pct, category }], polyline }`.

6. ✅ **Fenotipo computation:** Pre-computed in `profile.py` (Section 11 profile module), stored in `athlete_profiles.profile_data.fenotipo`. Should NOT be recomputed by LLM.

7. ✅ **Account without data:** Show degraded comments (e.g., "Dati insufficienti, collegati a Intervals o registra attività"). Use data_quality_level from mirror to inform comment tone.

8. ✅ **Route without altitude:** If `event_terrain` is null or no climbs, PERCORSO comment adapts to distance + estimated difficulty (no altimetry detail).

---

## 9. EDGE CASES & MITIGATIONS

| Edge Case | Mitigation |
|-----------|-----------|
| **No mirror data** | Comment = "Dati insufficienti"; show placeholder; user gets onboarded |
| **No profile_data** | Skip PROFILO section or show "Profilo non ancora calcolato" |
| **No event or race_estimate** | Skip PERCORSO or show "Nessuna gara target" |
| **Injured in past 14d but not today** | Show normal OGGI comment; PROFILO mentions recovery trend |
| **LLM hallucinates numbers** | System prompt forbids invention; validator checks output regex `[0-9]{3,4}W` not in comment |
| **Token budget exceeded** | Use smaller model or cache comments longer; alert on Sentry |
| **Groq API down** | Graceful degrade: show last cached comment + timestamp "da ieri" |

---

## 10. VALIDATION & SAFETY

**Post-generation validation:**
```typescript
function validateComment(comment: string, section: string): boolean {
  // 1. Must not invent wattages
  if (/\b[0-9]{3,4}\s*W\b/.test(comment) && section !== 'profilo') 
    return false; // profilo OK to cite CP/W′
  
  // 2. Must not prescribe tests without readiness checks
  if (section === 'oggi' && /test FTP|test di sforzo/.test(comment)) 
    return false; // only readiness=verde
  
  // 3. Injured: must not mention "fai", "allenati", "seduta"
  if (injuredToday && /fai|allenati|seduta|intervalli|ripetute/.test(comment))
    return false;
  
  // 4. Word count
  const words = comment.trim().split(/\s+/).length;
  if (words > 200) return false; // budget exceeded
  
  return true;
}
```

If validation fails: regenerate or fallback to template.

---

## 11. DATABASE QUERIES

**Read latest comment:**
```typescript
async function getLatestComment(userId: string, section: 'oggi' | 'profilo' | 'percorso') {
  const col = `ai_comment_${section}`;
  const colAt = `ai_comment_${section}_at`;
  const { data } = await supabase
    .from('athlete_profiles')
    .select(col, colAt)
    .eq('user_id', userId)
    .maybeSingle();
  return { comment: data?.[col], updatedAt: data?.[colAt] };
}
```

**Update comment + timestamp:**
```typescript
async function updateComment(userId: string, section: string, comment: string) {
  const col = `ai_comment_${section}`;
  const colAt = `ai_comment_${section}_at`;
  return supabase
    .from('athlete_profiles')
    .update({ [col]: comment, [colAt]: new Date().toISOString() })
    .eq('user_id', userId);
}
```

---

## 12. IMPLEMENTATION ORDER (Ponytail: shortest path first)

1. **Migration 017** — Add three comment columns
2. **lib/ai/groq-provider.ts** — LLM provider abstraction (reuse existing pattern)
3. **app/api/comments/oggi/route.ts** — OGGI endpoint (most critical path: dashboard)
4. **Dashboard component** — Display OGGI comment (frontend validation point)
5. **app/api/comments/profilo/route.ts** — PROFILO endpoint
6. **Profile component** — Display PROFILO comment
7. **app/api/comments/percorso/route.ts** — PERCORSO endpoint
8. **Terrain component** — Display PERCORSO comment
9. **Validation + error handling** — Across all three
10. **Cache policy** — 24h TTL on comments (avoid regeneration spam)

---

## CRITICAL FILES FOR IMPLEMENTATION

- /c/Users/CARBO/Documents/coach-ia/supabase/migrations/017_ai_comments.sql (NEW)
- /c/Users/CARBO/Documents/coach-ia/lib/ai/groq-provider.ts (NEW)
- /c/Users/CARBO/Documents/coach-ia/app/api/comments/oggi/route.ts (NEW)
- /c/Users/CARBO/Documents/coach-ia/app/api/comments/profilo/route.ts (NEW)
- /c/Users/CARBO/Documents/coach-ia/app/api/comments/percorso/route.ts (NEW)
- /c/Users/CARBO/Documents/coach-ia/components/dashboard/coach-comment-oggi.tsx (NEW)
- /c/Users/CARBO/Documents/coach-ia/components/profile/coach-comment-profilo.tsx (NEW)
- /c/Users/CARBO/Documents/coach-ia/components/terrain/coach-comment-percorso.tsx (NEW)
- /c/Users/CARBO/Documents/coach-ia/app/dashboard/page.tsx (modify to include comment)
- /c/Users/CARBO/Documents/coach-ia/app/profile/page.tsx (modify to include comment)
- /c/Users/CARBO/Documents/coach-ia/app/terrain/page.tsx (modify to include comment)
