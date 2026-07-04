/** Deletes E2E test accounts (email ends in @careernext-test.local).
 *    node scripts/delete-test-accounts.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
if (error) throw error;

const testUsers = data.users.filter((u) => u.email?.endsWith("@careernext-test.local"));
console.log(`Found ${testUsers.length} test account(s).`);
for (const u of testUsers) {
  const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
  console.log(delErr ? `  FAILED ${u.email}: ${delErr.message}` : `  deleted ${u.email}`);
}
console.log("Done.");
