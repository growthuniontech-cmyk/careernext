/** Unit tests for the verification engine (no network):
 *  - tier classifier assignment from step verbs
 *  - schema migration: legacy {unlocks} steps → structured deliverable specs
 *  - client sanitization (MCQ answer never leaves the server)
 *  - submission boundary validation + the pass/refine verdict rule
 *
 *  Run from careernext/:  npx tsx scripts/test-verification.ts
 */
import {
  classifyProofType,
  buildFallbackSpec,
  migrateStep,
  stepsHaveSpecs,
  sanitizeStepsForClient,
  submissionError,
  verdictFrom,
  gradingModelFor,
  TIER_THRESHOLDS,
} from "../src/lib/verification";
import type { PathStep } from "../src/lib/types";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok — ${name}`);
  else {
    failures++;
    console.error(`  FAIL — ${name} ${detail}`);
  }
}

// ---- 1. Classifier assignment ----
console.log("\n[1] Tier classifier");
const mk = (title: string, description = "") => ({ title, description });

check(
  "learn/understand → knowledge",
  classifyProofType(mk("Learn SEO Fundamentals"), 0, 5) === "knowledge",
);
check(
  "understand in description → knowledge",
  classifyProofType(mk("SEO Foundations", "Understand how search engines rank pages"), 1, 5) ===
    "knowledge",
);
check(
  "build → work",
  classifyProofType(mk("Build a Content Calendar"), 1, 5) === "work",
);
check(
  "create/publish → work",
  classifyProofType(mk("Create and Publish Your First Campaign"), 2, 5) === "work",
);
check(
  "work verbs outrank knowledge verbs",
  classifyProofType(mk("Learn by Building a Landing Page"), 1, 5) === "work",
);
check(
  "final step → skill regardless of verbs",
  classifyProofType(mk("Learn Advanced Topics"), 4, 5) === "skill",
);
check(
  "pure exposure → attest",
  classifyProofType(mk("Explore the Modern Marketing Stack", "Browse the tools professionals use daily"), 0, 5) ===
    "attest",
);

// ---- 2. Gate thresholds + model routing ----
console.log("\n[2] Gates and model routing");
check("attest soft-gates below knowledge", TIER_THRESHOLDS.attest < TIER_THRESHOLDS.knowledge);
check("knowledge soft < work hard", TIER_THRESHOLDS.knowledge < TIER_THRESHOLDS.work);
check("work hard < skill absolute", TIER_THRESHOLDS.work < TIER_THRESHOLDS.skill);
check("work grades on sonnet", gradingModelFor("work") === "claude-sonnet-5");
check("skill grades on sonnet", gradingModelFor("skill") === "claude-sonnet-5");
check("knowledge grades on haiku", gradingModelFor("knowledge") === "claude-haiku-4-5-20251001");
check("attest grades on haiku", gradingModelFor("attest") === "claude-haiku-4-5-20251001");

// ---- 3. Schema migration: legacy unlocks → deliverable ----
console.log("\n[3] Schema migration");
const legacy = [
  { title: "Learn Email Marketing Basics", description: "Understand list building and segmentation", estimatedHours: 6, unlocks: "You can explain a welcome flow" },
  { title: "Build a 3-Email Welcome Sequence", description: "Write and structure a real sequence", estimatedHours: 8, unlocks: "A sequence you could ship" },
  { title: "Portfolio Campaign", description: "End-to-end campaign that proves it all", estimatedHours: 12, unlocks: "A live portfolio piece" },
];
check("legacy steps detected as spec-less", !stepsHaveSpecs(legacy));
const migrated = legacy.map((s, i) => migrateStep(s, i, legacy.length));
check("migrated steps have specs", stepsHaveSpecs(migrated));
check(
  "migration classified tiers",
  migrated[0].deliverable.proof_type === "knowledge" &&
    migrated[1].deliverable.proof_type === "work" &&
    migrated[2].deliverable.proof_type === "skill",
  JSON.stringify(migrated.map((m) => m.deliverable.proof_type)),
);
check(
  "thresholds match tiers",
  migrated.every((m) => m.deliverable.pass_threshold === TIER_THRESHOLDS[m.deliverable.proof_type]),
);
check(
  "criteria derived from the unlocks milestone",
  migrated[1].deliverable.criteria.some((c) => c.includes("A sequence you could ship")),
);
check(
  "anti-gaming prompt present on every spec",
  migrated.every((m) => m.deliverable.anti_gaming_prompt.length > 10),
);
check(
  "generated specs start pending review",
  migrated.every((m) => m.deliverable.review === "pending"),
);
check("legacy unlocks preserved for old clients", migrated[0].unlocks === legacy[0].unlocks);

// ---- 4. Client sanitization ----
console.log("\n[4] Client sanitization");
const withQuiz: PathStep[] = [
  {
    ...migrated[0],
    deliverable: {
      ...migrated[0].deliverable,
      quiz: { scenario: "Pick one", options: ["a", "b", "c", "d"], correctIndex: 2 },
    },
  },
];
const sanitized = sanitizeStepsForClient(withQuiz);
check("correctIndex stripped for the client", sanitized[0].deliverable.quiz?.correctIndex === undefined);
check("quiz scenario/options kept", sanitized[0].deliverable.quiz?.options.length === 4);
check("server copy untouched", withQuiz[0].deliverable.quiz?.correctIndex === 2);

// ---- 5. Submission validation ----
console.log("\n[5] Submission boundary validation");
const attest = buildFallbackSpec(mk("Explore Tools", "Browse the stack"), 0, 5);
const work = buildFallbackSpec(mk("Build a Thing"), 1, 5);
const skill = buildFallbackSpec(mk("Portfolio"), 4, 5);
check("attest requires reflection", submissionError(attest, {}) === "reflection_required");
check("attest accepts reflection", submissionError(attest, { reflection: "I did it" }) === null);
check("work requires artifact or link", submissionError(work, { reasoning: "because" }) === "artifact_required");
check("work requires reasoning", submissionError(work, { artifact: "the thing" }) === "reasoning_required");
check("work accepts artifact + reasoning", submissionError(work, { artifact: "x", reasoning: "y" }) === null);
check("skill rejects missing link", submissionError(skill, { reasoning: "y" }) === "live_link_required");
check("skill rejects non-URL link", submissionError(skill, { link: "not a url", reasoning: "y" }) === "live_link_required");
check("skill accepts live link", submissionError(skill, { link: "https://example.com/p", reasoning: "y" }) === null);

// ---- 6. Verdict rule ----
console.log("\n[6] Pass/refine verdict");
const good = { authenticity: 0.9, completeness: 0.8, correctness: 0.8, reasoning: 0.7 };
const weak = { authenticity: 0.9, completeness: 0.4, correctness: 0.4, reasoning: 0.3 };
const fake = { authenticity: 0.2, completeness: 1, correctness: 1, reasoning: 1 };
check("strong submission passes work gate", verdictFrom(good, TIER_THRESHOLDS.work) === "pass");
check("weak submission refines", verdictFrom(weak, TIER_THRESHOLDS.knowledge) === "refine");
check("high scores can't launder fake work (authenticity floor)", verdictFrom(fake, TIER_THRESHOLDS.work) === "refine");

console.log(
  failures === 0 ? "\nAll verification unit checks passed." : `\n${failures} check(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
