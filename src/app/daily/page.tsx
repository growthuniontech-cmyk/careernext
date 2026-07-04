"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import StepNav from "@/components/StepNav";
import { computeJobReadyPercent, type JourneyView, type PathStep, type Progress } from "@/lib/types";

export default function DailyPage() {
  const router = useRouter();
  const [journey, setJourney] = useState<JourneyView | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    fetch("/api/journey")
      .then(async (res) => {
        if (!res.ok) throw new Error("unauthenticated");
        const view = (await res.json()) as JourneyView;
        if (!view.selectedRoleSlug) {
          router.replace("/start");
          return;
        }
        setJourney(view);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!journey) return null;

  const steps: PathStep[] = journey.pathSteps ?? [];
  const progress: Progress = journey.progress ?? {
    completedSteps: [],
    streak: 0,
    lastCompletedDate: null,
  };

  const nextIndex = steps.findIndex(
    (_, i) => !progress.completedSteps.includes(i),
  );
  const allDone = steps.length > 0 && nextIndex === -1;
  const readyPercent = computeJobReadyPercent(
    progress.completedSteps,
    steps.length,
  );
  const task = nextIndex >= 0 ? steps[nextIndex] : null;

  async function completeToday() {
    if (nextIndex < 0) return;
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepIndex: nextIndex, completed: true }),
    });
    if (res.ok) {
      const { progress: updated } = await res.json();
      setJourney((j) => (j ? { ...j, progress: updated } : j));
      setJustCompleted(true);
    }
  }

  return (
    <main className="flex-1">
      <Header solid />
      <div className="mx-auto max-w-xl px-5 py-10">
        <StepNav current={3} />

        {/* Streak + job-ready — same formula everywhere */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white border border-charcoal/5 shadow-sm p-5 text-center">
            <p className="font-heading font-bold text-4xl text-gold drop-shadow-sm">
              {progress.streak}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-charcoal/50 font-semibold">
              day streak {progress.streak > 0 && "🔥"}
            </p>
          </div>
          <div className="rounded-2xl bg-white border border-charcoal/5 shadow-sm p-5 text-center">
            <p className="font-heading font-bold text-4xl text-teal">
              {readyPercent}%
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-charcoal/50 font-semibold">
              job-ready
            </p>
          </div>
        </div>
        <div className="mt-3 h-2.5 rounded-full bg-teal-soft overflow-hidden">
          <div
            className="h-full rounded-full bg-teal transition-all duration-700"
            style={{ width: `${readyPercent}%` }}
          />
        </div>

        {steps.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-white border border-charcoal/5 shadow-sm p-7 text-center">
            <p className="text-charcoal/70 text-sm">
              Your learning path isn&apos;t built yet — that comes first.
            </p>
            <Link
              href="/path"
              className="mt-4 inline-block rounded-full bg-coral hover:bg-coral-dark transition-colors px-6 py-3 font-heading font-semibold text-white text-sm"
            >
              Build my path
            </Link>
          </div>
        ) : allDone ? (
          <div className="mt-8 rounded-2xl bg-gold-soft border border-gold/40 shadow-sm p-7 text-center">
            <p className="text-4xl">🏆</p>
            <h2 className="mt-3 font-heading font-bold text-xl text-indigo">
              Path complete — you&apos;re job-ready.
            </h2>
            <p className="mt-2 text-sm text-charcoal/70">
              You finished every step toward {journey.selectedTitle}. Time to
              put that portfolio project in front of employers.
            </p>
          </div>
        ) : (
          <div
            className={`mt-8 rounded-2xl border shadow-sm p-7 ${
              justCompleted
                ? "bg-gold-soft border-gold/40"
                : "bg-white border-charcoal/5"
            }`}
          >
            {justCompleted ? (
              <div className="text-center">
                <p className="text-4xl">🎉</p>
                <h2 className="mt-3 font-heading font-bold text-xl text-indigo">
                  Step done. Momentum banked.
                </h2>
                <p className="mt-2 text-sm text-charcoal/70">
                  Your job-ready score just moved. Small steps, every day —
                  that&apos;s how people actually change careers.
                </p>
                <button
                  onClick={() => setJustCompleted(false)}
                  className="mt-5 rounded-full border border-charcoal/15 hover:border-teal transition-colors px-6 py-2.5 text-sm font-semibold text-charcoal"
                >
                  Show my next task
                </button>
              </div>
            ) : (
              task && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-widest text-charcoal/50 font-semibold">
                      Today&apos;s task · step {nextIndex + 1} of {steps.length}
                    </p>
                    <span className="rounded-full bg-teal-soft text-teal text-xs font-semibold px-3 py-1">
                      ~{task.estimatedHours}h total
                    </span>
                  </div>
                  <h2 className="mt-3 font-heading font-bold text-xl text-indigo">
                    {task.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-charcoal/70">
                    {task.description}
                  </p>
                  <p className="mt-3 font-accent italic text-sm text-teal">
                    Unlocks: {task.unlocks}
                  </p>
                  <button
                    onClick={completeToday}
                    className="mt-6 w-full rounded-full bg-coral hover:bg-coral-dark transition-colors px-6 py-3.5 font-heading font-semibold text-white"
                  >
                    Done — count it
                  </button>
                </>
              )
            )}
          </div>
        )}

        <p className="mt-6 text-center font-accent italic text-sm text-charcoal/50">
          Momentum beats motivation. One step at a time is the whole game.
        </p>
      </div>
    </main>
  );
}
