/** Sanity tests for the taxonomy + matching engine (no network needed):
 *    npx tsx scripts/test-matching.ts
 */
import { TAXONOMY } from "../src/lib/taxonomy";
import { rankRoles } from "../src/lib/matching";
import type { ParsedResume } from "../src/lib/types";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  ok — ${name}`);
  } else {
    failures++;
    console.error(`  FAIL — ${name} ${detail}`);
  }
}

// --- Taxonomy integrity ---
console.log(`Taxonomy: ${TAXONOMY.length} roles`);
check("100-150 roles", TAXONOMY.length >= 100 && TAXONOMY.length <= 150, `got ${TAXONOMY.length}`);
const slugs = new Set(TAXONOMY.map((r) => r.slug));
check("slugs unique", slugs.size === TAXONOMY.length);
check(
  "every role has skills/tools/keywords",
  TAXONOMY.every((r) => r.skills.length >= 5 && r.tools.length >= 3 && r.keywords.length >= 1),
);

// --- Matching sanity ---
const marketer: ParsedResume = {
  skills: ["content writing", "social media management", "email campaigns", "Google Analytics", "SEO", "copywriting"],
  titlesHeld: ["Marketing Coordinator"],
  yearsExperience: 2,
  toolsUsed: ["Canva", "Mailchimp", "Google Analytics", "Excel"],
  industries: ["ecommerce"],
  education: ["BA Communications"],
  summary: "Early-career marketer.",
};

const developer: ParsedResume = {
  skills: ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "REST APIs", "Git", "testing"],
  titlesHeld: ["Software Engineer", "Full Stack Developer"],
  yearsExperience: 4,
  toolsUsed: ["GitHub", "Docker", "Postman", "VS Code"],
  industries: ["fintech"],
  education: ["B.Tech Computer Science"],
  summary: "Full-stack developer.",
};

const fresherAccountant: ParsedResume = {
  skills: ["accounting", "Excel", "reconciliations", "attention to detail", "GAAP"],
  titlesHeld: ["Commerce Graduate"],
  yearsExperience: 0,
  toolsUsed: ["Excel", "Tally"],
  industries: [],
  education: ["B.Com Accounting, 2025"],
  summary: "Fresher with an accounting degree.",
};

function topTitles(resume: ParsedResume) {
  return rankRoles(resume, TAXONOMY, 5).map((r) => `${r.title} (${r.score}%)`);
}

const mTop = rankRoles(marketer, TAXONOMY, 5);
console.log("\nMarketer top 5:", topTitles(marketer).join(", "));
check(
  "marketer matches marketing roles",
  mTop.filter((r) => r.category === "Marketing").length >= 3,
);
check("marketer top score is meaningful", mTop[0].score >= 50, `got ${mTop[0].score}`);

const dTop = rankRoles(developer, TAXONOMY, 5);
console.log("\nDeveloper top 5:", topTitles(developer).join(", "));
check(
  "developer matches software roles",
  dTop.filter((r) => r.category === "Software & Data").length >= 3,
);
check(
  "developer's #1 is a dev role",
  /developer|engineer/i.test(dTop[0].title),
  `got ${dTop[0].title}`,
);

const aTop = rankRoles(fresherAccountant, TAXONOMY, 5);
console.log("\nFresher accountant top 5:", topTitles(fresherAccountant).join(", "));
check(
  "fresher accountant matches finance roles",
  aTop.filter((r) => r.category === "Finance").length >= 2,
);

// Distinct users get distinct results
check(
  "different resumes produce different rankings",
  mTop[0].slug !== dTop[0].slug && dTop[0].slug !== aTop[0].slug,
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
