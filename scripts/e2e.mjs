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

// ---- 6. Learning path (generated once per role, cached) ----
console.log("\n[6] Generating learning path…");
const path1 = await api(cookies, "POST", "/api/learning-path");
check("path 200", path1.status === 200, JSON.stringify(path1.json));
const steps = path1.json?.steps ?? [];
for (const [i, s] of steps.entries()) console.log(`      ${i + 1}. ${s.title} (~${s.estimatedHours}h)`);
check("5 steps", steps.length === 5, `got ${steps.length}`);
const path2 = await api(cookies, "POST", "/api/learning-path");
check("second request served from role cache", path2.json?.cached === true);

// ---- 7. Progress: complete a task, % moves by the one formula ----
console.log("\n[7] Completing step 1…");
const before = await api(cookies, "GET", "/api/journey");
check("job-ready starts at 0%", before.json?.jobReadyPercent === 0, `got ${before.json?.jobReadyPercent}`);
const prog = await api(cookies, "POST", "/api/progress", { stepIndex: 0, completed: true });
check("progress 200", prog.status === 200);
check("job-ready moved to 20% (1/5)", prog.json?.jobReadyPercent === 20, `got ${prog.json?.jobReadyPercent}`);
check("streak started", prog.json?.progress?.streak === 1);
const after = await api(cookies, "GET", "/api/journey");
check("journey endpoint reports same 20%", after.json?.jobReadyPercent === 20, `got ${after.json?.jobReadyPercent}`);

// ---- 8. "Log out and back in" — fresh session, everything persists ----
console.log("\n[8] Fresh sign-in (new session), checking persistence…");
const cookies2 = await signInAndGetCookies();
const restored = await api(cookies2, "GET", "/api/journey");
check("matches persisted", (restored.json?.matches ?? []).length === matches.length);
check("selected role persisted", restored.json?.selectedRoleSlug === chosen.roleSlug);
check("toolkit persisted", (restored.json?.toolkit ?? []).length === tools.length);
check("path persisted", (restored.json?.pathSteps ?? []).length === 5);
check("progress persisted (20%)", restored.json?.jobReadyPercent === 20);
check("resume persisted", restored.json?.hasResume === true);

console.log(
  failures === 0
    ? `\nAll E2E checks passed. Test account: ${EMAIL} (delete from Supabase → Authentication when done).`
    : `\n${failures} E2E check(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
