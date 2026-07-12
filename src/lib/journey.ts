import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AtsScoreResult, BuilderSections, JourneyData, ParsedResume } from "./types";

/** Server-side helpers for the per-user journey row and resume access.
 *  All calls run with the user's own Supabase client, so RLS applies. */

export async function getJourney(
  supabase: SupabaseClient,
  userId: string,
): Promise<JourneyData> {
  const { data } = await supabase
    .from("journeys")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.data as JourneyData) ?? {};
}

export async function saveJourney(
  supabase: SupabaseClient,
  userId: string,
  patch: Partial<JourneyData>,
): Promise<JourneyData> {
  const current = await getJourney(supabase, userId);
  const next = { ...current, ...patch };
  const { error } = await supabase
    .from("journeys")
    .upsert(
      { user_id: userId, data: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw error;
  return next;
}

export async function getLatestResume(
  supabase: SupabaseClient,
  userId: string,
): Promise<ParsedResume | null> {
  const { data } = await supabase
    .from("resumes")
    .select("parsed")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.parsed as ParsedResume) ?? null;
}

export type ResumeRecord = {
  id: string;
  raw_text: string;
  parsed: ParsedResume;
  ats_score: AtsScoreResult | null;
};

/** Full latest-resume row (for ATS scoring, which needs the raw text and the
 *  row id to persist the score back onto the right version). */
export async function getLatestResumeRecord(
  supabase: SupabaseClient,
  userId: string,
): Promise<ResumeRecord | null> {
  const { data } = await supabase
    .from("resumes")
    .select("id, raw_text, parsed, ats_score")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ResumeRecord) ?? null;
}

/** Phase 2: the user's one in-progress guided-builder resume, if any. */
export async function getBuilderResume(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ sections: BuilderSections | null; jdText: string | null; atsScore: AtsScoreResult | null; updatedAt: string | null }> {
  const { data } = await supabase
    .from("builder_resumes")
    .select("sections, jd_text, ats_score, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return { sections: null, jdText: null, atsScore: null, updatedAt: null };
  return {
    sections: (data.sections as BuilderSections) ?? null,
    jdText: data.jd_text ?? null,
    atsScore: (data.ats_score as AtsScoreResult) ?? null,
    updatedAt: data.updated_at ?? null,
  };
}

export async function saveBuilderResume(
  supabase: SupabaseClient,
  userId: string,
  patch: { sections?: BuilderSections; jdText?: string | null; atsScore?: AtsScoreResult | null },
): Promise<void> {
  const row: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if (patch.sections !== undefined) row.sections = patch.sections;
  if (patch.jdText !== undefined) row.jd_text = patch.jdText;
  if (patch.atsScore !== undefined) row.ats_score = patch.atsScore;
  const { error } = await supabase.from("builder_resumes").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

/** Auth guard for API routes. Returns the user or a 401 response. */
export async function requireUser(
  supabase: SupabaseClient,
): Promise<{ user: User } | { error: Response }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: Response.json({ error: "unauthenticated" }, { status: 401 }),
    };
  }
  return { user };
}
