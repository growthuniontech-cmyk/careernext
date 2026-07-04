"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/browser";

type CurrentUser = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const meta = data.user.user_metadata ?? {};
      setUser({
        name: meta.full_name ?? meta.name ?? null,
        email: data.user.email ?? null,
        avatarUrl: meta.avatar_url ?? meta.picture ?? null,
      });
    });
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  const displayName = user?.name || user?.email || "";
  const initial = displayName.charAt(0).toUpperCase() || "?";

  return (
    <header
      className={`w-full ${solid ? "bg-indigo" : "bg-transparent absolute top-0 left-0 z-20"}`}
    >
      <div className="mx-auto max-w-5xl px-5 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-heading font-bold text-xl text-white tracking-tight"
        >
          <LogoMark />
          Career<span className="text-teal">Next</span>
        </Link>
        <div className="flex items-center gap-4">
          {user && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full text-white/90 hover:text-white transition-colors"
                aria-expanded={menuOpen}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal text-sm font-semibold text-white">
                    {initial}
                  </span>
                )}
                <span className="hidden sm:inline text-sm max-w-[10rem] truncate">
                  {displayName}
                </span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg bg-white shadow-lg py-1 z-30">
                  <div className="px-4 py-2 border-b border-black/10">
                    {user.name && (
                      <p className="text-sm font-medium text-charcoal truncate">
                        {user.name}
                      </p>
                    )}
                    {user.email && (
                      <p className="text-xs text-charcoal/60 truncate">
                        {user.email}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={signOut}
                    className="w-full text-left px-4 py-2 text-sm text-charcoal hover:bg-black/5 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
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
