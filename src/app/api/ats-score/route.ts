import { scoreResumeAgainstJD, buildRoleJD } from "@/lib/ats";
import { isClaudeConfigured } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import { requireUser, getLatestResumeRecord, getJourney } from "@/lib/journey";
import { loadRole } from "@/lib/roles";

export const maxDuration = 60;

/** GET: current state for the ATS page, no scoring call. */
export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const [resume, journey] = await Promise.all([
    getLatestResumeRecord(supabase, auth.user.id),
    getJourney(supabase, auth.user.id),
  ]);

  return Response.json({
    hasResume: Boolean(resume),
    score: resume?.ats_score ?? null,
    selectedTitle: journey.selectedTitle ?? null,
  });
}

/** POST: score the user's latest resume against a JD.
 *  Body: { jdText: string } to score against pasted JD text, or
 *        { useRoleJd: true } to score against the matched role's synthesized JD. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  if (!isClaudeConfigured()) {
    return Response.json({ error: "claude_not_configured" }, { status: 503 });
  }

  const resume = await getLatestResumeRecord(supabase, auth.user.id);
  if (!resume) {
    return Response.json({ error: "no_resume" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    jdText?: string;
    useRoleJd?: boolean;
  };

  let jdText: string;
  let jdSource: "pasted" | "role";
  if (body.useRoleJd) {
    const journey = await getJourney(supabase, auth.user.id);
    if (!journey.selectedRoleSlug) {
      return Response.json({ error: "no_role_selected" }, { status: 400 });
    }
    const role = await loadRole(supabase, journey.selectedRoleSlug);
    if (!role) {
      return Response.json({ error: "unknown_role" }, { status: 400 });
    }
    jdText = buildRoleJD(role);
    jdSource = "role";
  } else {
    if (!body.jdText?.trim()) {
      return Response.json({ error: "missing_jd" }, { status: 400 });
    }
    jdText = body.jdText.trim();
    jdSource = "pasted";
  }

  try {
    const score = await scoreResumeAgainstJD(resume.raw_text, jdText, jdSource);
    if (!score) {
      return Response.json({ error: "scoring_failed" }, { status: 500 });
    }

    const { error: dbError } = await supabase
      .from("resumes")
      .update({ ats_score: score })
      .eq("id", resume.id);
    if (dbError) {
      console.error("ats score save failed:", dbError);
    }

    return Response.json({ score });
  } catch (err) {
    console.error("ats scoring failed:", err);
    return Response.json({ error: "scoring_failed" }, { status: 500 });
  }
}
