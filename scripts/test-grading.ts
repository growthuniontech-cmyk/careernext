/** Live grading round-trip: for each proof tier, one genuine submission that
 *  should PASS and one lazy/fake submission that should REFINE. Hits the real
 *  Anthropic API with the production model routing (sonnet for work/skill,
 *  haiku for knowledge/attest).
 *
 *  Run from careernext/:  npx tsx scripts/test-grading.ts
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { gradeSubmission } from "../src/lib/grading";
import { TIER_THRESHOLDS } from "../src/lib/verification";
import type { DeliverableSpec, StepSubmission } from "../src/lib/types";

const envPath = path.join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY missing — cannot run grading round-trips.");
  process.exit(1);
}

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok — ${name}`);
  else {
    failures++;
    console.error(`  FAIL — ${name} ${detail}`);
  }
}

const spec = (over: Partial<DeliverableSpec>): DeliverableSpec => ({
  proof_type: "attest",
  criteria: [],
  pass_threshold: 0.5,
  tool_evidence: null,
  anti_gaming_prompt: "Why did you approach it this way?",
  review: "pending",
  ...over,
});

type Case = {
  tier: string;
  step: { title: string; description: string };
  spec: DeliverableSpec;
  pass: StepSubmission;
  refine: StepSubmission;
};

const cases: Case[] = [
  {
    tier: "attest",
    step: {
      title: "Explore the Modern Email Marketing Stack",
      description: "Browse the tools email marketers use daily and see what each is for.",
    },
    spec: spec({
      proof_type: "attest",
      criteria: [
        "Names at least two tools they actually looked at",
        "Says something specific about what stood out",
      ],
      pass_threshold: TIER_THRESHOLDS.attest,
      anti_gaming_prompt: "What surprised you about the tools you explored?",
    }),
    pass: {
      reflection:
        "I spent an evening in Mailchimp and Klaviyo trials. What surprised me was how much of Klaviyo is really a segmentation engine — the flows UI kept pushing me to branch on behavior (opened but didn't click, viewed product twice) rather than blast everyone. Mailchimp felt simpler but its automation is clearly bolted on. I also poked at MailerLite because a friend uses it; its editor is nicer but reporting is thin.",
    },
    refine: { reflection: "done" },
  },
  {
    tier: "knowledge",
    step: {
      title: "Learn Email List Segmentation",
      description: "Understand how and why lists are segmented before sending campaigns.",
    },
    spec: spec({
      proof_type: "knowledge",
      criteria: [
        "Explains why segmentation beats batch-and-blast",
        "Gives a concrete segmentation example",
      ],
      pass_threshold: TIER_THRESHOLDS.knowledge,
      anti_gaming_prompt: "In your own words: when would you NOT segment a list?",
      quiz: {
        scenario:
          "A skincare brand's welcome emails get 40% opens but sales emails to the same full list get 8% opens and rising unsubscribes. What should they try first?",
        options: [
          "Send the sales emails more often so more people see them",
          "Segment the list by engagement and purchase history and tailor sends",
          "Buy a fresh email list to replace unengaged subscribers",
          "Shorten every subject line to one word",
        ],
        correctIndex: 1,
      },
    }),
    pass: {
      mcqIndex: 1,
      shortAnswer:
        "I'd skip segmentation when the message genuinely applies to everyone and timing matters more than relevance — say a shipping-delay notice or a policy change. Also early on, when the list is tiny (a few hundred people), the data is too thin for segments to mean anything; better to send one good email and learn from replies.",
    },
    refine: { mcqIndex: 0, shortAnswer: "you should always segment i guess" },
  },
  {
    tier: "work",
    step: {
      title: "Build a 3-Email Welcome Sequence",
      description: "Write a real welcome sequence for a brand, with goals per email.",
    },
    spec: spec({
      proof_type: "work",
      criteria: [
        "Three distinct emails with a clear goal each",
        "Subject lines included",
        "A deliberate send-timing choice",
      ],
      pass_threshold: TIER_THRESHOLDS.work,
      anti_gaming_prompt: "Why did you order and time the emails the way you did?",
    }),
    pass: {
      artifact: `Welcome sequence for GlowCart (D2C skincare):
Email 1 — send immediately. Subject: "You're in — here's your 10% code". Goal: deliver the signup incentive while intent is hot, set expectations (2 emails/week max). CTA: shop bestsellers.
Email 2 — send day 2. Subject: "The 3-step routine our customers swear by". Goal: education, not selling — routine guide featuring one hero product per step, social proof from 2 reviews. CTA: read the full guide.
Email 3 — send day 5. Subject: "Your 10% code expires Sunday". Goal: convert with urgency; only sent to non-purchasers (purchasers branch into a post-purchase flow). CTA: checkout with code.`,
      reasoning:
        "Email 1 goes instantly because discount-driven signups convert in the first hour or never. I put education second, before the urgency push, because skincare buyers hesitate on ingredient fit — teaching the routine answers the objection that actually blocks the sale. The expiry email waits until day 5 so it doesn't feel like a countdown scam, and excluding purchasers avoids training buyers to wait for discounts.",
    },
    refine: {
      artifact: "email 1: welcome. email 2: products. email 3: discount.",
      reasoning: "that's the standard order everyone uses",
    },
  },
  {
    tier: "skill",
    step: {
      title: "Ship a Portfolio Email Campaign",
      description: "An end-to-end campaign, published where an employer can see it.",
    },
    spec: spec({
      proof_type: "skill",
      criteria: [
        "Live link to the published campaign or case study",
        "Shows strategy, execution, and results (real or projected)",
      ],
      pass_threshold: TIER_THRESHOLDS.skill,
      tool_evidence: "Screenshots of the ESP flow builder or campaign analytics",
      anti_gaming_prompt: "Which decision in this campaign would you defend hardest, and why?",
    }),
    pass: {
      link: "https://priyasharma.notion.site/glowcart-welcome-flow-case-study",
      artifact:
        "Case study covers: audience (new D2C skincare subscribers), the 3-email flow with full copy, Klaviyo flow-builder screenshots, and projected benchmarks (45% open on email 1 vs 38% industry median, per Klaviyo's 2025 benchmark report). Includes an A/B plan for subject line of email 3.",
      reasoning:
        "I'd defend gating email 3 to non-purchasers hardest. It cost me reach in the projection, but sending an expiring-discount email to someone who already bought at full price is how brands train their best customers to stop buying at full price. Short-term revenue vs long-term margin — I chose margin and I can argue it with the benchmark data in the case study.",
    },
    refine: {
      link: "https://example.com",
      reasoning: "it's all on the link, trust me it's good",
    },
  },
];

console.log("Grading round-trips (live API — sonnet for work/skill, haiku for knowledge/attest)\n");

async function main() {
for (const c of cases) {
  console.log(`[${c.tier}] ${c.step.title}`);
  const passResult = await gradeSubmission(c.step, c.spec, c.pass);
  console.log(
    `      genuine → ${passResult.verdict} (auth ${passResult.scores.authenticity}, complete ${passResult.scores.completeness}, correct ${passResult.scores.correctness}, reasoning ${passResult.scores.reasoning})`,
  );
  check(`${c.tier}: genuine submission passes`, passResult.verdict === "pass", passResult.feedback);

  const refineResult = await gradeSubmission(c.step, c.spec, c.refine);
  console.log(
    `      lazy    → ${refineResult.verdict} (auth ${refineResult.scores.authenticity}, complete ${refineResult.scores.completeness}, correct ${refineResult.scores.correctness}, reasoning ${refineResult.scores.reasoning})`,
  );
  check(`${c.tier}: lazy submission refines`, refineResult.verdict === "refine");
  check(
    `${c.tier}: refine verdict carries actionable feedback`,
    refineResult.feedback.length > 40,
    refineResult.feedback,
  );
  console.log(`      feedback: ${refineResult.feedback.slice(0, 120)}…\n`);
}

console.log(failures === 0 ? "All grading round-trips passed." : `${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
