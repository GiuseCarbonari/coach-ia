import assert from "node:assert/strict";
import { test } from "node:test";

import { buildWeek } from "../lib/planner/build-week";
import { detectPhase } from "../lib/planner/phase-detector";
import { redistributeWeek } from "../lib/planner/redistribute";
import {
  computeAvailableDays,
  countHardSessions,
  effectiveMinGapDays,
  hardSpacingOk,
  selectWeekSessions,
  type PlannerDossier,
} from "../lib/planner/session-selector";
import { VALID_LIBRARY_IDS } from "../lib/planner/workout-library";

/**
 * Test del planner settimanale (M6, Section 11 B). Verificano le REGOLE FERME:
 * no sedute dure back-to-back (spacing 48h), tetto sedute dure, e che ogni
 * library_id usato esista nella Workout Library reale. Più i casi di fase.
 */

const DOSSIER: PlannerDossier = {
  disponibilita_ore_sett: 8, // ≤10h ⇒ max 2 dure
  giorni_preferiti: [],
  giorni_impossibili: ["mon"],
  durata_max_weekday_min: 90,
  durata_max_weekend_min: 240,
  indoor_outdoor: "outdoor",
  ha_rulli: true,
};

const GO = { decision: "GO" as const, dayKey: null };

test("detectPhase: recovery quando ACWR > 1.5 (safety gate)", () => {
  const r = detectPhase(50, [48, 49, 50], 100, 1.6, 0.8);
  assert.equal(r.phase, "recovery");
});

test("detectPhase: recovery quando RI < 0.6", () => {
  const r = detectPhase(50, [50, 50], 100, 1.0, 0.5);
  assert.equal(r.phase, "recovery");
});

test("detectPhase: taper se evento < 14 giorni", () => {
  assert.equal(detectPhase(50, [50], 10, 1.0, 0.9).phase, "taper");
});

test("detectPhase: peak se evento 14–42 giorni", () => {
  assert.equal(detectPhase(50, [50], 30, 1.0, 0.9).phase, "peak");
});

test("detectPhase: build se ACWR 0.9–1.3 e nessun evento ravvicinato", () => {
  assert.equal(detectPhase(50, [45, 50], 100, 1.1, 0.9).phase, "build");
});

test("detectPhase: base se ACWR < 0.9", () => {
  assert.equal(detectPhase(50, [49, 50], null, 0.8, 0.9).phase, "base");
});

test("selectWeekSessions: nessuna seduta dura back-to-back (build)", () => {
  const avail = computeAvailableDays(DOSSIER);
  const sessions = selectWeekSessions("build", DOSSIER, GO, { levers: [] }, avail);
  assert.ok(hardSpacingOk(sessions), "le dure devono distare ≥48h");
});

test("selectWeekSessions: tetto 2 dure con disponibilità ≤10h", () => {
  const avail = computeAvailableDays(DOSSIER);
  const sessions = selectWeekSessions("build", DOSSIER, GO, { levers: [] }, avail);
  assert.ok(countHardSessions(sessions) <= 2, "max 2 dure per amatoriale");
});

test("selectWeekSessions: ogni library_id esiste nella Workout Library", () => {
  for (const phase of ["base", "build", "peak", "taper", "recovery"] as const) {
    const avail = computeAvailableDays(DOSSIER);
    const sessions = selectWeekSessions(phase, DOSSIER, GO, { levers: [] }, avail);
    for (const s of sessions) {
      if (s.library_id != null) {
        assert.ok(
          VALID_LIBRARY_IDS.has(s.library_id),
          `library_id ${s.library_id} (fase ${phase}) non in libreria`
        );
      }
    }
  }
});

test("selectWeekSessions: giorno impossibile resta riposo", () => {
  const avail = computeAvailableDays(DOSSIER);
  const sessions = selectWeekSessions("build", DOSSIER, GO, { levers: [] }, avail);
  const mon = sessions.find((s) => s.day === "mon");
  assert.equal(mon?.library_id, null, "lunedì è impossibile → riposo");
});

test("selectWeekSessions: limitatore durabilità → lungo AE-6 (fast-finish)", () => {
  const avail = computeAvailableDays(DOSSIER);
  const sessions = selectWeekSessions(
    "build",
    DOSSIER,
    GO,
    { levers: ["durability_fatigued"] },
    avail
  );
  const long = sessions.find((s) => s.slot === "long_ride");
  assert.equal(long?.library_id, "AE-6");
  // AE-6 è dura: lo spacing deve comunque reggere.
  assert.ok(hardSpacingOk(sessions));
});

test("selectWeekSessions: readiness MODIFY oggi declassa la dura a SS-4", () => {
  const dossier = { ...DOSSIER, giorni_impossibili: [] };
  const avail = computeAvailableDays(dossier);
  // Martedì = slot dura primaria; forziamo MODIFY su martedì.
  const sessions = selectWeekSessions(
    "build",
    dossier,
    { decision: "MODIFY", dayKey: "tue" },
    { levers: [] },
    avail
  );
  const tue = sessions.find((s) => s.day === "tue");
  assert.equal(tue?.library_id, "SS-4", "MODIFY → SS-4");
});

test("effectiveMinGapDays: eccezione solo con TSB>0 e RI≥0.85 (§3.1)", () => {
  assert.equal(effectiveMinGapDays(5, 0.9), 1, "TSB>0 e RI≥0.85 → gap 1 (consecutive ammesse)");
  assert.equal(effectiveMinGapDays(-1, 0.9), 2, "TSB negativo → resta il gap di 48h");
  assert.equal(effectiveMinGapDays(5, 0.8), 2, "RI sotto soglia → resta il gap di 48h");
  assert.equal(effectiveMinGapDays(null, null), 2, "dati assenti → default prudente 48h");
});

test("selectWeekSessions: senza eccezione la seconda dura non trova spazio a 24h", () => {
  const dossier = { ...DOSSIER, giorni_impossibili: ["mon", "fri", "sat", "sun"] };
  const avail = computeAvailableDays(dossier);
  const sessions = selectWeekSessions("build", dossier, GO, { levers: [] }, avail);
  assert.equal(
    countHardSessions(sessions),
    1,
    "con soli tue/wed/thu disponibili, senza eccezione la seconda dura resta non piazzata"
  );
});

test("selectWeekSessions: TSB>0 e RI≥0.85 ammette due dure consecutive (§3.1 eccezione)", () => {
  const dossier = { ...DOSSIER, giorni_impossibili: ["mon", "fri", "sat", "sun"] };
  const avail = computeAvailableDays(dossier);
  const sessions = selectWeekSessions(
    "build",
    dossier,
    { decision: "GO", dayKey: null, tsb: 5, ri: 0.9 },
    { levers: [] },
    avail
  );
  assert.equal(countHardSessions(sessions), 2, "con l'eccezione la seconda dura viene piazzata anche a 24h");
  assert.ok(hardSpacingOk(sessions, 1), "rispetta il gap minimo di 1 giorno consentito dall'eccezione");
});

test("buildWeek: date coerenti, validation_metadata e durate cappate", () => {
  const avail = computeAvailableDays(DOSSIER);
  const sessions = selectWeekSessions("build", DOSSIER, GO, { levers: [] }, avail);
  const week = buildWeek("2026-06-15", sessions, DOSSIER, null, "build"); // lunedì

  assert.equal(week.sessions.length, 7);
  assert.equal(week.sessions[0].date, "2026-06-15");
  assert.equal(week.sessions[6].date, "2026-06-21");
  assert.equal(week.audit.phase, "build");
  assert.ok(week.audit.hard_spacing_ok);

  // Ogni seduta non-riposo ha validation_metadata con library_id valido e
  // rispetta il cap di durata del giorno.
  for (const s of week.sessions) {
    if (s.rest) continue;
    assert.ok(s.validation_metadata != null);
    assert.ok(VALID_LIBRARY_IDS.has(s.validation_metadata!.library_id));
    const isWeekend = s.day === "sat" || s.day === "sun";
    const cap = isWeekend ? 240 : 90;
    if (s.estimated_duration_min != null) {
      assert.ok(s.estimated_duration_min <= cap, `${s.library_id} supera il cap`);
    }
  }
});

// --- Test redistributeWeek (M9) ─────────────────────────────────────────────

const WEEK_START = "2026-06-15"; // lunedì
const DOSSIER_REDIS: PlannerDossier = {
  disponibilita_ore_sett: 8,
  giorni_preferiti: [],
  giorni_impossibili: [],
  durata_max_weekday_min: 90,
  durata_max_weekend_min: 240,
  indoor_outdoor: "outdoor",
  ha_rulli: false,
};

/** Crea una settimana completa build con cui testare la ridistribuzione. */
function makeBuildWeek() {
  const avail = computeAvailableDays(DOSSIER_REDIS);
  const sessions = selectWeekSessions("build", DOSSIER_REDIS, { decision: "GO", dayKey: null }, { levers: [] }, avail);
  return buildWeek(WEEK_START, sessions, DOSSIER_REDIS, null, "build");
}

type DayKey = import("../lib/planner/session-selector").DayKey;
const DAY_KEYS_T: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function spacing48hOk(hardDays: DayKey[]): boolean {
  const idxs = hardDays.map((d) => DAY_KEYS_T.indexOf(d)).sort((a, b) => a - b);
  for (let i = 1; i < idxs.length; i++) {
    if (idxs[i] - idxs[i - 1] < 2) return false;
  }
  return true;
}

test("redistributeWeek: blocco giorno FACILE → spostato in giorno libero", () => {
  const week = makeBuildWeek();
  const easySession = week.sessions.find((s) => !s.rest && !s.is_hard);
  if (!easySession) return;
  const blockedDay = easySession.day as DayKey;

  const remaining = week.sessions
    .filter((s) => s.day !== blockedDay && !s.rest)
    .map((s) => s.day as DayKey);

  const result = redistributeWeek(
    week.sessions, blockedDay, remaining, DOSSIER_REDIS, "build"
  );

  const blockedResult = result.new_week.find((s) => s.day === blockedDay);
  assert.ok(blockedResult?.rest, "giorno bloccato deve essere riposo");
  assert.ok(result.changes.length > 0, "deve esserci almeno un cambiamento");
});

test("redistributeWeek: blocco giorno DURO con spazio valido → rispetta 48h", () => {
  const week = makeBuildWeek();
  const hardSessions = week.sessions.filter((s) => s.is_hard);
  if (hardSessions.length === 0) return;

  const blocked = hardSessions[0];
  const blockedDay = blocked.day as DayKey;

  const otherHardDays = week.sessions
    .filter((s) => s.is_hard && s.day !== blockedDay)
    .map((s) => s.day as DayKey);

  const remaining = DAY_KEYS_T.filter(
    (d) =>
      d !== blockedDay &&
      !week.sessions.find((s) => s.day === d && s.is_hard) &&
      otherHardDays.every(
        (h) => Math.abs(DAY_KEYS_T.indexOf(d) - DAY_KEYS_T.indexOf(h)) >= 2
      )
  );

  if (remaining.length === 0) return;

  const result = redistributeWeek(
    week.sessions, blockedDay, remaining, DOSSIER_REDIS, "build"
  );

  const resultHardDays = result.new_week.filter((s) => s.is_hard).map((s) => s.day as DayKey);
  assert.ok(spacing48hOk(resultHardDays), "spacing 48h deve essere rispettato nel risultato");
  assert.ok(
    result.new_week.find((s) => s.day === blockedDay)?.rest,
    "il giorno bloccato deve diventare riposo"
  );
});

test("redistributeWeek: settimana piena → volume ridotto, 48h comunque rispettato", () => {
  const week = makeBuildWeek();
  const hardSessions = week.sessions.filter((s) => s.is_hard);
  if (hardSessions.length === 0) return;

  const blockedDay = hardSessions[0].day as DayKey;

  const result = redistributeWeek(
    week.sessions, blockedDay, [], DOSSIER_REDIS, "build"
  );

  assert.ok(result.volume_reduced, "volume_reduced deve essere true");
  assert.ok(
    result.new_week.find((s) => s.day === blockedDay)?.rest,
    "il giorno bloccato deve essere riposo"
  );
  const resultHardDays = result.new_week.filter((s) => s.is_hard).map((s) => s.day as DayKey);
  assert.ok(spacing48hOk(resultHardDays), "48h deve essere rispettato anche dopo la riduzione");
});

test("redistributeWeek: giorno di riposo bloccato → nessun cambiamento", () => {
  const week = makeBuildWeek();
  const restSession = week.sessions.find((s) => s.rest);
  if (!restSession) return;
  const blockedDay = restSession.day as DayKey;

  const result = redistributeWeek(
    week.sessions, blockedDay, [], DOSSIER_REDIS, "build"
  );

  assert.ok(!result.volume_reduced, "nessuna riduzione se il giorno era già riposo");
  assert.equal(result.changes[0]?.action, "kept");
});

test("redistributeWeek: il risultato ha sempre esattamente 7 sessioni", () => {
  const week = makeBuildWeek();
  const anyHard = week.sessions.find((s) => s.is_hard);
  if (!anyHard) return;
  const blockedDay = anyHard.day as DayKey;

  const result = redistributeWeek(
    week.sessions, blockedDay, ["wed", "fri"], DOSSIER_REDIS, "build"
  );

  assert.equal(result.new_week.length, 7, "sempre 7 sessioni (una per giorno)");
});
