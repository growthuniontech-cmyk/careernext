"use client";

import { useState } from "react";
import type { ExperienceEntry } from "@/lib/types";

const inputClass =
  "w-full rounded-xl border border-charcoal/15 px-3.5 py-2 text-sm focus:outline-none focus:border-teal";

/** One Experience entry: role details, the guided challenge/change/metric
 *  prompts, an AI rewrite action, and the resulting editable bullet list. */
export default function ExperienceEditor({
  entry,
  jdText,
  onChange,
  onRemove,
}: {
  entry: ExperienceEntry;
  jdText: string | null;
  onChange: (entry: ExperienceEntry) => void;
  onRemove: () => void;
}) {
  const [rewriting, setRewriting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  function patch(fields: Partial<ExperienceEntry>) {
    onChange({ ...entry, ...fields });
  }

  async function rewrite() {
    setRewriting(true);
    setRewriteError(null);
    try {
      const res = await fetch("/api/builder/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: entry.title,
          company: entry.company,
          challenge: entry.challenge,
          change: entry.change,
          metric: entry.metric,
          jdText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "rewrite_failed");
      patch({ bullets: data.bullets });
      setSuggestions(data.suggestions ?? []);
    } catch {
      setRewriteError("Couldn't rewrite this one. Try adding a bit more detail above.");
    } finally {
      setRewriting(false);
    }
  }

  function updateBullet(i: number, text: string) {
    patch({ bullets: entry.bullets.map((b, j) => (j === i ? text : b)) });
  }
  function removeBullet(i: number) {
    patch({ bullets: entry.bullets.filter((_, j) => j !== i) });
  }
  function addBullet() {
    patch({ bullets: [...entry.bullets, ""] });
  }

  return (
    <div className="rounded-2xl bg-white border border-charcoal/10 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="grid grid-cols-2 gap-2.5 flex-1">
          <input
            value={entry.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Job title"
            className={inputClass}
          />
          <input
            value={entry.company}
            onChange={(e) => patch({ company: e.target.value })}
            placeholder="Company"
            className={inputClass}
          />
          <input
            value={entry.location}
            onChange={(e) => patch({ location: e.target.value })}
            placeholder="Location"
            className={inputClass}
          />
          <div className="flex gap-2">
            <input
              value={entry.startDate}
              onChange={(e) => patch({ startDate: e.target.value })}
              placeholder="Start (e.g. Jan 2022)"
              className={inputClass}
            />
            <input
              value={entry.endDate}
              onChange={(e) => patch({ endDate: e.target.value })}
              placeholder="End (or Present)"
              className={inputClass}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-charcoal/40 hover:text-coral-dark shrink-0"
        >
          Remove
        </button>
      </div>

      <div className="rounded-xl bg-cream/60 border border-charcoal/10 p-4 space-y-2.5">
        <p className="text-xs uppercase tracking-widest font-semibold text-indigo/70">
          Tell us what happened, we&apos;ll help you write it up
        </p>
        <label className="block text-sm text-charcoal/80">
          What challenge did you solve?
          <textarea
            value={entry.challenge}
            onChange={(e) => patch({ challenge: e.target.value })}
            rows={2}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="block text-sm text-charcoal/80">
          What changed because of it?
          <textarea
            value={entry.change}
            onChange={(e) => patch({ change: e.target.value })}
            rows={2}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="block text-sm text-charcoal/80">
          Can you quantify it? (a number, percent, or scale, optional but strong)
          <input
            value={entry.metric}
            onChange={(e) => patch({ metric: e.target.value })}
            placeholder="e.g. cut onboarding time 30%, or leave blank"
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <button
          type="button"
          onClick={rewrite}
          disabled={rewriting || (!entry.challenge.trim() && !entry.change.trim())}
          className="rounded-full bg-indigo hover:bg-indigo-light disabled:opacity-40 transition-colors px-4 py-2 text-sm font-semibold text-white"
        >
          {rewriting ? "Rewriting…" : "Rewrite with AI"}
        </button>
        {rewriteError && <p className="text-sm text-coral-dark">{rewriteError}</p>}
      </div>

      <div className="space-y-1.5">
        {entry.bullets.map((bullet, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-2.5 text-teal">●</span>
            <textarea
              value={bullet}
              onChange={(e) => updateBullet(i, e.target.value)}
              rows={2}
              className={`flex-1 ${inputClass}`}
            />
            <button
              type="button"
              onClick={() => removeBullet(i)}
              className="mt-2 text-charcoal/40 hover:text-coral-dark"
              aria-label="Remove bullet"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addBullet}
          className="text-sm text-teal hover:underline underline-offset-2"
        >
          + Add bullet manually
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="rounded-xl bg-gold-soft border border-gold/40 px-4 py-3">
          <p className="text-xs uppercase tracking-wide font-semibold text-indigo mb-1.5">
            Suggestions to make this stronger
          </p>
          <ul className="text-sm text-charcoal/80 space-y-1">
            {suggestions.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
