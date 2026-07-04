import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createBareClient } from "@supabase/supabase-js";

/** Request-scoped client that authenticates as the signed-in user (RLS applies). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — session refresh is handled by proxy.ts
          }
        },
      },
    },
  );
}

/** Service-role client for shared-table writes (roles, ai_tools, role_paths).
 *  Server only — bypasses RLS. */
export function createAdminClient() {
  return createBareClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function hasServiceRole(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
