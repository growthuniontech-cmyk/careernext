import { createClient } from "@/lib/supabase/server";
import { isClaudeConfigured } from "@/lib/ai";
import { requireUser, getJourney, saveJourney } from "@/lib/journey";
import { gradeSubmission } from "@/lib/grading";
import { stepsHaveSpecs, submissionError } from "@/lib/verification";
import {
  computeJobReadyPercent,
  type PathStep,
  type Progress,
  type StepSubmission,
  type StepVerificationState,
} from "@/lib/types";

export const maxDuration = 60;

function dateString(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** POST { stepIndex, submission }, the ONLY way a step completes and
 *  job-ready % moves. Grades the submission against the cached spec; a pass
 *  verdict marks the step complete, a refine verdict returns feedback. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const { stepIndex, submission } = (await request.json()) as {
    stepIndex: number;
    submission: StepSubmission;
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
  if (!stepsHaveSpecs(steps)) {
    // Legacy cached path, the client regenerates via /api/learning-path first
    return Response.json({ error: "specs_missing" }, { status: 409 });
  }

  const prev: Progress = journey.progress ?? {
    completedSteps: [],
    streak: 0,
    lastCompletedDate: null,
  };
  const done = new Set(prev.completedSteps);
  if (done.has(stepIndex)) {
    return Response.json({ error: "already_verified" }, { status: 409 });
  }
  // Steps unlock in order, every earlier step must already be verified
  for (let i = 0; i < stepIndex; i++) {
    if (!done.has(i)) {
      return Response.json({ error: "step_locked" }, { status: 409 });
    }
  }

  const step = steps[stepIndex];
  const spec = step.deliverable;
  const invalid = submissionError(spec, submission ?? {});
  if (invalid) {
    return Response.json({ error: invalid }, { status: 400 });
  }

  if (!isClaudeConfigured()) {
    return Response.json({ error: "claude_not_configured" }, { status: 503 });
  }

  let result;
  try {
    result = await gradeSubmission(step, spec, submission);
  } catch (err) {
    console.error("grading failed:", err);
    return Response.json({ error: "grading_failed" }, { status: 500 });
  }

  const priorState = journey.verifications?.[String(stepIndex)];
  const verification: StepVerificationState = {
    attempts: (priorState?.attempts ?? 0) + 1,
    lastVerdict: result.verdict,
    lastFeedback: result.feedback,
    scores: result.scores,
    ...(result.verdict === "pass" ? { verifiedAt: new Date().toISOString() } : {}),
  };
  const verifications = {
    ...journey.verifications,
    [String(stepIndex)]: verification,
  };

  let progress = prev;
  if (result.verdict === "pass") {
    done.add(stepIndex);
    let { streak, lastCompletedDate } = prev;
    const today = dateString();
    if (lastCompletedDate !== today) {
      streak = lastCompletedDate === dateString(-1) ? streak + 1 : 1;
      lastCompletedDate = today;
    }
    progress = {
      completedSteps: [...done].sort((a, b) => a - b),
      streak,
      lastCompletedDate,
    };
  }

  await saveJourney(supabase, auth.user.id, { progress, verifications });

  return Response.json({
    verdict: result.verdict,
    scores: result.scores,
    feedback: result.feedback,
    progress,
    jobReadyPercent: computeJobReadyPercent(progress.completedSteps, steps.length),
  });
}
