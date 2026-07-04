import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const MODEL = "claude-opus-4-8";

// Rubric/spec generation is offline + cached per role — use the strongest model.
export const RUBRIC_MODEL = "claude-opus-4-8";

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
export function getClaude(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

// ---------- Structured output schemas ----------

export const ParsedResumeSchema = z.object({
  skills: z
    .array(z.string())
    .describe("Up to 15 career-relevant skills, including transferable ones"),
  titlesHeld: z
    .array(z.string())
    .describe("Job titles this person has actually held, most recent first"),
  yearsExperience: z
    .number()
    .describe("Total years of professional experience; 0 for freshers"),
  toolsUsed: z
    .array(z.string())
    .describe("Software, platforms, and tools they have used"),
  industries: z
    .array(z.string())
    .describe("Industries they have worked in, e.g. 'ecommerce', 'healthcare'"),
  education: z
    .array(z.string())
    .describe("Degrees/certifications, e.g. 'B.Tech Computer Science, 2023'"),
  summary: z
    .string()
    .describe("2-3 sentence professional summary of background and strengths"),
});

export const MatchReasonsSchema = z.object({
  reasons: z.array(
    z.object({
      roleSlug: z.string().describe("The role slug exactly as given"),
      reason: z
        .string()
        .describe(
          "One warm, specific sentence explaining the fit, referencing this person's actual background",
        ),
    }),
  ),
});

export const ToolkitSchema = z.object({
  tools: z
    .array(
      z.object({
        name: z
          .string()
          .describe("Tool name, exactly as it appears in the candidate list"),
        tier: z
          .enum(["high", "medium"])
          .describe("high = daily driver for this role, medium = weekly support tool"),
        reason: z
          .string()
          .describe(
            "One line tying the tool to a real task in this job AND this person's specific gap or strength",
          ),
      }),
    )
    .describe("6-8 tools total: 3-4 high tier, 3-4 medium tier"),
});

/** Per-step deliverable spec fields generated from step data. proof_type and
 *  pass_threshold are NOT generated — the deterministic classifier assigns
 *  those (src/lib/verification.ts). */
export const SpecsSchema = z.object({
  specs: z
    .array(
      z.object({
        criteria: z
          .array(z.string())
          .describe(
            "2-4 acceptance criteria — concrete things a passing submission must contain or demonstrate",
          ),
        tool_evidence: z
          .string()
          .nullable()
          .describe(
            'Specific tool output that would evidence real work, e.g. "Ahrefs/Semrush screenshot" — null if no tool evidence applies',
          ),
        anti_gaming_prompt: z
          .string()
          .describe(
            'A "why did you do it this way" reasoning question that is hard to answer without having done the work',
          ),
        quiz: z.object({
          scenario: z
            .string()
            .describe(
              "A realistic on-the-job scenario question testing this step's concept",
            ),
          options: z
            .array(z.string())
            .describe("Exactly 4 answer options, one clearly best"),
          correctIndex: z
            .number()
            .describe("0-based index of the best option"),
        }),
      }),
    )
    .describe("One spec per step, in the same order as the steps given"),
});

/** Runtime grading: four universal dimensions, each 0-1, plus feedback. */
export const GradeSchema = z.object({
  authenticity: z
    .number()
    .describe("0-1: is this plausibly real work by this person, not fabricated or generic filler?"),
  completeness: z
    .number()
    .describe("0-1: how fully does the submission cover the acceptance criteria?"),
  correctness: z
    .number()
    .describe("0-1: is the work/answer actually right for this step?"),
  reasoning: z
    .number()
    .describe("0-1: does their reasoning show they understand WHY, not just what?"),
  feedback: z
    .string()
    .describe(
      "2-4 sentences of specific, actionable improvement feedback tied to the criteria — the feedback is the value, not just the gate",
    ),
});

export const PathSchema = z.object({
  steps: z
    .array(
      z.object({
        title: z.string(),
        description: z
          .string()
          .describe("1-2 sentences on what this step covers and why it comes now"),
        estimatedHours: z.number().describe("Total hours to complete"),
        unlocks: z
          .string()
          .describe("Concrete milestone completing this unlocks"),
      }),
    )
    .describe("Exactly 5 sequenced steps, early wins first, ending in a portfolio-grade project"),
});
