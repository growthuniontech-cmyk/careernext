"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

type WorkspaceUser = {
  name: string | null;
  email: string | null;
};

/** Items with no destination yet (no /account or /workspace route exists);
 *  shown as clearly-marked upcoming items rather than dead links. */
const UPCOMING_ITEMS = ["Manage Workspace", "Account Settings"] as const;

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`h-3 w-3 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.5 4.5L6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Compact stand-in for the "Workspace" label on narrow screens, where the
 *  full text would crowd out the "Find your path" CTA. */
function WorkspaceIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 sm:hidden" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 5V4a2.5 2.5 0 0 1 5 0v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function WorkspaceMenu({
  user,
  onSignOut,
}: {
  user: WorkspaceUser;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const logoutRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) logoutRef.current?.focus();
  }, [open]);

  function close({ refocusTrigger = false } = {}) {
    setOpen(false);
    if (refocusTrigger) triggerRef.current?.focus();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close({ refocusTrigger: true });
    }
  }

  const displayName = user.name || user.email || "Account";

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Workspace"
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:px-3"
      >
        <WorkspaceIcon />
        <span className="hidden sm:inline">Workspace</span>
        <span className="hidden sm:block">
          <ChevronIcon open={open} />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Workspace menu"
          onKeyDown={handleMenuKeyDown}
          className="dropdown-in absolute left-1/2 z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] origin-top -translate-x-1/2 rounded-2xl border border-charcoal/10 bg-white py-2 shadow-lg sm:left-auto sm:right-0 sm:origin-top-right sm:translate-x-0"
        >
          <div className="px-4 py-2.5">
            <p className="truncate text-sm font-semibold text-indigo">{displayName}</p>
            {user.email && (
              <p className="truncate text-xs text-charcoal/55">{user.email}</p>
            )}
          </div>

          <div className="my-1 border-t border-charcoal/10" />

          {UPCOMING_ITEMS.map((label) => (
            <div
              key={label}
              role="menuitem"
              aria-disabled="true"
              className="flex w-full cursor-default items-center justify-between px-4 py-2 text-sm text-charcoal/40"
            >
              {label}
              <span className="rounded-full bg-charcoal/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-charcoal/40">
                Soon
              </span>
            </div>
          ))}

          <div className="my-1 border-t border-charcoal/10" />

          <button
            ref={logoutRef}
            role="menuitem"
            onClick={() => {
              close();
              onSignOut();
            }}
            className="w-full px-4 py-2 text-left text-sm text-charcoal transition-colors hover:bg-charcoal/5"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
