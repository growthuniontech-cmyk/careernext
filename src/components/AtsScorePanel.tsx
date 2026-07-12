import type { AtsScoreResult } from "@/lib/types";

/** Shared score display, used by both the standalone ATS page and the
 *  builder's live-feedback panel. */
export default function AtsScorePanel({ score }: { score: AtsScoreResult }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-indigo p-6 text-center">
        <p className="text-xs uppercase tracking-widest text-white/60 font-semibold">
          Overall ATS score
        </p>
        <p className="mt-1 font-heading font-bold text-5xl text-white">
          {Math.round(score.overallScore)}
        </p>
        <div className="mt-4 mx-auto max-w-sm">
          <div className="flex justify-between text-xs text-white/70 mb-1.5">
            <span>Keyword match</span>
            <span className="font-semibold text-teal">{Math.round(score.keywordMatchPercent)}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full rounded-full bg-teal transition-all"
              style={{ width: `${Math.min(100, score.keywordMatchPercent)}%` }}
            />
          </div>
        </div>
      </div>

      {score.missingKeywords.length > 0 && (
        <div className="rounded-2xl bg-white border border-charcoal/5 shadow-sm p-6">
          <h3 className="font-heading font-semibold text-indigo">Missing must-have keywords</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {score.missingKeywords.map((kw) => (
              <span
                key={kw}
                className="rounded-full bg-coral/10 text-coral-dark text-xs font-semibold px-3 py-1"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-charcoal/5 shadow-sm p-6">
        <h3 className="font-heading font-semibold text-indigo">Formatting checks</h3>
        <ul className="mt-3 space-y-2.5">
          {score.formattingFlags.map((f) => (
            <li key={f.id} className="flex items-start gap-2.5 text-sm">
              <span className={f.pass ? "text-teal" : "text-coral-dark"}>{f.pass ? "✓" : "✕"}</span>
              <div>
                <span className="font-medium text-charcoal">{f.label}</span>
                <p className="text-charcoal/60">{f.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-white border border-charcoal/5 shadow-sm p-6">
        <h3 className="font-heading font-semibold text-indigo">Section completeness</h3>
        <ul className="mt-3 space-y-2.5">
          {score.sectionCompleteness.map((s) => (
            <li key={s.section} className="flex items-start gap-2.5 text-sm">
              <span className={s.present ? "text-teal" : "text-coral-dark"}>{s.present ? "✓" : "✕"}</span>
              <div>
                <span className="font-medium text-charcoal">{s.section}</span>
                <p className="text-charcoal/60">{s.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-teal-soft/40 border border-teal/20 p-6">
        <h3 className="font-heading font-semibold text-indigo">What to fix, specifically</h3>
        <ul className="mt-3 space-y-2 text-sm text-charcoal/80">
          {score.suggestions.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-teal shrink-0">→</span>
              {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
