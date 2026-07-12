export type ParsedResume = {
  skills: string[];
  titlesHeld: string[];
  yearsExperience: number;
  toolsUsed: string[];
  industries: string[];
  education: string[];
  summary: string;
};

export type Role = {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  skills: string[];
  tools: string[];
  keywords: string[];
};

export type JobMatch = {
  roleSlug: string;
  title: string;
  score: number; // 0-100
  reason: string; // personalized, plain-English
};

export type ToolkitTool = {
  name: string;
  tier: "high" | "medium";
  reason: string; // tied to this user's resume gaps
  url?: string;
};

export type ProofType = "attest" | "knowledge" | "work" | "skill";

/** Scenario MCQ attached to knowledge-tier specs. correctIndex is stripped
 *  before steps are sent to the client; only the server grades it. */
export type SpecQuiz = {
  scenario: string;
  options: string[];
  correctIndex?: number;
};

/** Structured deliverable spec, generated once per canonical step and cached
 *  in role_paths. Replaces the old free-text "unlocks" string. */
export type DeliverableSpec = {
  proof_type: ProofType;
  criteria: string[];
  pass_threshold: number; // 0-1, set by tier: attest/knowledge soft, work hard, skill absolute
  tool_evidence: string | null;
  anti_gaming_prompt: string;
  quiz?: SpecQuiz; // knowledge steps only
  review: "pending" | "approved"; // human-approval flag for generated specs
};

export type PathStep = {
  title: string;
  description: string;
  estimatedHours: number;
  deliverable: DeliverableSpec;
  /** @deprecated legacy display string kept in cached rows so not-yet-updated
   *  clients keep rendering; new code reads `deliverable`. */
  unlocks?: string;
};

/** What a user submits to verify a step; fields vary by proof_type. */
export type StepSubmission = {
  reflection?: string; // attest
  mcqIndex?: number; // knowledge
  shortAnswer?: string; // knowledge
  artifact?: string; // work: pasted artifact text
  link?: string; // work (optional) / skill (required live link)
  reasoning?: string; // work + skill: answer to anti_gaming_prompt
};

export type GradeScores = {
  authenticity: number;
  completeness: number;
  correctness: number;
  reasoning: number;
};

export type StepVerificationState = {
  attempts: number;
  lastVerdict: "pass" | "refine";
  lastFeedback: string;
  scores: GradeScores;
  verifiedAt?: string; // ISO timestamp, set on pass
};

export type Progress = {
  completedSteps: number[]; // indices into the 5-step path
  streak: number;
  lastCompletedDate: string | null; // YYYY-MM-DD
};

/** Shape of journeys.data jsonb, one row per user. */
export type JourneyData = {
  matches?: JobMatch[];
  selectedRoleSlug?: string;
  selectedTitle?: string;
  toolkit?: ToolkitTool[];
  progress?: Progress;
  /** Per-step verification state, keyed by String(stepIndex). */
  verifications?: Record<string, StepVerificationState>;
};

/** Everything a flow page needs, served by GET /api/journey. */
export type JourneyView = JourneyData & {
  hasResume: boolean;
  resumeSummary?: string;
  pathSteps?: PathStep[];
  jobReadyPercent: number; // single source of truth: completed ÷ total steps
};

// ============ Phase 2: ATS scoring ============

export type AtsFormattingFlag = {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
};

export type AtsSectionCheck = {
  section: string;
  present: boolean;
  detail: string;
};

export type AtsScoreResult = {
  overallScore: number; // 0-100
  keywordMatchPercent: number; // 0-100
  matchedKeywords: string[];
  missingKeywords: string[]; // must-have JD keywords absent from the resume
  formattingFlags: AtsFormattingFlag[];
  sectionCompleteness: AtsSectionCheck[];
  suggestions: string[]; // specific, actionable, never generic
  jdSource: "pasted" | "role";
  scoredAt: string; // ISO timestamp
};

// ============ Phase 2: guided resume builder ============

export type ExperienceLevel = "fresher" | "experienced";

export type ExperienceEntry = {
  id: string;
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string; // "Present" allowed
  /** Guided input, captured before AI rewriting is offered. */
  challenge: string;
  change: string;
  metric: string;
  /** Final bullets shown on the resume: user edits or AI rewrite output. */
  bullets: string[];
};

export type EducationEntry = {
  id: string;
  degree: string;
  school: string;
  year: string;
};

export type BuilderHeader = {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  portfolio: string;
};

export type BuilderSections = {
  experienceLevel: ExperienceLevel;
  header: BuilderHeader;
  summary: string;
  coreCompetencies: string[];
  experience: ExperienceEntry[];
  awards: string[];
  education: EducationEntry[];
  certifications: string[];
  memberships: string[];
  publications: string[];
  volunteer: string[];
};

export type BuilderResume = {
  sections: BuilderSections;
  jdText: string | null;
  atsScore: AtsScoreResult | null;
  updatedAt: string | null;
};

export const EMPTY_BUILDER_SECTIONS: BuilderSections = {
  experienceLevel: "experienced",
  header: {
    name: "",
    title: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    portfolio: "",
  },
  summary: "",
  coreCompetencies: [],
  experience: [],
  awards: [],
  education: [],
  certifications: [],
  memberships: [],
  publications: [],
  volunteer: [],
};

/** The one job-ready formula, used everywhere the number appears. */
export function computeJobReadyPercent(
  completedSteps: number[] | undefined,
  totalSteps: number | undefined,
): number {
  if (!totalSteps || totalSteps === 0) return 0;
  const done = new Set(completedSteps ?? []).size;
  return Math.round((Math.min(done, totalSteps) / totalSteps) * 100);
}
