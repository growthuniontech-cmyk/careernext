"use client";

import { useState } from "react";
import type {
  PathStep,
  Progress,
  StepSubmission,
  StepVerificationState,
} from "@/lib/types";

const TIER_LABELS: Record<string, string> = {
  attest: "Quick reflection",
  knowledge: "Knowledge check",
  work: "Submit your work",
  skill: "Portfolio proof",
};

type VerifyResponse = {
  verdict: "pass" | "refine";
  feedback: string;
  progress: Progress;
  jobReadyPercent: number;
};

/** Per-tier submission form. Grading returns pass (step unlocks) or refine
 *  (feedback shown inline, learner revises and resubmits). */
export default function StepVerification({
  stepIndex,
  step,
  prior,
  onVerified,
}: {
  stepIndex: number;
  step: PathStep;
  prior?: StepVerificationState;
  onVerified: (progress: Progress, jobReadyPercent: number) => void;
}) {
  const spec = step.deliverable;
  const [reflection, setReflection] = useState("");
  const [mcqIndex, setMcqIndex] = useState<number | null>(null);
  const [shortAnswer, setShortAnswer] = useState("");
  const [artifact, setArtifact] = useState("");
  const [link, setLink] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(
    prior?.lastVerdict === "refine" ? prior.lastFeedback : null,
  );
  const [error, setError] = useState(false);

  const ready = (() => {
    switch (spec.proof_type) {
      case "attest":
        return reflection.trim().length > 0;
      case "knowledge":
        return (spec.quiz ? mcqIndex !== null : true) && shortAnswer.trim().length > 0;
      case "work":
        return (artifact.trim() || link.trim()) && reasoning.trim().length > 0;
      case "skill":
        return link.trim().length > 0 && reasoning.trim().length > 0;
    }
  })();

  async function submit() {
    setSubmitting(true);
    setError(false);
    const submission: StepSubmission = {};
    if (spec.proof_type === "attest") submission.reflection = reflection;
    if (spec.proof_type === "knowledge") {
      if (mcqIndex !== null) submission.mcqIndex = mcqIndex;
      submission.shortAnswer = shortAnswer;
    }
    if (spec.proof_type === "work") {
      if (artifact.trim()) submission.artifact = artifact;
      if (link.trim()) submission.link = link;
      submission.reasoning = reasoning;
    }
    if (spec.proof_type === "skill") {
      submission.link = link;
      submission.reasoning = reasoning;
    }

    try {
      const res = await fetch("/api/verify-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepIndex, submission }),
      });
      if (!res.ok) throw new Error("verify_failed");
      const data = (await res.json()) as VerifyResponse;
      if (data.verdict === "pass") {
        onVerified(data.progress, data.jobReadyPercent);
      } else {
        setFeedback(data.feedback);
      }
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-charcoal/15 bg-white px-3.5 py-2.5 text-sm text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:border-teal";

  return (
    <div className="mt-4 rounded-xl bg-cream/60 border border-charcoal/10 p-4 space-y-3">
      <p className="text-xs uppercase tracking-widest font-semibold text-indigo/70">
        {TIER_LABELS[spec.proof_type]}, verified before it counts
      </p>

      <ul className="text-xs text-charcoal/60 space-y-1">
        {spec.criteria.map((c) => (
          <li key={c}>✓ {c}</li>
        ))}
      </ul>
      {spec.tool_evidence && (
        <p className="text-xs text-charcoal/60">
          Evidence that helps: <span className="font-medium">{spec.tool_evidence}</span>
        </p>
      )}

      {spec.proof_type === "attest" && (
        <label className="block text-sm text-charcoal/80">
          {spec.anti_gaming_prompt}
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            rows={3}
            placeholder="A few honest sentences about what you did…"
            className={`mt-1.5 ${inputClass}`}
          />
        </label>
      )}

      {spec.proof_type === "knowledge" && (
        <>
          {spec.quiz && (
            <fieldset className="text-sm text-charcoal/80">
              <legend className="mb-1.5">{spec.quiz.scenario}</legend>
              <div className="space-y-1.5">
                {spec.quiz.options.map((option, i) => (
                  <label
                    key={option}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer text-sm ${
                      mcqIndex === i
                        ? "border-teal bg-teal-soft/40"
                        : "border-charcoal/10 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`quiz-${stepIndex}`}
                      checked={mcqIndex === i}
                      onChange={() => setMcqIndex(i)}
                      className="mt-0.5 accent-[#12B886]"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <label className="block text-sm text-charcoal/80">
            {spec.anti_gaming_prompt}
            <textarea
              value={shortAnswer}
              onChange={(e) => setShortAnswer(e.target.value)}
              rows={3}
              placeholder="Answer in your own words…"
              className={`mt-1.5 ${inputClass}`}
            />
          </label>
        </>
      )}

      {(spec.proof_type === "work" || spec.proof_type === "skill") && (
        <>
          {spec.proof_type === "work" && (
            <label className="block text-sm text-charcoal/80">
              Paste your work (or link it below)
              <textarea
                value={artifact}
                onChange={(e) => setArtifact(e.target.value)}
                rows={5}
                placeholder="Paste the deliverable: copy, plan, code, outline…"
                className={`mt-1.5 ${inputClass}`}
              />
            </label>
          )}
          <label className="block text-sm text-charcoal/80">
            {spec.proof_type === "skill" ? "Live link to your project (required)" : "Link (optional)"}
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
              className={`mt-1.5 ${inputClass}`}
            />
          </label>
          <label className="block text-sm text-charcoal/80">
            {spec.anti_gaming_prompt}
            <textarea
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              rows={3}
              placeholder="Why did you do it this way?"
              className={`mt-1.5 ${inputClass}`}
            />
          </label>
        </>
      )}

      {feedback && (
        <div className="rounded-lg bg-gold-soft border border-gold/40 px-3.5 py-3 text-sm text-charcoal/80">
          <p className="font-semibold text-indigo text-xs uppercase tracking-wide mb-1">
            Almost: refine and resubmit
          </p>
          {feedback}
        </div>
      )}
      {error && (
        <p className="text-sm text-coral">
          Something hiccuped while grading. Try submitting again.
        </p>
      )}

      <button
        onClick={submit}
        disabled={!ready || submitting}
        className="w-full rounded-full bg-coral hover:bg-coral-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-5 py-2.5 font-heading font-semibold text-white text-sm"
      >
        {submitting ? "Grading your submission…" : feedback ? "Resubmit for review" : "Submit for verification"}
      </button>
    </div>
  );
}
