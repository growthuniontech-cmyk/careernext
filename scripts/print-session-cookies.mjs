/** Prints browser-settable session cookies for an existing test account
 *  (resets its password via the admin API first). Dev/testing only.
 *    node scripts/print-session-cookies.mjs <email>
 */
import { createClient as createBareClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const email = process.argv[2];
const password = `Reset!${Math.random().toString(36).slice(2)}Zz7`;

const admin = createBareClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
if (listErr) throw listErr;
const user = list.users.find((u) => u.email === email);
if (!user) {
  console.error(`no user with email ${email}`);
  process.exit(1);
}
const { error: updErr } = await admin.auth.admin.updateUserById(user.id, { password });
if (updErr) throw updErr;

const jar = new Map();
const client = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  cookies: {
    getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
    setAll: (cs) => cs.forEach(({ name, value }) => jar.set(name, value)),
  },
});
const { error } = await client.auth.signInWithPassword({ email, password });
if (error) throw error;
console.log(JSON.stringify([...jar.entries()].map(([name, value]) => ({ name, value }))));
