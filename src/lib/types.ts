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

export type PathStep = {
  title: string;
  description: string;
  estimatedHours: number;
  unlocks: string;
};

export type Progress = {
  completedSteps: number[]; // indices into the 5-step path
  streak: number;
  lastCompletedDate: string | null; // YYYY-MM-DD
};

/** Shape of journeys.data jsonb — one row per user. */
export type JourneyData = {
  matches?: JobMatch[];
  selectedRoleSlug?: string;
  selectedTitle?: string;
  toolkit?: ToolkitTool[];
  progress?: Progress;
};

/** Everything a flow page needs, served by GET /api/journey. */
export type JourneyView = JourneyData & {
  hasResume: boolean;
  resumeSummary?: string;
  pathSteps?: PathStep[];
  jobReadyPercent: number; // single source of truth: completed ÷ total steps
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
