import { createClient } from "@/lib/supabase/server";
import { requireUser, getBuilderResume, saveBuilderResume } from "@/lib/journey";
import { normalizeSections, compileBuilderResumeText } from "@/lib/builder-sections";
import { scoreResumeAgainstJD } from "@/lib/ats";
import type { BuilderSections } from "@/lib/types";

export const maxDuration = 60;

/** GET: the user's in-progress builder resume, defaults filled in. */
export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const builder = await getBuilderResume(supabase, auth.user.id);
  return Response.json({
    sections: normalizeSections(builder.sections),
    jdText: builder.jdText,
    atsScore: builder.atsScore,
    updatedAt: builder.updatedAt,
  });
}

/** PATCH: save sections/jdText. If a JD is attached, recalculates the ATS
 *  score against the compiled builder resume so feedback is live on save. */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    sections?: BuilderSections;
    jdText?: string | null;
  };

  if (!body.sections) {
    return Response.json({ error: "missing_sections" }, { status: 400 });
  }

  const sections = normalizeSections(body.sections);
  const jdText = body.jdText?.trim() || null;

  let atsScore = null;
  let scoringFailed = false;
  if (jdText) {
    try {
      atsScore = await scoreResumeAgainstJD(compileBuilderResumeText(sections), jdText, "pasted");
      if (!atsScore) scoringFailed = true;
    } catch (err) {
      console.error("builder ats scoring failed:", err);
      scoringFailed = true;
    }
    if (scoringFailed) {
      // Keep whatever score was already on file rather than wiping it out
      // on a transient AI failure.
      const existing = await getBuilderResume(supabase, auth.user.id);
      atsScore = existing.atsScore;
    }
  }

  try {
    await saveBuilderResume(supabase, auth.user.id, { sections, jdText, atsScore });
  } catch (err) {
    console.error("builder save failed:", err);
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  return Response.json({ ok: true, atsScore });
}
