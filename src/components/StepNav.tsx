"use client";

import Link from "next/link";

const STEPS = [
  { label: "Match", href: "/results" },
  { label: "Toolkit", href: "/toolkit" },
  { label: "Path", href: "/path" },
  { label: "Daily", href: "/daily" },
];

/** Compact progress indicator for the in-flow screens. */
export default function StepNav({ current }: { current: number }) {
  return (
    <nav className="flex items-center justify-center gap-2 text-xs font-semibold py-4">
      {STEPS.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2">
          {i > 0 && <span className="h-px w-6 bg-charcoal/20" />}
          {i < current ? (
            <Link
              href={step.href}
              className="text-teal hover:underline underline-offset-2"
            >
              ✓ {step.label}
            </Link>
          ) : (
            <span
              className={
                i === current
                  ? "text-indigo bg-white border border-indigo/20 rounded-full px-3 py-1"
                  : "text-charcoal/40"
              }
            >
              {step.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
