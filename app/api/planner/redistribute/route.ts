import { NextResponse } from "next/server";

import type { BuiltSession } from "@/lib/planner/build-week";
import type { MirrorData } from "@/lib/intervals/sync";
import type { Phase } from "@/lib/planner/phase-detector";
import {
  redistributeWeek,
  type RedistributeResult,
} from "@/lib/planner/redistribute";
import { DAY_KEYS, effectiveMinGapDays, type DayKey } from "@/lib/planner/session-selector";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface WeeklyPlanRow {
  id: string;
  week_start: string;
  phase: Phase;
  sessions: BuiltSession[];
  pushed_at: string | null;
  plan_history: unknown[] | null;
}

interface AthleteProfileRow {
  giorni_impossibili: string[] | null;
  disponibilita_ore_sett: number | null;
  durata_max_weekday_min: number | null;
  durata_max_weekend_min: number | null;
}

/** Converte una data ISO in DayKey cercando nella settimana corrente del piano. */
function dateToDay(date: string, sessions: BuiltSession[]): DayKey | null {
  const match = sessions.find((s) => s.date === date);
  return match ? (match.day as DayKey) : null;
}

/** Giorni a partire da oggi (incluso) che sono nel piano e non bloccati. */
function computeRemainingDays(
  sessions: BuiltSession[],
  blockedDay: DayKey,
  todayIso: string,
  giorniImpossibili: string[]
): DayKey[] {
  const impossible = new Set(giorniImpossibili);
  return DAY_KEYS.filter((d) => {
    if (d === blockedDay) return false;
    if (impossible.has(d)) return false;
    const s = sessions.find((sess) => sess.day === d);
    if (!s) return false;
    if (s.date < todayIso) return false; // passato → locked
    return true;
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "preview";
  if (mode !== "preview" && mode !== "commit") {
    return NextResponse.json(
      { success: false, error: "invalid_mode", message: "Modalità non valida" },
      { status: 400 }
    );
  }

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

  let body: { blocked_date?: string; confirmed?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { success: false, error: "bad_request", message: "Body JSON non valido" },
      { status: 400 }
    );
  }

  const blockedDate = body.blocked_date;
  if (!blockedDate || !/^\d{4}-\d{2}-\d{2}$/.test(blockedDate)) {
    return NextResponse.json(
      {
        success: false,
        error: "missing_blocked_date",
        message: "Campo blocked_date (YYYY-MM-DD) obbligatorio",
      },
      { status: 400 }
    );
  }

  if (mode === "commit" && body.confirmed !== true) {
    return NextResponse.json(
      {
        success: false,
        error: "confirmation_required",
        message: "Conferma esplicita richiesta (confirmed: true)",
      },
      { status: 400 }
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  // Verifica che la data bloccata non sia nel passato.
  if (blockedDate < todayIso) {
    return NextResponse.json(
      {
        success: false,
        error: "date_in_past",
        message: "Non è possibile ridistribuire una sessione già passata",
      },
      { status: 409 }
    );
  }

  // Carica il piano più recente.
  const { data: planRow, error: planError } = await supabase
    .from("weekly_plans")
    .select("id, week_start, phase, sessions, pushed_at, plan_history")
    .eq("user_id", user.id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (planError) {
    return NextResponse.json(
      { success: false, error: "plan_read_failed", message: "Lettura piano fallita" },
      { status: 500 }
    );
  }
  if (!planRow) {
    return NextResponse.json(
      { success: false, error: "no_plan", message: "Nessun piano da ridistribuire" },
      { status: 404 }
    );
  }

  const plan = planRow as WeeklyPlanRow;

  // Individua il DayKey corrispondente alla data bloccata.
  const blockedDay = dateToDay(blockedDate, plan.sessions);
  if (!blockedDay) {
    return NextResponse.json(
      {
        success: false,
        error: "date_not_in_plan",
        message: "La data indicata non appartiene al piano corrente",
      },
      { status: 409 }
    );
  }

  // Carica dossier per i cap di durata.
  const { data: profile } = await supabase
    .from("athlete_profiles")
    .select(
      "giorni_impossibili, disponibilita_ore_sett, durata_max_weekday_min, durata_max_weekend_min"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const profileData = (profile ?? {}) as AthleteProfileRow;
  const giorniImpossibili = profileData.giorni_impossibili ?? [];

  const remainingDays = computeRemainingDays(
    plan.sessions,
    blockedDay,
    todayIso,
    giorniImpossibili
  );

  const dossier = {
    disponibilita_ore_sett: profileData.disponibilita_ore_sett ?? null,
    durata_max_weekday_min: profileData.durata_max_weekday_min ?? null,
    durata_max_weekend_min: profileData.durata_max_weekend_min ?? null,
  };

  // TSB/RI odierni (letti, non ricalcolati) per l'eccezione "dure consecutive" (§3.1).
  const { data: snapshot } = await supabase
    .from("athlete_metrics_snapshots")
    .select("mirror_data")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const mirror = (snapshot?.mirror_data ?? null) as MirrorData | null;
  const wellness = mirror?.wellness_30d ?? [];
  const ctlToday = wellness.at(-1)?.ctl ?? null;
  const atlToday = wellness.at(-1)?.atl ?? null;
  const tsb = ctlToday != null && atlToday != null ? Number((ctlToday - atlToday).toFixed(1)) : null;
  const ri = mirror?.readiness_today?.signals.find((s) => s.name === "ri")?.value ?? null;
  const minGapDays = effectiveMinGapDays(tsb, ri);

  let result: RedistributeResult;
  try {
    result = redistributeWeek(
      plan.sessions,
      blockedDay,
      remainingDays,
      dossier,
      plan.phase,
      minGapDays
    );
  } catch (err) {
    console.error("redistributeWeek fallita:", err);
    return NextResponse.json(
      { success: false, error: "redistribute_failed", message: "Ridistribuzione fallita" },
      { status: 500 }
    );
  }

  if (mode === "preview") {
    return NextResponse.json({
      success: true,
      mode: "preview",
      blocked_date: blockedDate,
      blocked_day: blockedDay,
      ...result,
    });
  }

  // ─── Commit: salva la nuova settimana ─────────────────────────────────────
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Archivia la versione precedente in plan_history.
  const previousHistory = Array.isArray(plan.plan_history) ? plan.plan_history : [];
  const newHistory = [
    ...previousHistory,
    {
      sessions: plan.sessions,
      archived_at: now,
      reason: `Ridistribuzione: ${blockedDate} bloccato.`,
    },
  ].slice(-5); // max 5 versioni

  const { error: updateError } = await admin
    .from("weekly_plans")
    .update({
      sessions: result.new_week,
      plan_history: newHistory,
      last_redistributed_at: now,
    })
    .eq("id", plan.id)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Salvataggio ridistribuzione fallito:", updateError.message);
    return NextResponse.json(
      {
        success: false,
        error: "save_failed",
        message: "Ridistribuzione calcolata ma salvataggio fallito",
      },
      { status: 500 }
    );
  }

  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: "planner.redistribute",
    source: "planner",
    payload: {
      blocked_date: blockedDate,
      blocked_day: blockedDay,
      changes: result.changes,
      volume_reduced: result.volume_reduced,
      explanation: result.explanation,
    },
  });

  return NextResponse.json({
    success: true,
    mode: "commit",
    blocked_date: blockedDate,
    blocked_day: blockedDay,
    redistributed_at: now,
    pushed_at_before: plan.pushed_at,
    ...result,
  });
}
