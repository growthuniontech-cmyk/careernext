import { isClaudeConfigured } from "@/lib/ai";
import { tailorToJD } from "@/lib/resume-builder";
import { normalizeSections } from "@/lib/builder-sections";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/journey";
import type { BuilderSections } from "@/lib/types";

export const maxDuration = 60;

/** POST: JD tailoring pass over the builder resume. Body: { sections, jdText }.
 *  Returns suggested rewrites; the client applies them and saves via PATCH
 *  /api/builder, nothing is persisted here. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  if (!isClaudeConfigured()) {
    return Response.json({ error: "claude_not_configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    sections?: BuilderSections;
    jdText?: string;
  };

  if (!body.sections) {
    return Response.json({ error: "missing_sections" }, { status: 400 });
  }
  if (!body.jdText?.trim()) {
    return Response.json({ error: "missing_jd" }, { status: 400 });
  }

  try {
    const result = await tailorToJD(normalizeSections(body.sections), body.jdText.trim());
    if (!result) {
      return Response.json({ error: "tailor_failed" }, { status: 500 });
    }
    return Response.json(result);
  } catch (err) {
    console.error("jd tailoring failed:", err);
    return Response.json({ error: "tailor_failed" }, { status: 500 });
  }
}
