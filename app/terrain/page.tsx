import { redirect } from "next/navigation";

import type { SavedGapAnalysis } from "@/components/profile/event-analysis";
import { EventAnalysis } from "@/components/profile/event-analysis";
import { GapAnalysisButton } from "@/components/profile/gap-analysis-button";
import { RaceEstimateView } from "@/components/profile/race-estimate";
import { CalibrateButton } from "@/components/profile/calibrate-button";
import { CalibrationHelp } from "@/components/profile/calibration-help";
import { CoachCommentPercorso } from "@/components/terrain/coach-comment-percorso";
import { CurveLoadShell } from "@/components/layout/curveload-shell";
import type { TerrainSummary } from "@/lib/terrain/gpx-parser";
import type { RaceEstimateV2 } from "@/lib/terrain/race-estimator-v2";
import { createClient } from "@/lib/supabase/server";

export default async function TerrainPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("athlete_profiles")
    .select(
      "gap_analysis, gap_analysis_at, event_terrain, race_estimate, race_estimate_at, signature_level, ai_comment_percorso, ai_comment_percorso_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const gapAnalysis = (row?.gap_analysis ?? null) as SavedGapAnalysis | null;
  const eventTerrain = (row?.event_terrain ?? null) as TerrainSummary | null;
  const sl = row?.signature_level;
  const signatureLevel: 1 | 2 | null = sl === 1 || sl === 2 ? sl : null;
  const raceEstimate = (row?.race_estimate ?? null) as RaceEstimateV2 | null;

  return (
    <CurveLoadShell>
      <div className="space-y-4 pt-4">
        {/* Event analysis */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.14em] text-accent2">
                Analisi evento
              </div>
              <h2 className="mt-1 font-serif text-[22px] text-foreground">
                Richieste del percorso
              </h2>
            </div>
            <div className="shrink-0">
              <GapAnalysisButton hasAnalysis={gapAnalysis != null} />
            </div>
          </div>

          {gapAnalysis && eventTerrain ? (
            <EventAnalysis
              terrain={eventTerrain}
              analysis={gapAnalysis}
              generatedAt={(row?.gap_analysis_at ?? null) as string | null}
            />
          ) : (
            <div className="rounded-[16px] border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
              Seleziona una gara da Intervals.icu o carica un GPX per vedere
              il profilo altimetrico e i limitatori specifici.
            </div>
          )}
        </section>

        {/* Race estimate */}
        {eventTerrain && (
          <section className="space-y-4">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.14em] text-accent2">
                Stima gara
              </div>
              <h2 className="mt-1 font-serif text-[22px] text-foreground">
                Tempo e strategia
              </h2>
            </div>

            <CalibrationHelp />

            {signatureLevel == null && (
              <div className="flex items-center justify-between gap-3 rounded-[14px] border border-ready-skip-border bg-surface px-4 py-3.5">
                <div>
                  <p className="text-[13px] font-medium text-foreground">
                    Calibrazione assente
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    Adatta il modello alle tue uscite MTB recenti.
                  </p>
                </div>
                <div className="shrink-0">
                  <CalibrateButton label="Calibra" />
                </div>
              </div>
            )}

            {signatureLevel === 2 && (
              <div className="flex items-center justify-between gap-3 rounded-[14px] border border-ready-modify-border bg-surface px-4 py-3.5">
                <div>
                  <p className="text-[13px] font-medium text-foreground">
                    Stima su valori medi MTB
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    {raceEstimate?.activities_used != null
                      ? `${raceEstimate.activities_used} attività analizzate.`
                      : "Calibra per rendere la stima personale."}
                  </p>
                </div>
                <div className="shrink-0">
                  <CalibrateButton label="Migliora" variant="outline" />
                </div>
              </div>
            )}

            {signatureLevel === 1 && (
              <div className="flex items-center justify-between gap-3 rounded-[14px] border border-ready-go-border bg-surface px-4 py-3.5">
                <div>
                  <p className="text-[13px] font-medium text-foreground">
                    Calibrata sui tuoi dati
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    {raceEstimate?.source_breakdown
                      ? `${raceEstimate.source_breakdown.L1}% dati personali.`
                      : "Stima basata sulle tue uscite MTB."}
                  </p>
                </div>
                <div className="shrink-0">
                  <CalibrateButton label="Ricalibra" variant="outline" />
                </div>
              </div>
            )}

            {signatureLevel != null && raceEstimate && (
              <>
                <RaceEstimateView
                  terrain={eventTerrain}
                  estimate={raceEstimate}
                  generatedAt={
                    (row?.race_estimate_at ?? null) as string | null
                  }
                />
                {raceEstimate.source_breakdown && (
                  <p className="text-[11px] text-faint">
                    Copertura: L1 {raceEstimate.source_breakdown.L1}%
                    personale · L2 {raceEstimate.source_breakdown.L2}%
                    archetipo · L3 {raceEstimate.source_breakdown.L3}%
                    modello fisico.
                  </p>
                )}
              </>
            )}

            {signatureLevel != null && !raceEstimate && (
              <p className="rounded-[14px] border border-border bg-surface px-4 py-4 text-sm text-secondary">
                Firma pronta. Rianalizza l&apos;evento per generare la stima.
              </p>
            )}
          </section>
        )}

        {/* AI comment - percorso */}
        {gapAnalysis && (
          <CoachCommentPercorso
            initialComment={
              (row?.ai_comment_percorso ?? null) as string | null
            }
            initialGeneratedAt={
              (row?.ai_comment_percorso_at ?? null) as string | null
            }
          />
        )}
      </div>
    </CurveLoadShell>
  );
}
