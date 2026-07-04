import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const MODEL = "claude-opus-4-8";

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
