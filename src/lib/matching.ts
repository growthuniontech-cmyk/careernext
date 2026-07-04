import type { ParsedResume } from "./types";

/** Deterministic similarity engine between a parsed resume and the role
 *  taxonomy. Weighted token-overlap across skills, tools, titles, and
 *  industry, fast, free, and explainable. Claude adds the personalized
 *  "why this match" reasoning on top of these rankings. */

export type ScorableRole = {
  slug: string;
  title: string;
  category: string;
  skills: string[];
  tools: string[];
  keywords: string[];
};

export type RankedRole = ScorableRole & { score: number };

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s+#./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Two normalized terms match if equal, or one contains the other
 *  (min 4 chars to avoid "r" matching "react"). */
function termsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 4 && b.includes(a)) return true;
  if (b.length >= 4 && a.includes(b)) return true;
  return false;
}

function coverage(candidateTerms: string[], requiredTerms: string[]): number {
  if (requiredTerms.length === 0) return 0;
  const candidates = candidateTerms.map(normalize).filter(Boolean);
  let matched = 0;
  for (const req of requiredTerms.map(normalize)) {
    if (candidates.some((c) => termsMatch(c, req))) matched++;
  }
  return matched / requiredTerms.length;
}

/** Light stemmer so "marketer"/"marketing" and "designs"/"designer" align. */
function stem(word: string): string {
  return word
    .replace(/(ing|ers|er|ed|es)$/g, "")
    .replace(/s$/g, "");
}

function wordJaccard(a: string, b: string): number {
  const wa = new Set(
    normalize(a).split(" ").filter((w) => w.length > 2).map(stem),
  );
  const wb = new Set(
    normalize(b).split(" ").filter((w) => w.length > 2).map(stem),
  );
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter);
}

function titleAffinity(titlesHeld: string[], role: ScorableRole): number {
  const roleTerms = [role.title, ...role.keywords];
  let best = 0;
  for (const held of titlesHeld) {
    for (const rt of roleTerms) {
      const h = normalize(held);
      const r = normalize(rt);
      if (h === r || (h.length >= 5 && r.includes(h)) || (r.length >= 5 && h.includes(r))) {
        return 1;
      }
      best = Math.max(best, wordJaccard(held, rt));
    }
  }
  return best;
}

function industryAffinity(industries: string[], role: ScorableRole): number {
  const roleTerms = [role.category, ...role.keywords].map(normalize);
  for (const ind of industries.map(normalize)) {
    if (!ind) continue;
    if (roleTerms.some((rt) => termsMatch(rt, ind))) return 1;
  }
  return 0;
}

export function scoreRole(resume: ParsedResume, role: ScorableRole): number {
  // Resume skills + tools both count toward the role's skill needs; tools
  // used count toward the role's tool profile.
  const skillCov = coverage(
    [...resume.skills, ...resume.toolsUsed],
    role.skills,
  );
  const toolCov = coverage(
    [...resume.toolsUsed, ...resume.skills],
    role.tools,
  );
  const title = titleAffinity(resume.titlesHeld, role);
  const industry = industryAffinity(resume.industries, role);

  const raw =
    0.5 * skillCov + 0.15 * toolCov + 0.3 * title + 0.05 * industry;

  // Calibration curve (order-preserving): raw overlap systematically
  // understates real transferability, so mid-range fits are lifted while
  // 100% stays out of reach. Ranking is unaffected.
  return Math.round(Math.min(0.97, Math.pow(raw, 0.65)) * 100);
}

export function rankRoles(
  resume: ParsedResume,
  roles: ScorableRole[],
  topN = 5,
): RankedRole[] {
  return roles
    .map((role) => ({ ...role, score: scoreRole(resume, role) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
