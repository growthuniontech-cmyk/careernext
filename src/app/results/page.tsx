"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import StepNav from "@/components/StepNav";
import type { JobMatch, JourneyView } from "@/lib/types";

export default function ResultsPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<JobMatch[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/journey")
      .then(async (res) => {
        if (!res.ok) throw new Error("unauthenticated");
        const journey = (await res.json()) as JourneyView;
        if (!journey.matches?.length) {
          router.replace("/start");
          return;
        }
        setMatches(journey.matches);
        setSelected(journey.selectedRoleSlug ?? journey.matches[0].roleSlug);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!matches) return null;

  async function proceed() {
    if (!selected || saving) return;
    setSaving(true);
    const res = await fetch("/api/journey", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedRoleSlug: selected }),
    });
    if (res.ok) {
      router.push("/toolkit");
    } else {
      setSaving(false);
    }
  }

  const selectedTitle = matches.find((m) => m.roleSlug === selected)?.title;

  return (
    <main className="flex-1">
      <Header solid />
      <div className="mx-auto max-w-2xl px-5 py-10">
        <StepNav current={0} />
        <h1 className="font-heading font-bold text-3xl text-indigo text-center mt-4">
          Here&apos;s where you match
        </h1>
        <p className="mt-3 text-center text-charcoal/70">
          Ranked against your actual background. Pick the one that feels right,
          you can come back and switch.
        </p>

        <div className="mt-10 space-y-4">
          {matches.map((match, i) => {
            const isSelected = selected === match.roleSlug;
            return (
              <button
                key={match.roleSlug}
                onClick={() => setSelected(match.roleSlug)}
                className={`w-full rounded-2xl bg-white p-6 text-left transition-all border-2 ${
                  isSelected
                    ? "border-teal shadow-md"
                    : "border-transparent shadow-sm hover:border-teal/40"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-heading font-bold text-charcoal/40">
                      #{i + 1}
                    </span>
                    <h2 className="font-heading font-semibold text-lg text-indigo">
                      {match.title}
                    </h2>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="font-heading font-bold text-2xl text-teal">
                      {Math.round(match.score)}%
                    </span>
                    <p className="text-[10px] uppercase tracking-wide text-charcoal/40">
                      match
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-teal-soft overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal transition-all"
                    style={{ width: `${Math.min(100, match.score)}%` }}
                  />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-charcoal/70">
                  {match.reason}
                </p>
              </button>
            );
          })}
        </div>

        <button
          onClick={proceed}
          disabled={!selected || saving}
          className="mt-10 w-full rounded-full bg-coral hover:bg-coral-dark transition-colors px-6 py-4 font-heading font-semibold text-white text-lg disabled:opacity-50"
        >
          {saving
            ? "Saving…"
            : `Show my AI toolkit${selectedTitle ? ` for ${selectedTitle}` : ""}`}
        </button>
      </div>
    </main>
  );
}
