import { buildResumeDocx, isValidDocxBuffer, MIN_SKILLS_FOR_EXPORT } from "@/lib/export-docx";
import { createClient } from "@/lib/supabase/server";
import { requireUser, getBuilderResume } from "@/lib/journey";
import { normalizeSections } from "@/lib/builder-sections";

export const maxDuration = 60;

/** POST: builds the .docx from the user's saved builder resume and streams
 *  it back. Validates the skills minimum and the generated file before
 *  responding. */
export async function POST() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const builder = await getBuilderResume(supabase, auth.user.id);
  const sections = normalizeSections(builder.sections);

  if (!sections.header.name.trim()) {
    return Response.json({ error: "missing_header" }, { status: 400 });
  }
  if (sections.coreCompetencies.length < MIN_SKILLS_FOR_EXPORT) {
    return Response.json(
      {
        error: "not_enough_skills",
        message: `Add at least ${MIN_SKILLS_FOR_EXPORT} core competencies before exporting (you have ${sections.coreCompetencies.length}).`,
      },
      { status: 422 },
    );
  }

  let buffer: Buffer;
  try {
    buffer = await buildResumeDocx(sections);
  } catch (err) {
    console.error("docx build failed:", err);
    return Response.json({ error: "export_failed" }, { status: 500 });
  }

  if (!isValidDocxBuffer(buffer)) {
    console.error("docx validation failed: malformed output buffer");
    return Response.json({ error: "export_failed" }, { status: 500 });
  }

  const filename = `${sections.header.name.trim().replace(/[^a-z0-9]+/gi, "_") || "resume"}.docx`;
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
