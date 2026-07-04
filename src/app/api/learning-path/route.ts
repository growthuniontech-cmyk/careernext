import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClaude, MODEL, isClaudeConfigured, PathSchema } from "@/lib/ai";
import { createClient, createAdminClient, hasServiceRole } from "@/lib/supabase/server";
import { requireUser, getJourney } from "@/lib/journey";
import { loadRole } from "@/lib/roles";
import { generateDeliverables } from "@/lib/specs";
import { sanitizeStepsForClient, stepsHaveSpecs } from "@/lib/verification";
import type { PathStep } from "@/lib/types";

export const maxDuration = 120;

const SYSTEM = `You design 5-step learning paths that take someone from their current skills to job-ready for a target role. Rules:
- Exactly 5 steps, sequenced so early wins come first and each step builds on the last.
- Step 5 must be a portfolio-grade project that proves the skills to employers.
- Steps teach the modern, AI-augmented version of the role.
- Tone: encouraging and concrete. "unlocks" lines are real milestones, not fluff.`;

function cacheSteps(roleSlug: string, steps: PathStep[]) {
  if (!hasServiceRole()) return;
  const admin = createAdminClient();
  return admin
    .from("role_paths")
    .upsert({ role_slug: roleSlug, steps }, { onConflict: "role_slug" })
    .then(({ error }) => {
      if (error) console.error("role_paths upsert failed:", error);
    });
}

/** Paths + their verification specs are generated once per role and cached in
 *  role_paths, every user targeting the same role shares them; progress and
 *  verification state are per-user. */
export async function POST() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const journey = await getJourney(supabase, auth.user.id);
  if (!journey.selectedRoleSlug) {
    return Response.json({ error: "no_role_selected" }, { status: 400 });
  }
  const role = await loadRole(supabase, journey.selectedRoleSlug);
  if (!role) {
    return Response.json({ error: "unknown_role" }, { status: 400 });
  }

  // Cached?
  const { data: cached } = await supabase
    .from("role_paths")
    .select("steps")
    .eq("role_slug", role.slug)
    .maybeSingle();
  if (cached?.steps) {
    const cachedSteps = cached.steps as PathStep[];
    if (stepsHaveSpecs(cachedSteps)) {
      return Response.json({ steps: sanitizeStepsForClient(cachedSteps), cached: true });
    }
    // Legacy row (pre-verification schema): generate specs once, re-cache.
    const migrated = await generateDeliverables(role.title, cachedSteps);
    await cacheSteps(role.slug, migrated);
    return Response.json({ steps: sanitizeStepsForClient(migrated), cached: true });
  }

  if (!isClaudeConfigured()) {
    return Response.json({ error: "claude_not_configured" }, { status: 503 });
  }

  try {
    const response = await getClaude().messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: {
        effort: "medium",
        format: zodOutputFormat(PathSchema),
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Target role: ${role.title} (${role.category})\nDescription: ${role.description}\nCore skills to build: ${role.skills.join(", ")}\nKey tools: ${role.tools.join(", ")}`,
        },
      ],
    });

    const rawSteps = (response.parsed_output?.steps ?? []).slice(0, 5);
    if (rawSteps.length < 3) {
      return Response.json({ error: "path_failed" }, { status: 500 });
    }

    // Attach generated verification specs, then persist for reuse across users
    const steps = await generateDeliverables(role.title, rawSteps);
    await cacheSteps(role.slug, steps);

    return Response.json({ steps: sanitizeStepsForClient(steps), cached: false });
  } catch (err) {
    console.error("learning-path generation failed:", err);
    return Response.json({ error: "path_failed" }, { status: 500 });
  }
}
