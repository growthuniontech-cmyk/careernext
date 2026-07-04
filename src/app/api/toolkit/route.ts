import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClaude, MODEL, isClaudeConfigured, ToolkitSchema } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import { requireUser, getLatestResume, getJourney, saveJourney } from "@/lib/journey";
import { loadRole } from "@/lib/roles";
import toolsSeed from "@/data/ai-tools-seed.json";
import type { ToolkitTool } from "@/lib/types";

export const maxDuration = 60;

type ToolRow = {
  name: string;
  category: string | null;
  url: string | null;
  description: string | null;
  tags: string[];
};

const SYSTEM = `You build personalized AI toolkits for a specific person targeting a specific job. Rules:
- Choose 6-8 tools FROM THE CANDIDATE LIST ONLY, by exact name.
- "high" tier: 3-4 tools they'd use daily in this role. "medium": 3-4 weekly support tools.
- Every reason must (a) name a real task in this job and (b) connect to this person's actual background: a gap to close or a strength to amplify. Never a generic tool description.
- Do not use em dashes or en dashes; use commas, colons, or periods instead.`;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Pull candidate tools from the ai_tools table (Notion-synced or seeded),
 *  filtered by relevance to the role's profile. */
async function loadCandidateTools(
  supabase: Awaited<ReturnType<typeof createClient>>,
  role: { title: string; category: string; skills: string[]; tools: string[] },
): Promise<ToolRow[]> {
  const { data } = await supabase
    .from("ai_tools")
    .select("name, category, url, description, tags");
  const all: ToolRow[] = data?.length ? (data as ToolRow[]) : (toolsSeed as ToolRow[]);

  const roleTerms = [
    role.title,
    role.category,
    ...role.skills,
    ...role.tools,
  ].map(normalize);

  const scored = all.map((tool) => {
    const toolTerms = [tool.name, tool.category ?? "", ...(tool.tags ?? [])].map(normalize);
    let hits = 0;
    for (const t of toolTerms) {
      if (!t) continue;
      if (t === "all-roles") hits += 1;
      if (roleTerms.some((r) => r.includes(t) || t.includes(r))) hits += 2;
    }
    // Tools the role profile names directly are top candidates
    if (role.tools.some((rt) => normalize(rt) === normalize(tool.name))) hits += 6;
    return { tool, hits };
  });

  return scored
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 25)
    .map((s) => s.tool);
}

export async function POST() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  if (!isClaudeConfigured()) {
    return Response.json({ error: "claude_not_configured" }, { status: 503 });
  }

  const journey = await getJourney(supabase, auth.user.id);
  if (!journey.selectedRoleSlug) {
    return Response.json({ error: "no_role_selected" }, { status: 400 });
  }
  const role = await loadRole(supabase, journey.selectedRoleSlug);
  if (!role) {
    return Response.json({ error: "unknown_role" }, { status: 400 });
  }
  const resume = await getLatestResume(supabase, auth.user.id);
  if (!resume) {
    return Response.json({ error: "no_resume" }, { status: 400 });
  }

  const candidates = await loadCandidateTools(supabase, role);
  const byName = new Map(candidates.map((c) => [normalize(c.name), c]));

  try {
    const response = await getClaude().messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: {
        effort: "medium",
        format: zodOutputFormat(ToolkitSchema),
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Target job: ${role.title} (${role.category})\nRole needs these skills: ${role.skills.join(", ")}\n\nThis person:\nTitles held: ${resume.titlesHeld.join(", ") || "fresher"}\nSkills: ${resume.skills.join(", ")}\nTools already used: ${resume.toolsUsed.join(", ") || "none listed"}\nSummary: ${resume.summary}\n\nCandidate tools (choose only from these, by exact name):\n${candidates
            .map((c) => `- ${c.name}: ${c.description ?? c.category ?? ""}`)
            .join("\n")}`,
        },
      ],
    });

    const tools: ToolkitTool[] = (response.parsed_output?.tools ?? [])
      .filter((t) => byName.has(normalize(t.name)))
      .map((t) => ({
        name: byName.get(normalize(t.name))!.name,
        tier: t.tier,
        reason: t.reason,
        url: byName.get(normalize(t.name))!.url ?? undefined,
      }));

    if (tools.length === 0) {
      return Response.json({ error: "toolkit_failed" }, { status: 500 });
    }

    await saveJourney(supabase, auth.user.id, { toolkit: tools });
    return Response.json({ tools });
  } catch (err) {
    console.error("toolkit generation failed:", err);
    return Response.json({ error: "toolkit_failed" }, { status: 500 });
  }
}
