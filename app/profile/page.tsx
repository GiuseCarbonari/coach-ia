import { redirect } from "next/navigation";

import { CurveLoadShell } from "@/components/layout/curveload-shell";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { RunnerProfile } from "@/components/profile/runner-profile";
import { isRunnerOnly } from "@/lib/onboarding/dossier";
import type { AthleteProfileData } from "@/lib/profile/build-profile";
import type { RunnerProfileData } from "@/lib/profile/build-runner-profile";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("athlete_profiles")
    .select(
      "profile_data, runner_profile_data, sport_principali, updated_at, ai_comment, ai_comment_at, ai_comment_profilo, ai_comment_profilo_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  // I runner vedono il profilo CS/D′; tutti gli altri il profilo CP/W′ bici.
  const runner = isRunnerOnly(
    (row?.sport_principali as string[] | null) ?? []
  );

  if (runner) {
    const runnerProfile = (row?.runner_profile_data ??
      null) as RunnerProfileData | null;
    return (
      <CurveLoadShell>
        <RunnerProfile profile={runnerProfile} />
      </CurveLoadShell>
    );
  }

  const profile = (row?.profile_data ?? null) as AthleteProfileData | null;
  const cpw = profile?.cp_wprime ?? null;

  return (
    <CurveLoadShell>
      <ProfileTabs
        profile={profile}
        cpw={cpw}
        row={row}
        aiCommentProfilo={row?.ai_comment_profilo ?? null}
        aiCommentProfiloAt={row?.ai_comment_profilo_at ?? null}
      />

    </CurveLoadShell>
  );
}
