import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/journey";
import type { ParsedResume } from "@/lib/types";

/** Manual entry point for users without a resume (or when parsing fails).
 *  Creates a resumes row directly from the form, no AI call needed. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const { currentRole, yearsExperience, skills } = (await request.json()) as {
    currentRole?: string;
    yearsExperience?: number;
    skills?: string[];
  };

  const cleanSkills = (skills ?? []).map((s) => s.trim()).filter(Boolean);
  if (!currentRole?.trim() || cleanSkills.length === 0) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const years = Math.max(0, Math.min(50, Number(yearsExperience) || 0));
  const parsed: ParsedResume = {
    skills: cleanSkills,
    titlesHeld: [currentRole.trim()],
    yearsExperience: years,
    toolsUsed: [],
    industries: [],
    education: [],
    summary: `${currentRole.trim()} with ${years} year${years === 1 ? "" : "s"} of experience. Key skills: ${cleanSkills.join(", ")}.`,
  };

  const { error } = await supabase.from("resumes").insert({
    user_id: auth.user.id,
    filename: null,
    raw_text: `[manual entry] ${parsed.summary}`,
    parsed,
  });
  if (error) {
    console.error("manual profile insert failed:", error);
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  return Response.json({ parsed });
}
