/**
 * Session selector (Section 11 B §3-§4 + WORKOUT_REFERENCE.md §3/§5) —
 * funzione PURA e deterministica: stessi input → stessa settimana.
 *
 * Decide QUALI sedute mettere e in QUALI giorni, rispettando le regole ferme:
 *  - max 2 sedute dure/sett (amatoriale ≤10h), 3 se >10h;               (§4)
 *  - spacing minimo 48h tra sedute dure (≥1 giorno facile in mezzo);     (§3.1)
 *  - 1 lungo di durabilità, di norma nel weekend;                        (§3.3)
 *  - readiness MODIFY → solo SS-4/AE-7 come "dura"; SKIP → niente dura.  (spec D)
 *
 * Ogni `library_id` proviene dal catalogo reale (workout-library.ts). La
 * selezione del template specifico segue la decision matrix §5.1 + i
 * limitatori della gap analysis. Nessuna AI, nessun numero inventato.
 */

import { getTemplate, type WorkoutTemplate } from "@/lib/planner/workout-library";
import type { Phase } from "@/lib/planner/phase-detector";

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const WEEKEND: DayKey[] = ["sat", "sun"];

export type SessionSlot =
  | "primary_hard"
  | "secondary_hard"
  | "third_hard"
  | "long_ride"
  | "opener"
  | "easy"
  | "recovery"
  | "rest";

export interface SelectedSession {
  day: DayKey;
  /** null = giorno di riposo. Altrimenti un id REALE della Workout Library. */
  library_id: string | null;
  is_hard: boolean;
  slot: SessionSlot;
  adapted_duration_min: number | null;
  target_zone: string | null;
  rationale: string;
}

/** Sottoinsieme del dossier che serve al planner (§12.2). */
export interface PlannerDossier {
  disponibilita_ore_sett: number | null;
  giorni_preferiti: string[];
  giorni_impossibili: string[];
  durata_max_weekday_min: number | null;
  durata_max_weekend_min: number | null;
  indoor_outdoor: string | null;
  ha_rulli: boolean | null;
  sport_principali?: string[];
}

/** Readiness di OGGI (l'unica disponibile): si applica al giorno corrente. */
export interface PlannerReadiness {
  decision: "GO" | "MODIFY" | "SKIP";
  /** Giorno della settimana a cui si riferisce, o null se sconosciuto. */
  dayKey: DayKey | null;
  /** TSB odierno (CTL - ATL, letto dal mirror). Null se non disponibile. */
  tsb?: number | null;
  /** Recovery Index odierno (letto dal mirror). Null se non disponibile. */
  ri?: number | null;
}

/** Soglie dell'eccezione "sedute dure consecutive" (WORKOUT_REFERENCE.md §3.1). */
const BACK_TO_BACK_RI_MIN = 0.85;

/**
 * Distanza minima (in giorni) richiesta tra sedute dure. 2 di norma (48h);
 * 1 (consecutive ammesse) solo se TSB > 0 e RI ≥ 0.85 (§3.1, eccezione).
 */
export function effectiveMinGapDays(tsb: number | null, ri: number | null): number {
  return tsb != null && tsb > 0 && ri != null && ri >= BACK_TO_BACK_RI_MIN ? 1 : 2;
}

export interface PlannerLimiters {
  /** training_lever dei limitatori (gap-analysis). */
  levers: string[];
}

const HARD_LIMIT_LOW_HOURS = 10; // ≤10h ⇒ max 2 dure; >10h ⇒ 3

function dayIndex(day: DayKey): number {
  return DAY_KEYS.indexOf(day);
}

/** Giorni allenabili: i preferiti se indicati, altrimenti tutti meno gli impossibili. */
export function computeAvailableDays(dossier: PlannerDossier): DayKey[] {
  const impossible = new Set(dossier.giorni_impossibili ?? []);
  const preferred = (dossier.giorni_preferiti ?? []).filter((d): d is DayKey =>
    (DAY_KEYS as string[]).includes(d)
  );
  const basis = preferred.length > 0 ? preferred : DAY_KEYS;
  return DAY_KEYS.filter((d) => basis.includes(d) && !impossible.has(d));
}

/** Distanza minima in giorni da tutti i giorni "duri" già piazzati (48h ⇒ ≥2). */
function respects48h(day: DayKey, hardDays: DayKey[], minGapDays: number): boolean {
  return hardDays.every((h) => Math.abs(dayIndex(day) - dayIndex(h)) >= minGapDays);
}

/** Primo giorno disponibile tra i candidati che rispetta lo spacing minimo. */
function pickDay(
  candidates: DayKey[],
  available: Set<DayKey>,
  taken: Set<DayKey>,
  hardDays: DayKey[],
  enforce48h: boolean,
  minGapDays = 2
): DayKey | null {
  for (const d of candidates) {
    if (!available.has(d) || taken.has(d)) continue;
    if (enforce48h && !respects48h(d, hardDays, minGapDays)) continue;
    return d;
  }
  return null;
}

// --- Scelta dei template per slot (decision matrix §5.1 + limitatori) --------

interface SlotChoice {
  library_id: string;
  note: string;
}

/** Template della seduta dura PRIMARIA per fase. */
function primaryHardChoice(phase: Phase): SlotChoice {
  switch (phase) {
    case "build":
    case "peak":
      return { library_id: "VO2-1", note: "VO₂max prioritario in build/peak (§5.1)" };
    case "base":
      return { library_id: "SS-1", note: "Sweet spot come dura principale in base (§5.1)" };
    case "taper":
      return { library_id: "MIX-2", note: "Opener pre-gara in taper (§4.3 race-week)" };
    case "recovery":
      return { library_id: "AE-4", note: "Solo recupero in fase recovery (§4.3)" };
  }
}

/** Template della seduta dura SECONDARIA per fase + limitatori. */
function secondaryHardChoice(phase: Phase, lev: Set<string>): SlotChoice {
  if (phase === "recovery" || phase === "taper") {
    return { library_id: "AE-1", note: "Nessuna seconda dura in recovery/taper" };
  }
  if (lev.has("threshold_long") && (phase === "build" || phase === "peak")) {
    return { library_id: "TH-1", note: "Limitatore threshold_long → soglia diretta (§5.1)" };
  }
  if (phase === "peak") {
    return { library_id: "MIX-1", note: "Lavoro race-specific in peak (§5.1)" };
  }
  if (phase === "base") {
    return { library_id: "SS-5", note: "Seconda sweet spot ripetuta in base" };
  }
  // build di default: seconda sweet spot (pairing con eventuale durabilità)
  return { library_id: "SS-1", note: "Seconda strutturata sweet spot in build" };
}

/** Template del lungo per fase + limitatore durabilità. */
function longRideChoice(phase: Phase, lev: Set<string>): SlotChoice {
  if (phase === "recovery") {
    return { library_id: "AE-2", note: "Lungo ridotto (Z2, cap) in recovery (§4.3)" };
  }
  if (lev.has("durability_fatigued") && (phase === "build" || phase === "peak")) {
    return { library_id: "AE-6", note: "Limitatore durabilità → lungo fast-finish (§5.1, occupa slot duro)" };
  }
  return { library_id: "AE-3", note: "Lungo di durabilità settimanale (§4)" };
}

/** Downgrade per giornata MODIFY: una "dura" diventa SS-4 (tempo). */
const MODIFY_DOWNGRADE_ID = "SS-4";
/** AE-6 (lungo duro) in MODIFY scende a AE-3 (toglie il finale Z3). */
const LONG_MODIFY_DOWNGRADE_ID = "AE-3";

// --- Adattamento durata al dossier (§5.4 time-crunch) ------------------------

function capForDay(day: DayKey, dossier: PlannerDossier): number | null {
  const cap = WEEKEND.includes(day)
    ? dossier.durata_max_weekend_min
    : dossier.durata_max_weekday_min;
  return cap != null && cap > 0 ? cap : null;
}

interface Adapted {
  minutes: number;
  truncated: boolean;
}

function adaptDuration(template: WorkoutTemplate, day: DayKey, dossier: PlannerDossier): Adapted {
  const est = template.est_total_minutes;
  const cap = capForDay(day, dossier);
  if (cap != null && est > cap) {
    return { minutes: cap, truncated: true };
  }
  return { minutes: est, truncated: false };
}

/** Nota di fattibilità indoor (no rulli + lungo) — non cambia i minuti. */
function indoorNote(template: WorkoutTemplate, dossier: PlannerDossier): string | null {
  if (
    dossier.indoor_outdoor === "indoor" &&
    dossier.ha_rulli === false &&
    template.domain === "endurance" &&
    template.est_total_minutes >= 120
  ) {
    return "Senza rulli un lungo indoor non è fattibile: da svolgere outdoor.";
  }
  return null;
}

/** Costruisce la SelectedSession a partire dal template scelto. */
function buildSession(
  day: DayKey,
  libraryId: string,
  slot: SessionSlot,
  baseNote: string,
  dossier: PlannerDossier,
  extraNotes: string[]
): SelectedSession {
  const template = getTemplate(libraryId);
  if (!template) {
    // Difesa: non deve mai accadere (id dal catalogo). Giorno di riposo.
    return {
      day,
      library_id: null,
      is_hard: false,
      slot: "rest",
      adapted_duration_min: null,
      target_zone: null,
      rationale: `Template ${libraryId} assente in libreria: riposo precauzionale.`,
    };
  }
  const { minutes, truncated } = adaptDuration(template, day, dossier);
  const notes = [baseNote, ...extraNotes];
  if (truncated) {
    notes.push(
      `Durata adattata a ${minutes}′ (max del giorno): applicate regole time-crunch §5.4 (taglia CD, poi WU, poi n. intervalli).`
    );
  }
  const indoor = indoorNote(template, dossier);
  if (indoor) notes.push(indoor);

  return {
    day,
    library_id: libraryId,
    is_hard: template.is_hard_session,
    slot,
    adapted_duration_min: minutes,
    target_zone: template.power_target_zone,
    rationale: notes.filter(Boolean).join(" "),
  };
}

// --- selectWeekSessions ------------------------------------------------------

/**
 * Compone la settimana. Ritorna 7 voci (lun→dom): le sedute assegnate più i
 * giorni di riposo (library_id null), così la griglia è completa e la
 * validazione può contare hard/spacing su tutta la settimana.
 */
export function selectWeekSessions(
  phase: Phase,
  dossier: PlannerDossier,
  readiness: PlannerReadiness,
  gapAnalysis: PlannerLimiters | null,
  availableDays: DayKey[]
): SelectedSession[] {
  const available = new Set(availableDays);
  const lev = new Set(gapAnalysis?.levers ?? []);
  const maxHard =
    (dossier.disponibilita_ore_sett ?? 0) > HARD_LIMIT_LOW_HOURS ? 3 : 2;
  const minGapDays = effectiveMinGapDays(readiness.tsb ?? null, readiness.ri ?? null);

  // readiness si applica solo al giorno indicato (oggi).
  const readinessDay = readiness.dayKey;
  const isReadinessDay = (d: DayKey) => readinessDay != null && d === readinessDay;

  const sessions = new Map<DayKey, SelectedSession>();
  const hardDays: DayKey[] = [];
  const taken = new Set<DayKey>();

  // recovery/taper: niente sedute dure strutturate, settimana leggera.
  const allowStructuredHard = phase !== "recovery" && phase !== "taper";

  // 1) Lungo (di norma weekend). In taper niente lungo.
  let longRideDay: DayKey | null = null;
  if (phase !== "taper") {
    const longChoice = longRideChoice(phase, lev);
    const longTemplate = getTemplate(longChoice.library_id);
    const longIsHard = longTemplate?.is_hard_session ?? false;
    longRideDay =
      pickDay(["sat", "sun"], available, taken, hardDays, false) ??
      // nessun weekend disponibile: ultimo giorno disponibile della settimana
      [...DAY_KEYS].reverse().find((d) => available.has(d)) ??
      null;

    if (longRideDay) {
      let libId = longChoice.library_id;
      const extra: string[] = [];
      // Se il lungo è "duro" (AE-6) e oggi è MODIFY → declassa a AE-3.
      if (longIsHard && isReadinessDay(longRideDay) && readiness.decision === "MODIFY") {
        libId = LONG_MODIFY_DOWNGRADE_ID;
        extra.push("Readiness MODIFY oggi: lungo fast-finish declassato a Z2 puro.");
      }
      if (longIsHard && isReadinessDay(longRideDay) && readiness.decision === "SKIP") {
        libId = "AE-4";
        extra.push("Readiness SKIP oggi: lungo sostituito da recupero attivo.");
      }
      const finalTemplate = getTemplate(libId);
      const session = buildSession(
        longRideDay,
        libId,
        "long_ride",
        `Fase ${phase}. Lungo settimanale. ${longChoice.note}.`,
        dossier,
        extra
      );
      sessions.set(longRideDay, session);
      taken.add(longRideDay);
      if (finalTemplate?.is_hard_session) hardDays.push(longRideDay);
    }
  }

  // 2) Quante dure strutturate restano da piazzare.
  const longConsumesHardSlot = longRideDay != null && hardDays.includes(longRideDay);
  const structuredBudget = allowStructuredHard
    ? Math.max(0, maxHard - (longConsumesHardSlot ? 1 : 0))
    : 0;
  const structuredTarget = Math.min(structuredBudget, maxHard >= 3 ? 3 : 2);

  const hardSlotPlan: Array<{ slot: SessionSlot; choice: SlotChoice }> = [];
  if (structuredTarget >= 1) {
    hardSlotPlan.push({ slot: "primary_hard", choice: primaryHardChoice(phase) });
  }
  if (structuredTarget >= 2) {
    hardSlotPlan.push({ slot: "secondary_hard", choice: secondaryHardChoice(phase, lev) });
  }
  if (structuredTarget >= 3) {
    // Terza dura solo con disponibilità alta: tempo sostenuto, basso costo.
    hardSlotPlan.push({ slot: "third_hard", choice: { library_id: "SS-4", note: "Terza strutturata (volume tempo) — disponibilità alta" } });
  }

  // 3) Piazza le dure: primaria su Mar/Mer/Lun, secondaria su Gio/Ven, ecc.
  const primaryCandidates: DayKey[] = ["tue", "wed", "mon"];
  const secondaryCandidates: DayKey[] = ["thu", "fri", "wed", "tue"];
  const thirdCandidates: DayKey[] = ["wed", "fri", "thu", "mon"];

  for (const { slot, choice } of hardSlotPlan) {
    const candidates =
      slot === "primary_hard"
        ? primaryCandidates
        : slot === "secondary_hard"
          ? secondaryCandidates
          : thirdCandidates;
    const day = pickDay(candidates, available, taken, hardDays, true, minGapDays);
    if (!day) continue; // niente slot valido che rispetti il gap minimo: si salta

    let libId = choice.library_id;
    const extra: string[] = [];
    if (minGapDays === 1 && hardDays.some((h) => Math.abs(dayIndex(day) - dayIndex(h)) === 1)) {
      extra.push(
        "Sedute dure consecutive ammesse: TSB>0 e RI≥0.85 (§3.1, eccezione al gap 48h)."
      );
    }
    // Readiness del giorno: MODIFY → SS-4; SKIP → recupero (niente dura).
    if (isReadinessDay(day) && readiness.decision === "MODIFY") {
      libId = MODIFY_DOWNGRADE_ID;
      extra.push("Readiness MODIFY oggi: dura declassata a tempo (SS-4/AE-7, §5.1).");
    } else if (isReadinessDay(day) && readiness.decision === "SKIP") {
      const session = buildSession(
        day,
        "AE-4",
        "recovery",
        `Fase ${phase}. Readiness SKIP oggi: niente seduta dura, recupero attivo.`,
        dossier,
        []
      );
      sessions.set(day, session);
      taken.add(day);
      continue;
    }

    const finalTemplate = getTemplate(libId);
    const session = buildSession(
      day,
      libId,
      slot,
      `Fase ${phase}. Seduta dura ${slot === "primary_hard" ? "primaria" : slot === "secondary_hard" ? "secondaria" : "aggiuntiva"}. ${choice.note}.`,
      dossier,
      extra
    );
    sessions.set(day, session);
    taken.add(day);
    if (finalTemplate?.is_hard_session) hardDays.push(day);
  }

  // 4) Taper: un opener leggero (MIX-2) sul primo giorno disponibile infrasett.
  if (phase === "taper") {
    const openerDay = pickDay(["wed", "thu", "fri", "tue"], available, taken, [], false);
    if (openerDay) {
      const session = buildSession(
        openerDay,
        "MIX-2",
        "opener",
        "Fase taper: opener di attivazione pre-gara (§4.3 race-week), senza fatica.",
        dossier,
        []
      );
      sessions.set(openerDay, session);
      taken.add(openerDay);
    }
  }

  // 5) Riempi i giorni rimanenti: AE-4 il giorno dopo una dura, altrimenti AE-1.
  //    In recovery tutto Z1–Z2 (AE-4/AE-1). Giorni non disponibili → riposo.
  for (const day of DAY_KEYS) {
    if (sessions.has(day)) continue;
    if (!available.has(day)) {
      sessions.set(day, {
        day,
        library_id: null,
        is_hard: false,
        slot: "rest",
        adapted_duration_min: null,
        target_zone: null,
        rationale: "Giorno non disponibile (dal dossier): riposo.",
      });
      continue;
    }
    const prevIdx = dayIndex(day) - 1;
    const prevDay = prevIdx >= 0 ? DAY_KEYS[prevIdx] : null;
    const afterHard = prevDay != null && hardDays.includes(prevDay);
    const easyId = phase === "recovery" ? "AE-4" : afterHard ? "AE-4" : "AE-1";
    const slot: SessionSlot = easyId === "AE-4" ? "recovery" : "easy";
    const note =
      phase === "recovery"
        ? "Fase recovery: solo Z1–Z2."
        : afterHard
          ? "Recupero attivo dopo la seduta dura del giorno prima (§3.1)."
          : "Mantenimento aerobico facile.";
    sessions.set(day, buildSession(day, easyId, slot, note, dossier, []));
  }

  return DAY_KEYS.map((d) => sessions.get(d)!);
}

/** Conta le sedute dure della settimana (per audit/validazione §4). */
export function countHardSessions(sessions: SelectedSession[]): number {
  return sessions.filter((s) => s.is_hard).length;
}

/** true se le sedute dure rispettano il gap minimo (§3.1, 48h salvo eccezione). */
export function hardSpacingOk(sessions: SelectedSession[], minGapDays = 2): boolean {
  const hardIdx = sessions
    .filter((s) => s.is_hard)
    .map((s) => DAY_KEYS.indexOf(s.day))
    .sort((a, b) => a - b);
  for (let i = 1; i < hardIdx.length; i++) {
    if (hardIdx[i] - hardIdx[i - 1] < minGapDays) return false;
  }
  return true;
}
