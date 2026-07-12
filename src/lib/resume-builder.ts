import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClaude, isClaudeConfigured, RESUME_MODEL, BulletRewriteSchema, JdTailorSchema } from "./ai";
import type { BuilderSections, ExperienceEntry } from "./types";

const BANNED_BUZZWORDS = [
  "passionate",
  "guru",
  "ninja",
  "rockstar",
  "synergy",
  "hardworking",
  "team player",
];
const BANNED_AI_PHRASES = [
  "leverage",
  "dive deep",
  "revolutionize",
  "cutting-edge",
  "in today's fast-paced world",
];

const REWRITE_SYSTEM = `You write resume bullets for a career-building tool, following a strict professional methodology. Rules, no exceptions:
- Every bullet starts with a strong action verb and includes a number, metric, or scale.
- Write achievements, not duties: what changed because of the work, not just what the person was responsible for.
- Never fabricate. Only rephrase what the user actually told you. Never invent a number, outcome, or detail they did not provide. If they gave no metric, do not add one, write the achievement without a fabricated number instead.
- No buzzwords: never use ${BANNED_BUZZWORDS.map((w) => `"${w}"`).join(", ")}.
- No AI-signature phrases: never use ${BANNED_AI_PHRASES.map((w) => `"${w}"`).join(", ")}.
- Vary sentence length so the writing reads human-written, not templated.
- If a target job description is given, mirror its language and priorities naturally where truthful; never copy-paste JD phrases verbatim.
- Do not use em dashes or en dashes; use commas, colons, or periods instead.
Return the polished rewrite first, then 3-5 specific improvement suggestions.`;

export async function rewriteExperienceBullets(
  entry: Pick<ExperienceEntry, "title" | "company" | "challenge" | "change" | "metric">,
  jdText?: string | null,
): Promise<{ bullets: string[]; suggestions: string[] } | null> {
  if (!isClaudeConfigured()) return null;

  const parts = [
    `Role: ${entry.title} at ${entry.company}`,
    `What challenge did they solve: ${entry.challenge || "(not provided)"}`,
    `What changed because of it: ${entry.change || "(not provided)"}`,
    `Quantified impact they gave: ${entry.metric || "(not provided, do not invent one)"}`,
  ];
  if (jdText?.trim()) {
    parts.push(`Target job description to mirror the language of (do not copy phrases verbatim):\n${jdText.slice(0, 6000)}`);
  }

  const response = await getClaude().messages.parse({
    model: RESUME_MODEL,
    max_tokens: 2000,
    output_config: {
      effort: "high",
      format: zodOutputFormat(BulletRewriteSchema),
    },
    system: REWRITE_SYSTEM,
    messages: [{ role: "user", content: parts.join("\n\n") }],
  });

  const parsed = response.parsed_output;
  if (!parsed) return null;
  return parsed;
}

const TAILOR_SYSTEM = `You tailor an existing resume to a target job description for a career-building tool. You never fabricate: you only reorder, re-emphasize, or naturally rephrase what the candidate already has. Steps:
1. Extract the JD's must-have keywords, ranked by importance.
2. Compare them against the resume's existing content.
3. Rewrite the professional summary using the candidate's real background, naturally mirroring the JD's language and priorities. Never copy-paste JD phrases verbatim, never invent experience.
4. For each experience entry, reorder its EXISTING bullets most-relevant-to-the-JD first. Do not edit the bullet text and do not invent new bullets, only reorder the ones given.
5. Reorder and lightly rephrase the candidate's EXISTING core competencies to mirror the JD's priority order and terminology, only where truthful. Never add a skill the candidate does not already have listed.
Do not use em dashes or en dashes; use commas, colons, or periods instead.`;

export type TailorResult = Awaited<ReturnType<typeof tailorToJD>>;

export async function tailorToJD(sections: BuilderSections, jdText: string) {
  if (!isClaudeConfigured()) return null;

  const response = await getClaude().messages.parse({
    model: RESUME_MODEL,
    max_tokens: 4000,
    output_config: {
      effort: "high",
      format: zodOutputFormat(JdTailorSchema),
    },
    system: TAILOR_SYSTEM,
    messages: [
      {
        role: "user",
        content: `JOB DESCRIPTION:\n${jdText.slice(0, 12000)}\n\nCURRENT SUMMARY:\n${sections.summary}\n\nCURRENT CORE COMPETENCIES:\n${sections.coreCompetencies.join(", ")}\n\nCURRENT EXPERIENCE (id, title, bullets):\n${sections.experience
          .map((e) => `id=${e.id} | ${e.title} at ${e.company}\n${e.bullets.map((b) => `- ${b}`).join("\n")}`)
          .join("\n\n")}`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) return null;

  // Anti-fabrication guard: a reorder is only applied if it's an exact
  // permutation of the entry's real bullets; skills are filtered to ones the
  // candidate actually listed. Protects against the model editing or adding
  // content while "just reordering".
  const bySameSet = (a: string[], b: string[]) =>
    a.length === b.length && [...a].sort().join("") === [...b].sort().join("");

  const validReorders = parsed.experienceReorders.filter((r) => {
    const original = sections.experience.find((e) => e.id === r.experienceId);
    return original && bySameSet(original.bullets, r.orderedBullets);
  });

  const existingSkillsLower = new Set(sections.coreCompetencies.map((s) => s.toLowerCase()));
  const validSkills = parsed.skillsAligned.filter((s) => existingSkillsLower.has(s.toLowerCase()));

  return {
    jdKeywords: parsed.jdKeywords,
    summaryRewrite: parsed.summaryRewrite,
    headerTitleSuggestion: parsed.headerTitleSuggestion,
    experienceReorders: validReorders,
    skillsAligned: validSkills.length ? validSkills : sections.coreCompetencies,
    suggestions: parsed.suggestions,
  };
}
