/**
 * Syncs the "AI Tools Database" Notion database into the Supabase `ai_tools`
 * table. The deployed app reads only from Supabase — this script is the bridge.
 *
 *   npm run sync:notion
 *
 * Requires in .env.local (or the environment):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   NOTION_TOKEN — internal integration token (share the database with it)
 *
 * NOTION_TOOLS_DATABASE_ID defaults to the "AI Tools Database" found in the
 * workspace (225 tools / 25 job roles) — override via env if you point this
 * at a different database.
 *
 * Column mapping, matched to the actual schema:
 *   Tool Name (title)        → name
 *   Category (select)        → tags (Beginner/Intermediate/Advanced — skill tier)
 *   Cost (select)            → tags (Free/Freemium/Paid)
 *   Job Role (multi_select)  → tags (role names — this is what the toolkit
 *                               matcher uses to find tools for a selected role)
 *   Use Case (text)          → description
 *   Resource Link (url)      → url
 */
import { createClient } from "@supabase/supabase-js";
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

const DEFAULT_DATABASE_ID = "3aaff999-e4cc-41ba-aabf-a0f45c7ebb25"; // "AI Tools Database"

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  NOTION_TOKEN,
  NOTION_TOOLS_DATABASE_ID = DEFAULT_DATABASE_ID,
} = process.env;

for (const [k, v] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  NOTION_TOKEN,
})) {
  if (!v) {
    console.error(`Missing ${k} — add it to .env.local first.`);
    process.exit(1);
  }
}

function plainText(prop) {
  if (!prop) return null;
  if (prop.type === "title") return prop.title.map((t) => t.plain_text).join("") || null;
  if (prop.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("") || null;
  if (prop.type === "select") return prop.select?.name ?? null;
  if (prop.type === "url") return prop.url ?? null;
  return null;
}

function multiSelect(prop) {
  return prop?.type === "multi_select" ? prop.multi_select.map((o) => o.name) : [];
}

async function fetchAllPages() {
  const pages = [];
  let cursor = undefined;
  do {
    const res = await fetch(
      `https://api.notion.com/v1/databases/${NOTION_TOOLS_DATABASE_ID}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ start_cursor: cursor, page_size: 100 }),
      },
    );
    if (!res.ok) {
      console.error(`Notion API error ${res.status}: ${await res.text()}`);
      process.exit(1);
    }
    const data = await res.json();
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return pages;
}

console.log("Fetching tools from Notion…");
const pages = await fetchAllPages();
console.log(`Fetched ${pages.length} rows.`);

// The same tool often appears on multiple rows, each tagged to a different
// Job Role (one role per row) — merge by name so no role tag is lost.
const byName = new Map();
for (const page of pages) {
  const p = page.properties;
  const name = plainText(p["Tool Name"]);
  if (!name) continue;
  const key = name.toLowerCase();

  const jobRoles = multiSelect(p["Job Role"]).map((r) => r.toLowerCase());
  const skillTier = plainText(p["Category"]); // Beginner / Intermediate / Advanced
  const cost = plainText(p["Cost"]); // Free / Freemium / Paid
  const url = plainText(p["Resource Link"]);
  const description = plainText(p["Use Case"]) || plainText(p["Notes"]);

  const existing = byName.get(key);
  if (!existing) {
    byName.set(key, {
      name,
      category: skillTier,
      url,
      description,
      tags: new Set([...jobRoles, skillTier?.toLowerCase(), cost?.toLowerCase()].filter(Boolean)),
      source: "notion",
    });
  } else {
    for (const t of jobRoles) existing.tags.add(t);
    if (skillTier) existing.tags.add(skillTier.toLowerCase());
    if (cost) existing.tags.add(cost.toLowerCase());
    existing.url ??= url;
    existing.description ??= description;
  }
}

const tools = [...byName.values()].map((t) => ({ ...t, tags: [...t.tags] }));

console.log(`Merged ${pages.length} rows into ${tools.length} unique tools (tags unioned across duplicates).`);
console.log(`Upserting ${tools.length} tools into Supabase…`);
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { error } = await supabase.from("ai_tools").upsert(tools, { onConflict: "name" });
if (error) {
  console.error("upsert failed:", error.message);
  process.exit(1);
}
console.log("Done. ai_tools now mirrors the Notion database.");
