import type {
  DeliverableSpec,
  GradeScores,
  PathStep,
  ProofType,
  StepSubmission,
} from "./types";

/** The generated-verification engine: classifies steps into proof tiers,
 *  builds deterministic fallback specs, migrates legacy cached steps, and
 *  decides pass/refine from grade scores. Pure functions (no I/O). */

const WORK_VERBS =
  /\b(build|builds|building|deliver|create|creates|creating|publish|produce|develop|design|write|draft|launch|ship|record|assemble|set up|implement|make)\b/i;
const KNOWLEDGE_VERBS =
  /\b(learn|understand|know|study|grasp|master|explore the (concepts|fundamentals)|get familiar)\b/i;
const EXPOSURE_VERBS = /\b(explore|browse|watch|read|review|discover|try out|sign up)\b/i;

/** Tier gates: concept steps soft-gate, work steps hard-gate, the final
 *  portfolio step absolute-gates. Encoded as pass thresholds. */
export const TIER_THRESHOLDS: Record<ProofType, number> = {
  attest: 0.5,
  knowledge: 0.6,
  work: 0.75,
  skill: 0.85,
};

/** Classify a step's proof tier from its verbs. The final step of a path is
 *  always the portfolio (skill) step; work verbs outrank knowledge verbs
 *  because an artifact is stronger evidence than recall. */
export function classifyProofType(
  step: { title: string; description: string },
  index: number,
  totalSteps: number,
): ProofType {
  if (index === totalSteps - 1) return "skill";
  const title = step.title;
  if (WORK_VERBS.test(title)) return "work";
  if (KNOWLEDGE_VERBS.test(title)) return "knowledge";
  const text = `${step.title} ${step.description}`;
  if (WORK_VERBS.test(text)) return "work";
  if (KNOWLEDGE_VERBS.test(text)) return "knowledge";
  if (EXPOSURE_VERBS.test(text)) return "attest";
  return "attest";
}

/** Grading model routing: work/skill artifacts need the stronger grader. */
export function gradingModelFor(proofType: ProofType): string {
  return proofType === "work" || proofType === "skill"
    ? "claude-sonnet-5"
    : "claude-haiku-4-5-20251001";
}

/** Deterministic spec built from step data alone, used when the rubric
 *  generator is unavailable, and by the schema-migration tests. */
export function buildFallbackSpec(
  step: { title: string; description: string; unlocks?: string },
  index: number,
  totalSteps: number,
): DeliverableSpec {
  const proofType = classifyProofType(step, index, totalSteps);
  const milestone = step.unlocks?.trim() || step.title;
  const criteria = [
    `Demonstrates the milestone: ${milestone}`,
    `Covers what the step teaches: ${step.description}`,
  ];
  if (proofType === "skill") {
    criteria.push("Includes a live, publicly reachable link to the finished work");
  }
  return {
    proof_type: proofType,
    criteria,
    pass_threshold: TIER_THRESHOLDS[proofType],
    tool_evidence: null,
    anti_gaming_prompt: `Walk through how you approached "${step.title}": what decisions did you make along the way, and why did you make them that way?`,
    review: "pending",
  };
}

/** Migrate a legacy cached step ({...unlocks}) to the structured shape.
 *  Keeps the unlocks string for old clients still rendering it. */
export function migrateStep(
  step: { title: string; description: string; estimatedHours: number; unlocks?: string },
  index: number,
  totalSteps: number,
): PathStep {
  return {
    title: step.title,
    description: step.description,
    estimatedHours: step.estimatedHours,
    unlocks: step.unlocks,
    deliverable: buildFallbackSpec(step, index, totalSteps),
  };
}

export function stepsHaveSpecs(steps: unknown[]): boolean {
  return (
    steps.length > 0 &&
    steps.every(
      (s) => typeof s === "object" && s !== null && "deliverable" in s,
    )
  );
}

/** Strip server-only fields (the MCQ answer) before sending steps to the client. */
export function sanitizeStepsForClient(steps: PathStep[]): PathStep[] {
  return steps.map((step) => {
    const quiz = step.deliverable?.quiz;
    if (!quiz) return step;
    return {
      ...step,
      deliverable: {
        ...step.deliverable,
        quiz: { scenario: quiz.scenario, options: quiz.options },
      },
    };
  });
}

/** Boundary validation: does the submission carry what this tier requires? */
export function submissionError(
  spec: DeliverableSpec,
  submission: StepSubmission,
): string | null {
  switch (spec.proof_type) {
    case "attest":
      return submission.reflection?.trim() ? null : "reflection_required";
    case "knowledge":
      if (spec.quiz && typeof submission.mcqIndex !== "number") return "answer_required";
      return submission.shortAnswer?.trim() ? null : "answer_required";
    case "work":
      if (!submission.artifact?.trim() && !submission.link?.trim()) return "artifact_required";
      return submission.reasoning?.trim() ? null : "reasoning_required";
    case "skill": {
      if (!submission.link?.trim() || !isValidUrl(submission.link)) return "live_link_required";
      return submission.reasoning?.trim() ? null : "reasoning_required";
    }
  }
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** The one pass rule: average of the four dimensions clears the tier
 *  threshold AND the work is plausibly real (authenticity floor). */
export function verdictFrom(
  scores: GradeScores,
  passThreshold: number,
): "pass" | "refine" {
  const overall =
    (scores.authenticity + scores.completeness + scores.correctness + scores.reasoning) / 4;
  return overall >= passThreshold && scores.authenticity >= 0.5 ? "pass" : "refine";
}
