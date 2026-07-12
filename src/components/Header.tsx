"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import WorkspaceMenu from "./WorkspaceMenu";

type CurrentUser = {
  name: string | null;
  email: string | null;
};

function LogoMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-7 w-7 shrink-0" aria-hidden="true">
      <circle
        cx="20"
        cy="20"
        r="15"
        fill="none"
        stroke="white"
        strokeWidth="2"
      />
      <path
        d="M14 27V13L26 27V13"
        fill="none"
        stroke="#12b886"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26 13L32 7M27 7H32V12"
        fill="none"
        stroke="#12b886"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Header({ solid = false }: { solid?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const meta = data.user.user_metadata ?? {};
      setUser({
        name: meta.full_name ?? meta.name ?? null,
        email: data.user.email ?? null,
      });
    });
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header
      className={`w-full ${solid ? "bg-indigo" : "bg-transparent absolute top-0 left-0 z-20"}`}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-heading font-bold text-xl text-white tracking-tight"
        >
          <LogoMark />
          Career<span className="text-teal">Next</span>
        </Link>

        {/* Single shared gap across nav links, Workspace, and the CTA keeps
         *  the spacing rhythm consistent instead of drifting between them.
         *  `contents` lets nav's own links join this flex row's gap directly. */}
        <div className="flex items-center gap-3 text-sm font-medium text-white/80 sm:gap-4 lg:gap-8">
          {user && (
            <nav className="hidden lg:contents">
              <Link href="/ats" className="hover:text-white transition-colors">
                ATS Score
              </Link>
              <Link href="/builder" className="hover:text-white transition-colors">
                Resume Builder
              </Link>
            </nav>
          )}
          {user && <WorkspaceMenu user={user} onSignOut={signOut} />}
          <Link
            href="/start"
            className="rounded-full bg-coral hover:bg-coral-dark transition-colors px-4 py-1.5 font-semibold text-white"
          >
            Find your path
          </Link>
        </div>
      </div>
    </header>
  );
}
