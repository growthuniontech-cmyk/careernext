"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/browser";

export default function Header({ solid = false }: { solid?: boolean }) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setSignedIn(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header
      className={`w-full ${solid ? "bg-indigo" : "bg-transparent absolute top-0 left-0 z-20"}`}
    >
      <div className="mx-auto max-w-5xl px-5 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="font-heading font-bold text-xl text-white tracking-tight"
        >
          Career<span className="text-teal">Next</span>
        </Link>
        <div className="flex items-center gap-4">
          {signedIn && (
            <button
              onClick={signOut}
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Sign out
            </button>
          )}
          <Link
            href="/start"
            className="rounded-full bg-coral hover:bg-coral-dark transition-colors px-4 py-1.5 text-sm font-semibold text-white"
          >
            Find your path
          </Link>
        </div>
      </div>
    </header>
  );
}
