/** Partial E2E — the pieces that don't need Anthropic credits:
 *  signup → manual profile → similarity matching (DB taxonomy) → select role →
 *  fresh sign-in → persistence. Run from careernext/: node <this file>
 */
import { createClient as createBareClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
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
const BASE = "http://localhost:3000";
const EMAIL = `e2e-partial-${Date.now()}@careernext-test.local`;
const PASSWORD = `E2e!${Math.random().toString(36).slice(2)}Xx9`;

let failures = 0;
const check = (name, cond, detail = "") => {
  if (cond) console.log(`  ok — ${name}`);
  else { failures++; console.error(`  FAIL — ${name} ${detail}`); }
};

async function signIn() {
  const jar = new Map();
  const client = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error) throw new Error(error.message);
  return [...jar.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function api(cookies, method, route, body) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: { Cookie: cookies, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const admin = createBareClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const { error: ce } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
if (ce) { console.error(ce.message); process.exit(1); }
console.log(`[1] account ${EMAIL}`);
const cookies = await signIn();
check("signed in", cookies.includes("auth-token"));

console.log("[2] manual profile (fresher-style entry)…");
const mp = await api(cookies, "POST", "/api/manual-profile", {
  currentRole: "Digital Marketing Executive",
  yearsExperience: 3,
  skills: ["email marketing", "social media management", "Google Analytics"],
});
check("manual-profile 200", mp.status === 200, JSON.stringify(mp.json));

console.log("[3] matching (DB taxonomy + similarity engine, generic reasons without Claude)…");
const match = await api(cookies, "POST", "/api/match");
check("match 200", match.status === 200, JSON.stringify(match.json));
const matches = match.json?.matches ?? [];
for (const m of matches) console.log(`      ${m.score}% ${m.title}`);
check("3-5 matches returned", matches.length >= 3 && matches.length <= 5);
check("marketing-flavored", matches.filter((m) => /market|content|social|email|brand/i.test(m.title)).length >= 3);

console.log("[4] select role + persistence across a fresh session…");
const sel = await api(cookies, "PATCH", "/api/journey", { selectedRoleSlug: matches[0].roleSlug });
check("selected", sel.status === 200);
const cookies2 = await signIn();
const j = await api(cookies2, "GET", "/api/journey");
check("matches persisted", (j.json?.matches ?? []).length === matches.length);
check("selection persisted", j.json?.selectedRoleSlug === matches[0].roleSlug);
check("resume row persisted", j.json?.hasResume === true);

console.log(failures === 0 ? "\nPartial E2E passed." : `\n${failures} FAILED`);
process.exit(failures ? 1 : 0);
