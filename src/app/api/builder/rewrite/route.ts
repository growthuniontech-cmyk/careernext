import { isClaudeConfigured } from "@/lib/ai";
import { rewriteExperienceBullets } from "@/lib/resume-builder";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/journey";

export const maxDuration = 60;

/** POST: rewrite one experience entry's bullets from the guided
 *  challenge/change/metric input. Body carries the entry fields directly,
 *  not persisted here, the client saves the result via PATCH /api/builder. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  if (!isClaudeConfigured()) {
    return Response.json({ error: "claude_not_configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    company?: string;
    challenge?: string;
    change?: string;
    metric?: string;
    jdText?: string | null;
  };

  if (!body.title?.trim() || !body.company?.trim()) {
    return Response.json({ error: "missing_role" }, { status: 400 });
  }
  if (!body.challenge?.trim() && !body.change?.trim()) {
    return Response.json({ error: "missing_input" }, { status: 400 });
  }

  try {
    const result = await rewriteExperienceBullets(
      {
        title: body.title.trim(),
        company: body.company.trim(),
        challenge: body.challenge ?? "",
        change: body.change ?? "",
        metric: body.metric ?? "",
      },
      body.jdText,
    );
    if (!result) {
      return Response.json({ error: "rewrite_failed" }, { status: 500 });
    }
    return Response.json(result);
  } catch (err) {
    console.error("bullet rewrite failed:", err);
    return Response.json({ error: "rewrite_failed" }, { status: 500 });
  }
}
