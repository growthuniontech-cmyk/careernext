import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Refreshes the Supabase session cookie and gates the app flow behind auth.
 *  API routes also verify auth themselves; this is the optimistic layer. */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const { pathname: requestPath } = request.nextUrl;

  // Unconfigured environment: send flow pages to the setup notice on /login.
  if (!url || !key) {
    if (requestPath !== "/login" && !requestPath.startsWith("/api/")) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/login";
      return NextResponse.redirect(redirect);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refreshes the token if expired; do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtectedPage = ["/start", "/results", "/toolkit", "/path", "/daily"].some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (!user && isProtectedPage) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  if (user && pathname === "/login") {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/start";
    redirect.searchParams.delete("next");
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    "/start",
    "/results",
    "/toolkit",
    "/path",
    "/daily",
    "/login",
    "/api/parse-resume",
    "/api/match",
    "/api/toolkit",
    "/api/learning-path",
    "/api/journey",
    "/api/verify-step",
  ],
};
