-- CareerNext Supabase schema (Phase 1)
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.

-- ============ Shared reference tables (seeded, read-only to users) ============

-- Role taxonomy: ~105 roles with skill/tool profiles. Seeded once via
-- `npm run seed` from src/data/taxonomy/*.json — never regenerated per request.
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text not null,
  description text not null,
  skills text[] not null default '{}',
  tools text[] not null default '{}',
  keywords text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- AI tool database. Seeded with a fallback list; replaced/augmented by the
-- Notion sync script (scripts/sync-notion-tools.mjs) against the 225-tool DB.
create table if not exists public.ai_tools (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  category text,
  url text,
  description text,
  tags text[] not null default '{}',
  source text not null default 'seed', -- 'seed' | 'notion'
  created_at timestamptz not null default now()
);

-- Learning paths generated once per role via Claude, then reused.
create table if not exists public.role_paths (
  role_slug text primary key,
  -- [{title, description, estimatedHours, deliverable: {proof_type, criteria[],
  --   pass_threshold, tool_evidence, anti_gaming_prompt, quiz?, review}}] x5
  -- (legacy rows carry a free-text `unlocks`; migrated on next path fetch)
  steps jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.roles enable row level security;
alter table public.ai_tools enable row level security;
alter table public.role_paths enable row level security;

drop policy if exists "Authenticated can read roles" on public.roles;
create policy "Authenticated can read roles"
  on public.roles for select to authenticated using (true);

drop policy if exists "Authenticated can read tools" on public.ai_tools;
create policy "Authenticated can read tools"
  on public.ai_tools for select to authenticated using (true);

drop policy if exists "Authenticated can read role paths" on public.role_paths;
create policy "Authenticated can read role paths"
  on public.role_paths for select to authenticated using (true);

-- Writes to the three tables above happen only via the service role
-- (seed script, sync script, API routes) which bypasses RLS.

-- ============ Per-user tables ============

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  filename text,
  raw_text text not null,
  parsed jsonb not null, -- {skills[], titlesHeld[], yearsExperience, toolsUsed[], industries[], education[], summary}
  created_at timestamptz not null default now()
);
create index if not exists resumes_user_id_idx on public.resumes (user_id, created_at desc);

-- One journey row per user: current matches, selected role, toolkit, progress.
create table if not exists public.journeys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.resumes enable row level security;
alter table public.journeys enable row level security;

drop policy if exists "Users read own resumes" on public.resumes;
create policy "Users read own resumes"
  on public.resumes for select using (auth.uid() = user_id);
drop policy if exists "Users insert own resumes" on public.resumes;
create policy "Users insert own resumes"
  on public.resumes for insert with check (auth.uid() = user_id);

drop policy if exists "Users read own journey" on public.journeys;
create policy "Users read own journey"
  on public.journeys for select using (auth.uid() = user_id);
drop policy if exists "Users insert own journey" on public.journeys;
create policy "Users insert own journey"
  on public.journeys for insert with check (auth.uid() = user_id);
drop policy if exists "Users update own journey" on public.journeys;
create policy "Users update own journey"
  on public.journeys for update using (auth.uid() = user_id);

-- ============ Lead capture (kept from Phase 0) ============

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  selected_title text,
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
