"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/browser";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/start";
  const authError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");

  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-2xl bg-white border border-charcoal/10 shadow-sm p-8 text-center">
        <h1 className="font-heading font-bold text-2xl text-indigo">
          Almost ready
        </h1>
        <p className="mt-3 text-sm text-charcoal/70">
          Sign-in isn&apos;t configured yet. Add{" "}
          <code className="text-xs bg-cream px-1.5 py-0.5 rounded">
            NEXT_PUBLIC_SUPABASE_URL
          </code>{" "}
          and{" "}
          <code className="text-xs bg-cream px-1.5 py-0.5 rounded">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>{" "}
          to <code className="text-xs bg-cream px-1.5 py-0.5 rounded">.env.local</code>,
          then restart the dev server.
        </p>
      </div>
    );
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (!error) {
      setState("sent");
      return;
    }
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      setErrorMessage(
        "Too many sign-in emails in the last hour, that's an email-provider limit, not you. Wait a little while and try again, or use Google sign-in.",
      );
    } else {
      setErrorMessage(
        error.message || "That didn't send. Mind trying again?",
      );
    }
    setState("error");
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <div className="rounded-2xl bg-white border border-charcoal/10 shadow-sm p-8">
      <h1 className="font-heading font-bold text-2xl text-indigo text-center">
        Welcome to CareerNext
      </h1>
      <p className="mt-2 text-sm text-charcoal/70 text-center">
        Sign in so your matches, toolkit, and progress are always waiting for
        you.
      </p>

      {authError && (
        <p className="mt-4 rounded-xl bg-gold-soft border border-gold/40 p-3 text-sm text-charcoal/80 text-center">
          That sign-in link didn&apos;t work, it may have expired. Try again
          below.
        </p>
      )}

      {state === "sent" ? (
        <div className="mt-6 rounded-xl bg-teal-soft border border-teal/30 p-5 text-center">
          <p className="font-heading font-semibold text-indigo">
            Check your email
          </p>
          <p className="mt-1 text-sm text-charcoal/70">
            We sent a sign-in link to <strong>{email}</strong>. Click it and
            you&apos;ll land right back here, signed in.
          </p>
        </div>
      ) : (
        <>
          <button
            onClick={signInWithGoogle}
            className="mt-6 w-full rounded-full border border-charcoal/15 bg-white hover:border-teal transition-colors px-6 py-3 font-heading font-semibold text-charcoal flex items-center justify-center gap-3"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.97 10.97 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-charcoal/40">
            <span className="h-px flex-1 bg-charcoal/10" />
            or
            <span className="h-px flex-1 bg-charcoal/10" />
          </div>

          <form onSubmit={sendMagicLink}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-charcoal/15 px-4 py-3 text-sm focus:outline-none focus:border-teal"
            />
            <button
              type="submit"
              disabled={state === "sending"}
              className="mt-3 w-full rounded-full bg-coral hover:bg-coral-dark transition-colors px-6 py-3 font-heading font-semibold text-white disabled:opacity-60"
            >
              {state === "sending" ? "Sending…" : "Email me a sign-in link"}
            </button>
            {state === "error" && (
              <p className="mt-3 text-sm text-coral-dark text-center">
                {errorMessage}
              </p>
            )}
            <p className="mt-4 text-xs text-charcoal/50 text-center">
              No password needed. No spam, ever.
            </p>
          </form>
        </>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex-1">
      <Header solid />
      <div className="mx-auto max-w-md px-5 py-16">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
