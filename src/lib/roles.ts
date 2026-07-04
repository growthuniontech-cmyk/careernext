import type { SupabaseClient } from "@supabase/supabase-js";
import { TAXONOMY, type TaxonomyRole } from "./taxonomy";

/** Loads the role taxonomy from Supabase; falls back to the bundled seed data
 *  if the table hasn't been seeded yet. Roles are never generated per request. */
export async function loadRoles(
  supabase: SupabaseClient,
): Promise<TaxonomyRole[]> {
  const { data, error } = await supabase
    .from("roles")
    .select("slug, title, category, description, skills, tools, keywords");
  if (error || !data?.length) return TAXONOMY;
  return data as TaxonomyRole[];
}

export async function loadRole(
  supabase: SupabaseClient,
  slug: string,
): Promise<TaxonomyRole | null> {
  const { data } = await supabase
    .from("roles")
    .select("slug, title, category, description, skills, tools, keywords")
    .eq("slug", slug)
    .maybeSingle();
  if (data) return data as TaxonomyRole;
  return TAXONOMY.find((r) => r.slug === slug) ?? null;
}
