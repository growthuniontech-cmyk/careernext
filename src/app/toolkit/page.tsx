"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import StepNav from "@/components/StepNav";
import LoadingCard from "@/components/LoadingCard";
import type { JourneyView, ToolkitTool } from "@/lib/types";

const TIERS: {
  key: ToolkitTool["tier"];
  label: string;
  badge: string;
  hint: string;
}[] = [
  {
    key: "high",
    label: "High impact",
    badge: "bg-teal text-white",
    hint: "Learn these first — you'll use them daily.",
  },
  {
    key: "medium",
    label: "Medium impact",
    badge: "bg-indigo text-white",
    hint: "Weekly workhorses. Add them once the basics stick.",
  },
];

const LOADING_MESSAGES = [
  "Building your toolkit…",
  "Matching tools to your gaps…",
  "Cutting the noise — only what matters…",
];

export default function ToolkitPage() {
  const router = useRouter();
  const [title, setTitle] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolkitTool[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/journey");
        if (!res.ok) throw new Error("unauthenticated");
        const journey = (await res.json()) as JourneyView;
        if (!journey.selectedRoleSlug) {
          router.replace(journey.matches?.length ? "/results" : "/start");
          return;
        }
        if (cancelled) return;
        setTitle(journey.selectedTitle ?? journey.selectedRoleSlug);
        if (journey.toolkit?.length) {
          setTools(journey.toolkit);
          return;
        }
        const gen = await fetch("/api/toolkit", { method: "POST" });
        if (!gen.ok) throw new Error("failed");
        const { tools } = await gen.json();
        if (!cancelled) setTools(tools);
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

  if (!title) return null;

  return (
    <main className="flex-1">
      <Header solid />
      <div className="mx-auto max-w-2xl px-5 py-10">
        <StepNav current={1} />
        <h1 className="font-heading font-bold text-3xl text-indigo text-center mt-4">
          Your AI toolkit for {title}
        </h1>
        <p className="mt-3 text-center text-charcoal/70">
          Not every tool — the right ones for your background, in order of
          impact.
        </p>

        <div className="mt-10">
          {error ? (
            <div className="rounded-2xl bg-white border border-charcoal/10 p-8 text-center">
              <p className="text-charcoal/70">
                Something hiccuped while building your toolkit.
              </p>
              <button
                onClick={() => location.reload()}
                className="mt-4 rounded-full bg-coral hover:bg-coral-dark transition-colors px-6 py-2.5 font-semibold text-white text-sm"
              >
                Try again
              </button>
            </div>
          ) : !tools ? (
            <LoadingCard messages={LOADING_MESSAGES} />
          ) : (
            <>
              {TIERS.map((tier) => {
                const tierTools = tools.filter((t) => t.tier === tier.key);
                if (!tierTools.length) return null;
                return (
                  <section key={tier.key} className="mb-8">
                    <div className="flex items-baseline gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-heading font-semibold ${tier.badge}`}
                      >
                        {tier.label}
                      </span>
                      <p className="text-xs text-charcoal/50">{tier.hint}</p>
                    </div>
                    <div className="mt-3 space-y-3">
                      {tierTools.map((tool) => (
                        <div
                          key={tool.name}
                          className="rounded-2xl bg-white border border-charcoal/5 shadow-sm p-5"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <h3 className="font-heading font-semibold text-indigo">
                              {tool.name}
                            </h3>
                            {tool.url && (
                              <a
                                href={tool.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-coral hover:text-coral-dark font-semibold shrink-0"
                              >
                                Visit ↗
                              </a>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-charcoal/70">
                            {tool.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}

              <button
                onClick={() => router.push("/path")}
                className="mt-4 w-full rounded-full bg-coral hover:bg-coral-dark transition-colors px-6 py-4 font-heading font-semibold text-white text-lg"
              >
                Build my learning path
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
