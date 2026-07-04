# CareerNext

AI career guidance for job seekers who don't know which role to target, which
AI tools to learn, or in what order. Wrong tools. Wrong role. Wrong order.

Next.js 16 + Tailwind 4 · Supabase (auth + Postgres) · Claude API · Notion sync.

## Phase 1 architecture

1. **Auth**: Supabase Auth, magic-link email + Google OAuth. All flow pages
   and API routes are gated (see `src/proxy.ts`); progress persists per account.
2. **Resume parsing**: PDF (`pdf-parse`) / DOCX (`mammoth`) → raw text →
   Claude (`claude-opus-4-8`, structured outputs) → `resumes` table.
3. **Role taxonomy**: 103 roles with skill/tool profiles authored in
   `src/data/taxonomy/*.json`, seeded once into the `roles` table (`npm run seed`).
4. **Matching**: deterministic weighted similarity (skills/tools/title/industry)
   in `src/lib/matching.ts` ranks the taxonomy against the parsed resume;
   Claude writes the personalized "why this match" per result.
5. **Toolkit**: candidates pulled from the `ai_tools` table (mirrored from the
   Notion tool database via `npm run sync:notion`; seeded fallback included);
   Claude selects and personalizes reasons into High/Medium tiers.
6. **Learning path + progress**: 5-step path generated once per role, cached
   in `role_paths`. Job-ready % = completed steps ÷ total, computed in ONE
   place (`computeJobReadyPercent`) and used everywhere it appears.

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in the keys
```

1. **Supabase**: create a project → SQL editor → run `supabase/schema.sql`.
   Copy URL + anon key + service-role key into `.env.local`.
   For Google sign-in: Authentication → Providers → Google → add your OAuth
   client (Google Cloud Console), authorized redirect
   `https://<project>.supabase.co/auth/v1/callback`.
2. **Seed reference data**: `npm run seed` (roles + fallback tools).
3. **Claude**: add `ANTHROPIC_API_KEY`.
4. **Notion tools DB** (optional, replaces fallback): create an internal
   integration, share the 225-tool database with it, set `NOTION_TOKEN` +
   `NOTION_TOOLS_DATABASE_ID`, run `npm run sync:notion`. Re-run any time the
   Notion DB changes. Column-name mapping is at the top of
   `scripts/sync-notion-tools.mjs`.

```bash
npm run dev
```

## Tests

```bash
npx tsx scripts/test-matching.ts   # taxonomy integrity + matching sanity
```

## Deploy (Vercel)

Push to GitHub → import in Vercel → add all env vars from `.env.local` →
deploy. Set the Supabase project's Auth → URL Configuration → Site URL to the
Vercel URL so magic links and OAuth redirects land correctly.

## Data model

| Table | Contents | Access |
|---|---|---|
| `roles` | 103-role taxonomy | read: authenticated · write: seed script |
| `ai_tools` | tool database (Notion mirror or seed) | read: authenticated · write: scripts |
| `role_paths` | 5-step path per role, generated once | read: authenticated · write: server |
| `resumes` | raw text + parsed profile per upload | owner only (RLS) |
| `journeys` | matches, selected role, toolkit, progress | owner only (RLS) |
