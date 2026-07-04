import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClaude, GradeSchema } from "./ai";
import { gradingModelFor, verdictFrom } from "./verification";
import type {
  DeliverableSpec,
  GradeScores,
  StepSubmission,
} from "./types";

/** Grades a submission against the cached spec on four universal dimensions.
 *  Routing: work/skill → claude-sonnet-5; knowledge/attest → haiku.
 *  Only a pass verdict unlocks the step. */

export type GradeResult = {
  verdict: "pass" | "refine";
  scores: GradeScores;
  feedback: string;
};

const SYSTEM = `You are the verification grader for a career-learning platform. A learner submitted proof of completing a learning step. Score it 0-1 on four dimensions: authenticity (is it plausibly their real work; generic, copy-pasted, or fabricated submissions score low), completeness (does it cover the acceptance criteria), correctness (is it right), reasoning (do they understand why they did what they did). Be fair to beginners (early steps expect beginner-level work) but never reward effort-free submissions: if a submission is a single word, a throwaway phrase, or contains no specifics that could only come from doing the work, score every dimension below 0.3. Your feedback must be specific and actionable: name what's missing against the criteria and what to improve, in an encouraging tone. Do not use em dashes or en dashes in your feedback; use commas, colons, or periods instead.`;

export async function gradeSubmission(
  step: { title: string; description: string },
  spec: DeliverableSpec,
  submission: StepSubmission,
): Promise<GradeResult> {
  const parts: string[] = [
    `Step: ${step.title}`,
    `What the step covers: ${step.description}`,
    `Proof tier: ${spec.proof_type}`,
    `Acceptance criteria:\n${spec.criteria.map((c) => `- ${c}`).join("\n")}`,
  ];
  if (spec.tool_evidence) {
    parts.push(`Expected tool evidence: ${spec.tool_evidence}`);
  }

  if (spec.quiz && typeof spec.quiz.correctIndex === "number") {
    const picked = submission.mcqIndex ?? -1;
    const mcqCorrect = picked === spec.quiz.correctIndex;
    parts.push(
      `Scenario question: ${spec.quiz.scenario}`,
      `They picked: "${spec.quiz.options[picked] ?? "(no answer)"}", which is ${mcqCorrect ? "the CORRECT" : "an INCORRECT"} answer (verified programmatically; factor into correctness).`,
    );
  }

  parts.push(`Reasoning question asked: ${spec.anti_gaming_prompt}`);
  parts.push("--- Learner submission ---");
  if (submission.reflection) parts.push(`Reflection: ${submission.reflection}`);
  if (submission.shortAnswer) parts.push(`Short answer: ${submission.shortAnswer}`);
  if (submission.artifact) parts.push(`Artifact (pasted):\n${submission.artifact}`);
  if (submission.link) parts.push(`Link: ${submission.link}`);
  if (submission.reasoning) parts.push(`Their reasoning: ${submission.reasoning}`);

  const model = gradingModelFor(spec.proof_type);
  const response = await getClaude().messages.parse({
    model,
    max_tokens: 1500,
    output_config: {
      // effort is unsupported on haiku-4-5, only pass it for the sonnet grader
      ...(model === "claude-sonnet-5" ? { effort: "medium" as const } : {}),
      format: zodOutputFormat(GradeSchema),
    },
    system: SYSTEM,
    messages: [{ role: "user", content: parts.join("\n\n") }],
  });

  const graded = response.parsed_output;
  if (!graded) throw new Error("grading returned no parsed output");

  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const scores: GradeScores = {
    authenticity: clamp(graded.authenticity),
    completeness: clamp(graded.completeness),
    correctness: clamp(graded.correctness),
    reasoning: clamp(graded.reasoning),
  };

  return {
    verdict: verdictFrom(scores, spec.pass_threshold),
    scores,
    feedback: graded.feedback,
  };
}
