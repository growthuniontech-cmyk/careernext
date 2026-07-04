import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClaude, MODEL, isClaudeConfigured, MatchReasonsSchema } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import { requireUser, getLatestResume, saveJourney } from "@/lib/journey";
import { loadRoles } from "@/lib/roles";
import { rankRoles } from "@/lib/matching";
import type { JobMatch } from "@/lib/types";

export const maxDuration = 60;

const SYSTEM = `You write the "why this match" line for a career-matching product. For each role, write one warm, specific, confidence-building sentence explaining why this person fits, referencing their actual background (titles, skills, industries). Never generic. Audience is global (US, UK, Canada, Australia, India).`;

export async function POST() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const resume = await getLatestResume(supabase, auth.user.id);
  if (!resume) {
    return Response.json({ error: "no_resume" }, { status: 400 });
  }

  // Rank against the stored taxonomy (deterministic similarity engine)
  const roles = await loadRoles(supabase);
  const ranked = rankRoles(resume, roles, 5);

  // Personalized reasoning via Claude — one call for all five
  let reasons = new Map<string, string>();
  if (isClaudeConfigured()) {
    try {
      const response = await getClaude().messages.parse({
        model: MODEL,
        max_tokens: 3000,
        output_config: {
          effort: "medium",
          format: zodOutputFormat(MatchReasonsSchema),
        },
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Candidate:\nTitles held: ${resume.titlesHeld.join(", ") || "none yet"}\nYears of experience: ${resume.yearsExperience}\nSkills: ${resume.skills.join(", ")}\nTools used: ${resume.toolsUsed.join(", ")}\nIndustries: ${resume.industries.join(", ") || "n/a"}\nSummary: ${resume.summary}\n\nMatched roles (slug — title — computed match %):\n${ranked
              .map((r) => `${r.slug} — ${r.title} — ${r.score}%`)
              .join("\n")}\n\nWrite one reason per role, keyed by slug.`,
          },
        ],
      });
      for (const r of response.parsed_output?.reasons ?? []) {
        reasons.set(r.roleSlug, r.reason);
      }
    } catch (err) {
      console.error("match reasoning failed:", err);
    }
  }

  const matches: JobMatch[] = ranked.map((r) => ({
    roleSlug: r.slug,
    title: r.title,
    score: r.score,
    reason:
      reasons.get(r.slug) ??
      `Your existing skills already cover a meaningful share of what a ${r.title} does day to day.`,
  }));

  // Persist and clear downstream results from any previous run
  await saveJourney(supabase, auth.user.id, {
    matches,
    selectedRoleSlug: undefined,
    selectedTitle: undefined,
    toolkit: undefined,
    progress: undefined,
  });

  return Response.json({ matches });
}
