import { createClient } from "@/lib/supabase/server";
import { requireUser, getJourney, saveJourney } from "@/lib/journey";
import { computeJobReadyPercent, type PathStep, type Progress } from "@/lib/types";

function dateString(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** POST { stepIndex, completed } — toggles a path step and keeps streak +
 *  job-ready % consistent. The % is always completed ÷ total. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const { stepIndex, completed } = (await request.json()) as {
    stepIndex: number;
    completed: boolean;
  };

  const journey = await getJourney(supabase, auth.user.id);
  if (!journey.selectedRoleSlug) {
    return Response.json({ error: "no_role_selected" }, { status: 400 });
  }

  const { data: pathRow } = await supabase
    .from("role_paths")
    .select("steps")
    .eq("role_slug", journey.selectedRoleSlug)
    .maybeSingle();
  const steps = (pathRow?.steps as PathStep[]) ?? [];
  if (!steps.length || stepIndex < 0 || stepIndex >= steps.length) {
    return Response.json({ error: "invalid_step" }, { status: 400 });
  }

  const prev: Progress = journey.progress ?? {
    completedSteps: [],
    streak: 0,
    lastCompletedDate: null,
  };

  const set = new Set(prev.completedSteps);
  let { streak, lastCompletedDate } = prev;

  if (completed && !set.has(stepIndex)) {
    set.add(stepIndex);
    const today = dateString();
    if (lastCompletedDate !== today) {
      streak = lastCompletedDate === dateString(-1) ? streak + 1 : 1;
      lastCompletedDate = today;
    }
  } else if (!completed) {
    set.delete(stepIndex);
  }

  const progress: Progress = {
    completedSteps: [...set].sort((a, b) => a - b),
    streak,
    lastCompletedDate,
  };
  await saveJourney(supabase, auth.user.id, { progress });

  return Response.json({
    progress,
    jobReadyPercent: computeJobReadyPercent(progress.completedSteps, steps.length),
  });
}
