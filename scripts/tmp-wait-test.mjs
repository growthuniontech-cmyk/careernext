import { createClient as createBareClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = "C:\\Users\\HP\\Downloads\\claude code\\careernext";
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
const PROD = "https://careernext-theta.vercel.app";
const EMAIL = `pdf-prod-debug-${Date.now()}@careernext-test.local`;
const PASSWORD = `Pdf!${Math.random().toString(36).slice(2)}Xx9`;

const admin = createBareClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const { error: ce } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
if (ce) throw ce;

const jar = new Map();
const client = createServerClient(SUPABASE_URL, ANON_KEY, {
  cookies: {
    getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
    setAll: (cs) => cs.forEach(({ name, value }) => jar.set(name, value)),
  },
});
const { error: se } = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (se) throw se;
const cookies = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

const pdfBytes = readFileSync(
  "C:\\Users\\HP\\AppData\\Local\\Temp\\claude\\C--Users-HP-Downloads-claude-code\\b19c5f21-7ce3-4b44-9b4d-0354b2bdd0ef\\scratchpad\\test-resume.pdf",
);

const deadline = Date.now() + 4 * 60 * 1000; // 4 min max
let attempt = 0;
let lastResult = null;
while (Date.now() < deadline) {
  attempt++;
  const form = new FormData();
  form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "test-resume.pdf");
  try {
    const res = await fetch(`${PROD}/api/parse-resume`, {
      method: "POST",
      headers: { Cookie: cookies },
      body: form,
    });
    const body = await res.text();
    lastResult = { status: res.status, body };
    console.log(`attempt ${attempt}: status ${res.status}`);
    if (res.status === 200) {
      console.log("SUCCESS:", body);
      break;
    }
    if (res.status !== 422 && res.status !== 500) {
      // Some other error (401, 500, etc) — surface immediately, don't keep looping blindly
      console.log("Unexpected non-422 failure, stopping:", body);
      break;
    }
  } catch (err) {
    console.log(`attempt ${attempt}: fetch error`, err.message);
  }
  await new Promise((r) => setTimeout(r, 15000));
}

await admin.auth.admin.deleteUser((await client.auth.getUser()).data.user.id);

if (!lastResult || lastResult.status !== 200) {
  console.log("FINAL: did not succeed within window.", lastResult);
  process.exit(1);
}
