"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import StepNav from "@/components/StepNav";
import LoadingCard from "@/components/LoadingCard";
import { computeJobReadyPercent, type JourneyView, type PathStep } from "@/lib/types";

const LOADING_MESSAGES = [
  "Sequencing your learning path…",
  "Putting early wins first…",
  "Ending with proof employers can see…",
];

export default function PathPage() {
  const router = useRouter();
  const [title, setTitle] = useState<string | null>(null);
  const [steps, setSteps] = useState<PathStep[] | null>(null);
  const [completed, setCompleted] = useState<number[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/journey");
        if (!res.ok) throw new Error("unauthenticated");
        const journey = (await res.json()) as JourneyView;
        if (!journey.selectedRoleSlug) {
          router.replace("/start");
          return;
        }
        if (cancelled) return;
        setTitle(journey.selectedTitle ?? journey.selectedRoleSlug);
        setCompleted(journey.progress?.completedSteps ?? []);
        if (journey.pathSteps?.length) {
          setSteps(journey.pathSteps);
          return;
        }
        const gen = await fetch("/api/learning-path", { method: "POST" });
        if (!gen.ok) throw new Error("failed");
        const { steps } = await gen.json();
        if (!cancelled) setSteps(steps);
      } catch (err) {
        if (!cancelled) {
          if ((err as Error).message === "unauthenticated") {
            router.replace("/login");
          } else {
            setError(true);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function toggleStep(index: number) {
    const isDone = completed.includes(index);
    // Optimistic update; server is the source of truth on reload
    setCompleted((prev) =>
      isDone ? prev.filter((i) => i !== index) : [...prev, index],
    );
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepIndex: index, completed: !isDone }),
    });
    if (res.ok) {
      const { progress } = await res.json();
      setCompleted(progress.completedSteps);
    }
  }

  if (!title) return null;

  const totalHours = steps?.reduce((sum, s) => sum + s.estimatedHours, 0) ?? 0;
  const weeks = Math.max(1, Math.ceil(totalHours / 3.5)); // ~30 min/day
  const readyPercent = computeJobReadyPercent(completed, steps?.length);

  return (
    <main className="flex-1">
      <Header solid />
      <div className="mx-auto max-w-2xl px-5 py-10">
        <StepNav current={2} />
        <h1 className="font-heading font-bold text-3xl text-indigo text-center mt-4">
          Your path to {title}
        </h1>

        {error ? (
          <div className="mt-10 rounded-2xl bg-white border border-charcoal/10 p-8 text-center">
            <p className="text-charcoal/70">
              Something hiccuped while building your path.
            </p>
            <button
              onClick={() => location.reload()}
              className="mt-4 rounded-full bg-coral hover:bg-coral-dark transition-colors px-6 py-2.5 font-semibold text-white text-sm"
            >
              Try again
            </button>
          </div>
        ) : !steps ? (
          <div className="mt-10">
            <LoadingCard messages={LOADING_MESSAGES} />
          </div>
        ) : (
          <>
            <div className="mt-8 rounded-2xl bg-indigo p-6 text-center">
              <p className="text-xs uppercase tracking-widest text-white/60 font-semibold">
                Time to job-ready
              </p>
              <p className="mt-1 font-heading font-bold text-4xl text-white">
                ~{weeks} weeks
              </p>
              <p className="mt-1 text-sm text-white/70">at 30 minutes a day</p>
              <div className="mt-5 mx-auto max-w-sm">
                <div className="flex justify-between text-xs text-white/70 mb-1.5">
                  <span>Job-ready</span>
                  <span className="font-semibold text-teal">
                    {readyPercent}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal transition-all"
                    style={{ width: `${readyPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <ol className="mt-10 space-y-4">
              {steps.map((step, i) => {
                const done = completed.includes(i);
                return (
                  <li
                    key={step.title}
                    className={`rounded-2xl bg-white border shadow-sm p-6 ${
                      done ? "border-teal/50 bg-teal-soft/40" : "border-charcoal/5"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <button
                        onClick={() => toggleStep(i)}
                        aria-label={`Mark step ${i + 1} ${done ? "incomplete" : "complete"}`}
                        className={`mt-0.5 h-8 w-8 shrink-0 rounded-full font-heading font-bold text-sm flex items-center justify-center transition-colors ${
                          done
                            ? "bg-teal text-white"
                            : "bg-cream border border-charcoal/20 text-charcoal/60 hover:border-teal"
                        }`}
                      >
                        {done ? "✓" : i + 1}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <h3
                            className={`font-heading font-semibold ${
                              done
                                ? "text-teal line-through decoration-2"
                                : "text-indigo"
                            }`}
                          >
                            {step.title}
                          </h3>
                          <span className="shrink-0 text-xs text-charcoal/50">
                            ~{step.estimatedHours}h
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm text-charcoal/70">
                          {step.description}
                        </p>
                        <p className="mt-2 font-accent italic text-sm text-teal">
                          Unlocks: {step.unlocks}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <button
              onClick={() => router.push("/daily")}
              className="mt-10 w-full rounded-full bg-coral hover:bg-coral-dark transition-colors px-6 py-4 font-heading font-semibold text-white text-lg"
            >
              Start today&apos;s task
            </button>
          </>
        )}
      </div>
    </main>
  );
}
