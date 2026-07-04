import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { JourneyData, ParsedResume } from "./types";

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
