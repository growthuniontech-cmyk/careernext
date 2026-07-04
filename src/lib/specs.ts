import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClaude, isClaudeConfigured, RUBRIC_MODEL, SpecsSchema } from "./ai";
import {
  buildFallbackSpec,
  classifyProofType,
  TIER_THRESHOLDS,
} from "./verification";
import type { PathStep } from "./types";

/** Attaches a generated DeliverableSpec to each step. Works for both freshly
 *  generated paths and legacy cached steps (schema migration); the spec is
 *  generated from the same step data either way, then cached in role_paths so
 *  every user targeting the role reuses it. Falls back to deterministic specs
 *  if the rubric model is unavailable. */

type RawStep = {
  title: string;
  description: string;
  estimatedHours: number;
  unlocks?: string;
};

const SYSTEM = `You write verification rubrics for career-path learning steps. For each step you receive, produce the acceptance criteria a submission must meet to prove the step was genuinely completed, the tool evidence (if any real tool output would prove the work), a reasoning question that is hard to answer without having done the work, and a scenario MCQ testing the concept on the job. Be concrete and checkable; a grader will score submissions against your criteria. Do not use em dashes or en dashes anywhere in your output; use commas, colons, or periods instead.`;

export async function generateDeliverables(
  roleTitle: string,
  steps: RawStep[],
): Promise<PathStep[]> {
  const fallback = () =>
    steps.map((s, i) => ({
      ...s,
      deliverable: buildFallbackSpec(s, i, steps.length),
    }));

  if (!isClaudeConfigured()) return fallback();

  try {
    const response = await getClaude().messages.parse({
      model: RUBRIC_MODEL,
      max_tokens: 6000,
      output_config: {
        effort: "medium",
        format: zodOutputFormat(SpecsSchema),
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Target role: ${roleTitle}\n\nSteps:\n${steps
            .map(
              (s, i) =>
                `${i + 1}. ${s.title}\n   What it covers: ${s.description}\n   Milestone: ${s.unlocks ?? s.title}`,
            )
            .join("\n")}`,
        },
      ],
    });

    const specs = response.parsed_output?.specs;
    if (!specs || specs.length !== steps.length) return fallback();

    return steps.map((step, i) => {
      const proofType = classifyProofType(step, i, steps.length);
      const generated = specs[i];
      return {
        ...step,
        deliverable: {
          proof_type: proofType,
          criteria: generated.criteria,
          pass_threshold: TIER_THRESHOLDS[proofType],
          tool_evidence: generated.tool_evidence,
          anti_gaming_prompt: generated.anti_gaming_prompt,
          // The scenario MCQ only gates knowledge-tier steps
          ...(proofType === "knowledge" ? { quiz: generated.quiz } : {}),
          review: "pending" as const,
        },
      };
    });
  } catch (err) {
    console.error("spec generation failed, using fallback specs:", err);
    return fallback();
  }
}
