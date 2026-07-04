# CareerNext: Project Notes

AI-powered career guidance SaaS. Helps freshers/mid-level job seekers find the
right role, the right AI tools for it, and the right learning order.

## Stack
- Frontend/Backend: Next.js
- DB + Auth: Supabase (Google OAuth)
- AI: Anthropic API (Claude), resume parsing, role matching, toolkit + learning path generation
- Content source: Notion (225-tool database, synced via NOTION_TOKEN + NOTION_TOOLS_DATABASE_ID)
- Deploy: Vercel (via GitHub)

## Conventions
- Never use em dashes (—) or en dashes (–) anywhere: not in UI copy, taxonomy/data JSON, AI prompts/system instructions, code comments, or commit messages. Use commas, colons, semicolons, periods, or parentheses instead. This applies to all text written now and in the future, including AI-generated content shown to users (rubric criteria, match reasons, toolkit reasons, feedback), so system prompts that generate user-facing text must also instruct the model to avoid them.
- Keep GrowthUnion Tech branding out of all customer-facing text/UI; product is sold under Nishtha's personal brand.
- Brand colors: Deep Indigo #1B2A4A (primary), Emerald Teal #12B886 (progress/momentum), Warm Coral #FF6B4A (CTAs only), Warm Off-White #FAF9F6 (background), Charcoal #1F2937 (text), Soft Gold #FFC857 (gamification, sparingly).
- Fonts: Poppins (headings), Inter (body), Lora (accent callouts).
- Don't add features, refactor, or add abstractions beyond what's asked. Simplest working solution wins.
- No error handling/validation for cases that can't happen; only validate at real system boundaries.

## Known gotchas
- DOMMatrix isn't available in Vercel's Node runtime; libraries using it (e.g. pdfjs-dist) must be lazy-loaded, not imported at module level, or they'll crash the whole route in production while working fine locally.
- `spawn npm ENOENT` on Windows → resolved by letting the tool extract its own local Node copy; don't fight it manually.
- React hydration warnings from the Grammarly browser extension are not app bugs; fix with `suppressHydrationWarning` on `<body>`, don't debug further.
- Notion's public template share toggle is not exposed via API; must be set manually in the Share panel.

## Compact instructions
When running `/compact`, preserve: what feature/phase was just completed, any unresolved errors with their exact messages, and pending manual steps (env vars, dashboard settings). Drop exploratory back-and-forth and superseded code attempts.
