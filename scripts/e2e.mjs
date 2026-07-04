/**
 * End-to-end verification of the Phase 1 "done means" flow against the REAL
 * stack (Supabase auth + RLS, Claude API, seeded taxonomy):
 *
 *   sign up → upload resume → matches → pick role → toolkit → path →
 *   complete a task → job-ready % moves → "log out and back in" → persists.
 *
 * Drives the app's actual API routes over HTTP with a real Supabase session
 * cookie (built by @supabase/ssr itself, same library the app uses).
 *
 *   node scripts/e2e.mjs <path-to-resume.docx> [baseUrl]
 */
import { createClient as createBareClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resumePath = process.argv[2];
const BASE = process.argv[3] ?? "http://localhost:3000";

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !resumePath) {
  console.error("Missing env keys or resume path argument.");
  process.exit(1);
}

const EMAIL = `e2e-${Date.now()}@careernext-test.local`;
const PASSWORD = `E2e!${Math.random().toString(36).slice(2)}Xx9`;

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) console.log(`  ok — ${name}`);
  else {
    failures++;
    console.error(`  FAIL — ${name} ${detail}`);
  }
}

/** Signs in and returns a Cookie header string produced by @supabase/ssr. */
async function signInAndGetCookies() {
  const jar = new Map();
  const client = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  return [...jar.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

async function api(cookies, method, route, body, isForm = false) {
  const headers = { Cookie: cookies };
  if (body && !isForm) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json };
}

// ---- 1. Sign up (admin-created, pre-confirmed — magic-link email can't be
//         received in an automated test; the credential store is the same) ----
console.log(`\n[1] Creating account ${EMAIL}`);
const admin = createBareClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
});
if (createErr) {
  console.error("user creation failed:", createErr.message);
  process.exit(1);
}
const userId = created.user.id;
check("account created", Boolean(userId));

const cookies = await signInAndGetCookies();
check("signed in, session cookie issued", cookies.includes("auth-token"));

// Unauthenticated requests must be rejected
const noAuth = await fetch(`${BASE}/api/journey`);
check("API rejects unauthenticated (401)", noAuth.status === 401, `got ${noAuth.status}`);

// ---- 2. Upload + parse resume ----
console.log("\n[2] Uploading resume (DOCX → text → Claude → Supabase)…");
const form = new FormData();
form.append(
  "file",
  new Blob([readFileSync(resumePath)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }),
  "priya-sharma-resume.docx",
);
const parsed = await api(cookies, "POST", "/api/parse-resume", form, true);
check("parse-resume 200", parsed.status === 200, JSON.stringify(parsed.json));
const profile = parsed.json?.parsed;
if (profile) {
  console.log(
    `      → ${profile.titlesHeld?.[0]}, ${profile.yearsExperience} yrs, ${profile.skills?.length} skills, industries: ${profile.industries?.join("/")}`,
  );
  check("extracted marketing skills", JSON.stringify(profile.skills).toLowerCase().includes("email"));
  check("extracted title", (profile.titlesHeld ?? []).length >= 1);
}

// ---- 3. Matches reflect the resume ----
console.log("\n[3] Matching against the 103-role taxonomy…");
const match = await api(cookies, "POST", "/api/match");
check("match 200", match.status === 200, JSON.stringify(match.json));
const matches = match.json?.matches ?? [];
for (const m of matches) console.log(`      ${m.score}% ${m.title} — ${m.reason.slice(0, 90)}…`);
check("3-5 matches", matches.length >= 3 && matches.length <= 5);
check(
  "matches are marketing-flavored (personalized)",
  matches.filter((m) => /market|content|social|email|brand|seo|ppc/i.test(m.title)).length >= 3,
);
check(
  "reasons reference the person's background",
  matches.some((m) => /d2c|ecommerce|instagram|email|skincare|glowcart|social|campaign/i.test(m.reason)),
);

// ---- 4. Select a role ----
const chosen = matches[0];
console.log(`\n[4] Selecting role: ${chosen.title}`);
const sel = await api(cookies, "PATCH", "/api/journey", { selectedRoleSlug: chosen.roleSlug });
check("role selected", sel.status === 200);

// ---- 5. Toolkit from ai_tools + resume gaps ----
console.log("\n[5] Generating toolkit…");
const toolkit = await api(cookies, "POST", "/api/toolkit");
check("toolkit 200", toolkit.status === 200, JSON.stringify(toolkit.json));
const tools = toolkit.json?.tools ?? [];
for (const t of tools) console.log(`      [${t.tier}] ${t.name} — ${t.reason.slice(0, 80)}…`);
check("6-8 tools", tools.length >= 5 && tools.length <= 9, `got ${tools.length}`);
check("has high tier", tools.some((t) => t.tier === "high"));
check("has medium tier", tools.some((t) => t.tier === "medium"));

// ---- 6. Learning path with generated verification specs (cached per role) ----
console.log("\n[6] Generating learning path + deliverable specs…");
const path1 = await api(cookies, "POST", "/api/learning-path");
check("path 200", path1.status === 200, JSON.stringify(path1.json));
const steps = path1.json?.steps ?? [];
for (const [i, s] of steps.entries())
  console.log(`      ${i + 1}. [${s.deliverable?.proof_type}] ${s.title} (~${s.estimatedHours}h)`);
check("5 steps", steps.length === 5, `got ${steps.length}`);
check(
  "every step carries a structured deliverable spec",
  steps.every(
    (s) =>
      s.deliverable &&
      ["attest", "knowledge", "work", "skill"].includes(s.deliverable.proof_type) &&
      Array.isArray(s.deliverable.criteria) &&
      s.deliverable.criteria.length >= 1 &&
      typeof s.deliverable.pass_threshold === "number" &&
      "tool_evidence" in s.deliverable &&
      typeof s.deliverable.anti_gaming_prompt === "string",
  ),
);
check(
  "final step is the absolute-gated portfolio (skill) step",
  steps[steps.length - 1]?.deliverable?.proof_type === "skill" &&
    steps[steps.length - 1]?.deliverable?.pass_threshold >= 0.85,
);
check(
  "MCQ answers never reach the client",
  steps.every((s) => s.deliverable?.quiz?.correctIndex === undefined),
);
const path2 = await api(cookies, "POST", "/api/learning-path");
check("second request served from role cache", path2.json?.cached === true);
// jsonb doesn't preserve key order — compare canonically
const canon = (v) =>
  Array.isArray(v)
    ? v.map(canon)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
      : v;
check(
  "cached specs are reused verbatim (not regenerated)",
  JSON.stringify(canon(path2.json?.steps?.map((s) => s.deliverable))) ===
    JSON.stringify(canon(steps.map((s) => s.deliverable))),
);

// ---- 7. Verification gate: % moves only on a verified pass ----
console.log("\n[7] Verification gating…");
const before = await api(cookies, "GET", "/api/journey");
check("job-ready starts at 0%", before.json?.jobReadyPercent === 0, `got ${before.json?.jobReadyPercent}`);

const oldEndpoint = await api(cookies, "POST", "/api/progress", { stepIndex: 0, completed: true });
check(
  "honor-system endpoint is gone (no click-to-complete)",
  oldEndpoint.status === 404 || oldEndpoint.status === 405,
  `got ${oldEndpoint.status}`,
);

const locked = await api(cookies, "POST", "/api/verify-step", {
  stepIndex: 2,
  submission: { reflection: "skipping ahead" },
});
check("later steps are locked until earlier ones verify", locked.status === 409, `got ${locked.status}`);

const step0 = steps[0];
const spec0 = step0.deliverable;
console.log(`      step 1 is ${spec0.proof_type}-tier (threshold ${spec0.pass_threshold})`);

function garbageSubmission(spec) {
  switch (spec.proof_type) {
    case "attest": return { reflection: "done" };
    case "knowledge": return { mcqIndex: 0, shortAnswer: "idk it just works" };
    case "work": return { artifact: "i did the thing", reasoning: "because" };
    case "skill": return { link: "https://example.com", reasoning: "trust me" };
  }
}

/** Simulates a diligent learner actually doing the step's work — the
 *  submission must genuinely address the generated criteria to pass the gate.
 *  On a refine verdict, the grader's feedback is fed back in (the product's
 *  real refine → revise → pass loop). */
const anthropic = new Anthropic();
async function simulateLearnerWork(step, priorFeedback) {
  const spec = step.deliverable;
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4000,
    system:
      "You are simulating a diligent, motivated beginner who has GENUINELY completed a learning step of a career path, practicing on a fictional D2C skincare brand called GlowLab. Produce their submission. It must concretely satisfy every acceptance criterion. Where criteria ask for tool evidence or screenshots, include the textual equivalent inline (the exact prompts used, the raw first drafts, the refined versions, the settings/metrics visible in the tool). Write in first person, beginner-honest tone, with real specifics. Output exactly two sections separated by the markers ===ARTIFACT=== and ===REASONING=== (the reasoning section answers the reasoning question with specific decisions made during the work).",
    messages: [
      {
        role: "user",
        content:
          `Step: ${step.title}\nWhat it covers: ${step.description}\n` +
          `Acceptance criteria:\n${spec.criteria.map((c) => `- ${c}`).join("\n")}\n` +
          `Expected tool evidence: ${spec.tool_evidence ?? "none"}\n` +
          `Reasoning question: ${spec.anti_gaming_prompt}` +
          (priorFeedback
            ? `\n\nYour previous submission was graded "refine" with this feedback — fix exactly what it names:\n${priorFeedback}`
            : ""),
      },
    ],
  });
  const text = msg.content.find((b) => b.type === "text")?.text ?? "";
  const [artifactPart, reasoningPart] = text
    .replace(/^[\s\S]*?===ARTIFACT===/, "")
    .split("===REASONING===");
  const artifact = (artifactPart ?? "").trim();
  const reasoning = (reasoningPart ?? "").trim() || artifact;

  switch (spec.proof_type) {
    case "attest":
      return { reflection: `${artifact}\n\n${reasoning}` };
    case "knowledge":
      return { shortAnswer: `${artifact}\n\n${reasoning}` };
    case "work":
      return { artifact, reasoning };
    case "skill":
      return {
        link: "https://priyasharma.notion.site/glowlab-portfolio-project",
        artifact,
        reasoning,
      };
  }
}

console.log("      submitting garbage — must NOT move the metric…");
const junk = await api(cookies, "POST", "/api/verify-step", {
  stepIndex: 0,
  submission: garbageSubmission(spec0),
});
check("garbage submission is graded, not accepted", junk.status === 200, JSON.stringify(junk.json));
check("garbage verdict is refine", junk.json?.verdict === "refine", `got ${junk.json?.verdict}`);
check("refine returns improvement feedback", (junk.json?.feedback ?? "").length > 20);
check("job-ready did NOT move", junk.json?.jobReadyPercent === 0, `got ${junk.json?.jobReadyPercent}`);

console.log("      doing the work for real (simulated learner) — refine feedback loops back in…");
let verify = null;
let feedbackLoop = null;
for (let attempt = 1; attempt <= 3; attempt++) {
  const submission = await simulateLearnerWork(step0, feedbackLoop);
  if (spec0.quiz) submission.mcqIndex = [1, 0, 2][attempt - 1] ?? 3;
  verify = await api(cookies, "POST", "/api/verify-step", { stepIndex: 0, submission });
  if (verify.json?.verdict === "pass") {
    console.log(`      → pass on attempt ${attempt}`);
    break;
  }
  feedbackLoop = verify.json?.feedback ?? null;
  console.log(`      → attempt ${attempt} refine (${(feedbackLoop ?? "").slice(0, 80)}…), revising`);
}
check("genuine submission passes verification", verify?.json?.verdict === "pass", JSON.stringify(verify?.json));
check("pass moved job-ready to 20% (1/5)", verify?.json?.jobReadyPercent === 20, `got ${verify?.json?.jobReadyPercent}`);
check("streak started on verified pass", verify?.json?.progress?.streak === 1);
check(
  "grading scored all four dimensions",
  ["authenticity", "completeness", "correctness", "reasoning"].every(
    (d) => typeof verify?.json?.scores?.[d] === "number",
  ),
);

const dupe = await api(cookies, "POST", "/api/verify-step", {
  stepIndex: 0,
  submission: garbageSubmission(spec0),
});
check("verified steps can't be re-submitted", dupe.status === 409, `got ${dupe.status}`);

const after = await api(cookies, "GET", "/api/journey");
check("journey endpoint reports same 20%", after.json?.jobReadyPercent === 20, `got ${after.json?.jobReadyPercent}`);
check(
  "verification state recorded on journey",
  after.json?.verifications?.["0"]?.lastVerdict === "pass" &&
    typeof after.json?.verifications?.["0"]?.verifiedAt === "string",
);

// ---- 8. "Log out and back in" — fresh session, everything persists ----
console.log("\n[8] Fresh sign-in (new session), checking persistence…");
const cookies2 = await signInAndGetCookies();
const restored = await api(cookies2, "GET", "/api/journey");
check("matches persisted", (restored.json?.matches ?? []).length === matches.length);
check("selected role persisted", restored.json?.selectedRoleSlug === chosen.roleSlug);
check("toolkit persisted", (restored.json?.toolkit ?? []).length === tools.length);
check("path persisted", (restored.json?.pathSteps ?? []).length === 5);
check("progress persisted (20%)", restored.json?.jobReadyPercent === 20);
check(
  "verification record persisted",
  restored.json?.verifications?.["0"]?.lastVerdict === "pass",
);
check("resume persisted", restored.json?.hasResume === true);

console.log(
  failures === 0
    ? `\nAll E2E checks passed. Test account: ${EMAIL} (delete from Supabase → Authentication when done).`
    : `\n${failures} E2E check(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
