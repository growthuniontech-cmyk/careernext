import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClaude, isClaudeConfigured, RESUME_MODEL, AtsScoreSchema } from "./ai";
import type { TaxonomyRole } from "./taxonomy";
import type { AtsScoreResult } from "./types";

/** The rules an ATS-friendly resume must follow. Encoded once here so both
 *  the scoring prompt and (eventually) the builder's own checks agree. */
const SYSTEM = `You are an ATS (Applicant Tracking System) compatibility scorer for a career tool. Compare the candidate's resume text against a target job description and return a rigorous, specific assessment as structured data.

Evaluate strictly from the resume text as extracted. Layout signals like columns, tables, or icons must be inferred from how the text extracts (e.g. text that doesn't extract in clean top-to-bottom order suggests a multi-column layout; unicode icon/emoji-like characters suggest graphics); take the charitable reading only when genuinely ambiguous.

Encode exactly these 8 formatting checks, in this order:
1. single_column: the resume extracts in clean top-to-bottom reading order, no interleaved or jumbled text from a multi-column layout
2. standard_headings: sections use standard headings (Experience, Education, Skills, Summary), not creative alternatives an ATS parser won't recognize
3. contact_in_body: contact info (email, phone, location) appears in the main body text, not only in a header/footer that many ATS parsers drop
4. consistent_dates: all dates use one consistent format throughout
5. acronyms_expanded: acronyms are spelled out in full on first use
6. skills_count: the skills section lists at least 10-12 distinct skills
7. metrics_per_role: every role in the experience section has at least one quantified metric
8. no_tables_graphics: no evidence of tables, graphics, icons, or photos interfering with clean text extraction

For keyword matching: extract the JD's must-have keywords (skills, tools, qualifications explicitly required, not nice-to-haves) and check each against the resume, case-insensitively, counting close variants as a match.

Every "detail" field and every suggestion must cite a specific number, keyword, or exact quote, never generic advice. Good suggestion: "Add 'stakeholder management', appears 3 times in the JD, 0 times in your resume." Bad suggestion: "Improve your resume formatting." Do not use em dashes or en dashes anywhere; use commas, colons, or periods instead.`;

export async function scoreResumeAgainstJD(
  resumeText: string,
  jdText: string,
  jdSource: "pasted" | "role",
): Promise<AtsScoreResult | null> {
  if (!isClaudeConfigured()) return null;

  const response = await getClaude().messages.parse({
    model: RESUME_MODEL,
    max_tokens: 8000,
    output_config: {
      effort: "high",
      format: zodOutputFormat(AtsScoreSchema),
    },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `JOB DESCRIPTION:\n${jdText.slice(0, 12000)}\n\nRESUME:\n${resumeText.slice(0, 20000)}`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) return null;

  return { ...parsed, jdSource, scoredAt: new Date().toISOString() };
}

/** Synthesizes plain JD text from a taxonomy role's stored profile. The
 *  taxonomy has no scraped real-world JD text, so this is a deterministic
 *  stand-in built from the role's own description/skills/tools, used when
 *  the user chooses "use my matched role" instead of pasting a real JD. */
export function buildRoleJD(role: TaxonomyRole): string {
  return [
    `${role.title} (${role.category})`,
    "",
    role.description,
    "",
    `Required skills: ${role.skills.join(", ")}.`,
    `Common tools: ${role.tools.join(", ")}.`,
  ].join("\n");
}
