import { NextResponse } from "next/server";

import { generateWeekNarrative, isAIConfigured } from "@/lib/ai/provider";
import type { MirrorData } from "@/lib/intervals/sync";
import { buildWeek } from "@/lib/planner/build-week";
import { detectPhase } from "@/lib/planner/phase-detector";
import {
  computeAvailableDays,
  selectWeekSessions,
  type DayKey,
  type PlannerDossier,
} from "@/lib/planner/session-selector";
import type { AthleteProfileData } from "@/lib/profile/build-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/planner/generate — genera la settimana (M6, Section 11 B).
 *
 * Pipeline DETERMINISTICA: legge mirror (CTL/ACWR/RI/readiness), profilo,
 * dossier e gap analysis → detectPhase → selectWeekSessions → buildWeek.
 * Salva il piano in weekly_plans (upsert per settimana) e una riga per seduta
 * in coach_decisions con il validation_metadata Section 11 C. L'AI, se
 * configurata, aggiunge SOLO la narrativa (≤150 parole). Nessun numero inventato.
 */

export const dynamic = "force-dynamic";

/** getDay() (0=Dom..6=Sab) → chiave giorno del planner. */
const JS_DAY_TO_KEY: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Lunedì della settimana corrente, in data locale YYYY-MM-DD. */
function currentMonday(): string {
  const now = new Date();
  const diffToMon = (now.getDay() + 6) % 7; // giorni trascorsi dal lunedì
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMon);
  return monday.toLocaleDateString("en-CA");
}

/** Giorni interi da oggi alla data evento (null se assente/passato). */
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = Date.parse(dateStr);
  if (Number.isNaN(target)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((target - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

interface ProfileRow {
  profile_data: AthleteProfileData | null;
  gap_analysis: { limiters?: Array<{ training_lever?: string }> } | null;
  data_obiettivo: string | null;
  gare_target: Array<{ data?: string }> | null;
  disponibilita_ore_sett: number | null;
  giorni_preferiti: string[] | null;
  giorni_impossibili: string[] | null;
  durata_max_weekday_min: number | null;
  durata_max_weekend_min: number | null;
  indoor_outdoor: string | null;
  ha_rulli: boolean | null;
  sport_principali: string[] | null;
}

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "unauthorized", message: "Non autenticato" },
      { status: 401 }
    );
  }

  // --- Profilo + dossier + gap analysis -------------------------------------
  const { data: profileRow } = await supabase
    .from("athlete_profiles")
    .select(
      "profile_data, gap_analysis, data_obiettivo, gare_target, disponibilita_ore_sett, giorni_preferiti, giorni_impossibili, durata_max_weekday_min, durata_max_weekend_min, indoor_outdoor, ha_rulli, sport_principali"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const row = (profileRow ?? null) as ProfileRow | null;
  const profile = row?.profile_data ?? null;

  // --- Ultimo snapshot: CTL/ACWR/RI/readiness (letti, non ricalcolati) ------
  const { data: snapshot } = await supabase
    .from("athlete_metrics_snapshots")
    .select("id, mirror_data")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const mirror = (snapshot?.mirror_data ?? null) as MirrorData | null;
  if (!mirror) {
    return NextResponse.json(
      {
        success: false,
        error: "no_snapshot",
        message: "Nessun dato sincronizzato: premi «Aggiorna dati» in dashboard prima di generare il piano.",
      },
      { status: 409 }
    );
  }

  const wellness = mirror.wellness_30d ?? [];
  const ctlHistory = wellness.map((d) => d.ctl);
  const ctlToday = wellness.at(-1)?.ctl ?? null;
  const atlToday = wellness.at(-1)?.atl ?? null;
  // ACWR = atl/ctl (lettura/operazione semplice, come readiness e dashboard).
  const acwr = ctlToday != null && atlToday != null ? (ctlToday === 0 ? 0 : atlToday / ctlToday) : null;
  // TSB = CTL - ATL: stessa operazione semplice dell'ACWR sopra, non ricalcolo del readiness.
  const tsb = ctlToday != null && atlToday != null ? Number((ctlToday - atlToday).toFixed(1)) : null;
  const ri = mirror.readiness_today?.signals.find((s) => s.name === "ri")?.value ?? null;
  const readinessDecision = mirror.readiness_today?.decision ?? "GO";
  // Età del mirror (checklist §11C item 6, Temporal Data Validation).
  const dataAgeHours = Number(((Date.now() - Date.parse(mirror.fetched_at)) / 3_600_000).toFixed(1));

  // --- daysToEvent (dossier) ------------------------------------------------
  const eventDate = row?.data_obiettivo ?? row?.gare_target?.[0]?.data ?? null;
  const daysToEvent = daysUntil(eventDate);

  // --- Fase -----------------------------------------------------------------
  const phaseResult = detectPhase(ctlToday, ctlHistory, daysToEvent, acwr, ri);

  // --- Dossier per il selector ----------------------------------------------
  const dossier: PlannerDossier = {
    disponibilita_ore_sett: row?.disponibilita_ore_sett ?? null,
    giorni_preferiti: row?.giorni_preferiti ?? [],
    giorni_impossibili: row?.giorni_impossibili ?? [],
    durata_max_weekday_min: row?.durata_max_weekday_min ?? null,
    durata_max_weekend_min: row?.durata_max_weekend_min ?? null,
    indoor_outdoor: row?.indoor_outdoor ?? null,
    ha_rulli: row?.ha_rulli ?? null,
    sport_principali: row?.sport_principali ?? [],
  };
  const availableDays = computeAvailableDays(dossier);

  const levers = (row?.gap_analysis?.limiters ?? [])
    .map((l) => l.training_lever)
    .filter((l): l is string => typeof l === "string");

  const todayKey = JS_DAY_TO_KEY[new Date().getDay()];

  // --- Selezione + costruzione ----------------------------------------------
  const selected = selectWeekSessions(
    phaseResult.phase,
    dossier,
    { decision: readinessDecision, dayKey: todayKey, tsb, ri },
    { levers },
    availableDays
  );

  const weekStart = currentMonday();
  const week = buildWeek(weekStart, selected, dossier, profile, phaseResult.phase, {
    tsb,
    ri,
    data_age_hours: dataAgeHours,
  });

  // --- Narrativa AI opzionale (solo spiegazione) ----------------------------
  let narrative: string | null = null;
  if (isAIConfigured()) {
    try {
      narrative = await generateWeekNarrative({
        phase: phaseResult.phase,
        phase_reason: phaseResult.reason,
        days_to_event: daysToEvent,
        hard_sessions: week.audit.hard_sessions,
        volume_hours_estimate: week.audit.volume_hours_estimate,
        sessions: week.sessions
          .filter((s) => !s.rest)
          .map((s) => ({
            day: s.day,
            title: s.title,
            objective: s.session_objective,
            is_hard: s.is_hard,
            duration_min: s.estimated_duration_min,
          })),
      });
    } catch (error) {
      // AI non configurata o errore: il piano resta valido senza narrativa.
      if (!(error instanceof Error && error.message === "AI_NOT_CONFIGURED")) {
        console.error("Narrativa settimana fallita:", error);
      }
      narrative = null;
    }
  }

  // --- Persistenza (service role: bypassa RLS, scrittura solo backend) ------
  const admin = createAdminClient();
  const generatedAt = new Date().toISOString();

  const { error: planError } = await admin
    .from("weekly_plans")
    .upsert(
      {
        user_id: user.id,
        week_start: weekStart,
        phase: phaseResult.phase,
        sessions: week.sessions,
        narrative,
        validation_metadata: {
          ...week.audit,
          phase_reason: phaseResult.reason,
          phase_reason_code: phaseResult.reason_code,
          days_to_event: daysToEvent,
          generated_at: generatedAt,
        },
        generated_at: generatedAt,
      },
      { onConflict: "user_id,week_start" }
    );
  if (planError) {
    console.error("Salvataggio weekly_plan fallito:", planError.message);
    return NextResponse.json(
      { success: false, error: "save_failed", message: "Salvataggio del piano fallito" },
      { status: 500 }
    );
  }

  // Una riga coach_decisions per ogni seduta (non i riposi) — audit §11C.
  const decisionRows = week.sessions
    .filter((s) => !s.rest && s.library_id != null)
    .map((s) => ({
      user_id: user.id,
      date: s.date,
      decision_type: "weekly_plan" as const,
      recommendation: `${s.library_id} — ${s.session_objective}`,
      input_snapshot_id: snapshot?.id ?? null,
      rules_triggered: {
        phase: phaseResult.phase,
        phase_reason_code: phaseResult.reason_code,
        slot_rationale: s.session_rationale,
        frameworks_cited: s.frameworks_cited,
      },
      ai_summary: null,
      validator_status:
        (s.validation_metadata?.checklist_failed?.length ?? 0) === 0 ? "passed" : "failed",
      validation_metadata: s.validation_metadata,
      readiness_decision_snapshot: mirror.readiness_today ?? null,
    }));

  let decisionsWarning: string | null = null;
  if (decisionRows.length > 0) {
    const { error: decError } = await admin.from("coach_decisions").insert(decisionRows);
    if (decError) {
      console.error("Salvataggio coach_decisions fallito:", decError.message);
      decisionsWarning =
        "Piano generato, ma il salvataggio delle righe di audit (coach_decisions) è fallito.";
    }
  }

  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: "planner.generate",
    source: "planner",
    payload: {
      week_start: weekStart,
      phase: phaseResult.phase,
      hard_sessions: week.audit.hard_sessions,
      hard_spacing_ok: week.audit.hard_spacing_ok,
      narrative: narrative != null,
    },
  });

  return NextResponse.json({
    success: true,
    phase: phaseResult.phase,
    phase_reason: phaseResult.reason,
    days_to_event: daysToEvent,
    week_start: weekStart,
    week_sessions: week.sessions,
    audit: week.audit,
    narrative,
    warning: decisionsWarning,
  });
}
