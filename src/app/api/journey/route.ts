import { createClient } from "@/lib/supabase/server";
import { requireUser, getJourney, saveJourney, getLatestResume } from "@/lib/journey";
import { loadRole } from "@/lib/roles";
import { sanitizeStepsForClient, stepsHaveSpecs } from "@/lib/verification";
import { computeJobReadyPercent, type JourneyView, type PathStep } from "@/lib/types";

/** GET: everything the flow pages need in one call. */
export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const [journey, resume] = await Promise.all([
    getJourney(supabase, auth.user.id),
    getLatestResume(supabase, auth.user.id),
  ]);

  let pathSteps: PathStep[] | undefined;
  if (journey.selectedRoleSlug) {
    const { data } = await supabase
      .from("role_paths")
      .select("steps")
      .eq("role_slug", journey.selectedRoleSlug)
      .maybeSingle();
    const raw = (data?.steps as PathStep[]) ?? undefined;
    // Legacy rows without specs are treated as absent — the path page then
    // calls /api/learning-path, which migrates and re-caches them.
    pathSteps = raw && stepsHaveSpecs(raw) ? sanitizeStepsForClient(raw) : undefined;
  }

  const view: JourneyView = {
    ...journey,
    hasResume: Boolean(resume),
    resumeSummary: resume?.summary,
    pathSteps,
    jobReadyPercent: computeJobReadyPercent(
      journey.progress?.completedSteps,
      pathSteps?.length,
    ),
  };
  return Response.json(view);
}

/** PATCH: select a role (the only client-writable journey field). */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const { selectedRoleSlug } = (await request.json()) as {
    selectedRoleSlug?: string;
  };
  if (!selectedRoleSlug) {
    return Response.json({ error: "missing_role" }, { status: 400 });
  }
  const role = await loadRole(supabase, selectedRoleSlug);
  if (!role) {
    return Response.json({ error: "unknown_role" }, { status: 400 });
  }

  const journey = await getJourney(supabase, auth.user.id);
  const changed = journey.selectedRoleSlug !== selectedRoleSlug;
  await saveJourney(supabase, auth.user.id, {
    selectedRoleSlug,
    selectedTitle: role.title,
    // Changing roles resets downstream results, progress, and verifications
    ...(changed ? { toolkit: undefined, progress: undefined, verifications: undefined } : {}),
  });

  return Response.json({ ok: true });
}
