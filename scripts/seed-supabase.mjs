/**
 * Seeds the Supabase `roles` and `ai_tools` tables from the bundled data.
 * Run once after applying supabase/schema.sql:
 *
 *   npm run seed
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
 * .env.local (or the environment). Idempotent — upserts by slug/name.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Minimal .env.local loader (no extra dependency)
const envPath = path.join(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — add them to .env.local first.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

function loadJson(rel) {
  return JSON.parse(readFileSync(path.join(root, rel), "utf8"));
}

const taxonomyFiles = [
  "src/data/taxonomy/tech.json",
  "src/data/taxonomy/marketing.json",
  "src/data/taxonomy/product-design.json",
  "src/data/taxonomy/sales-cs.json",
  "src/data/taxonomy/operations.json",
  "src/data/taxonomy/finance.json",
  "src/data/taxonomy/hr.json",
  "src/data/taxonomy/content-other.json",
];

const roles = taxonomyFiles.flatMap(loadJson);
console.log(`Seeding ${roles.length} roles…`);
{
  const { error } = await supabase
    .from("roles")
    .upsert(roles, { onConflict: "slug" });
  if (error) {
    console.error("roles upsert failed:", error.message);
    process.exit(1);
  }
}

const tools = loadJson("src/data/ai-tools-seed.json").map((t) => ({
  ...t,
  source: "seed",
}));
console.log(`Seeding ${tools.length} AI tools (fallback until Notion sync)…`);
{
  const { error } = await supabase
    .from("ai_tools")
    .upsert(tools, { onConflict: "name" });
  if (error) {
    console.error("ai_tools upsert failed:", error.message);
    process.exit(1);
  }
}

console.log("Done. roles + ai_tools are seeded.");
