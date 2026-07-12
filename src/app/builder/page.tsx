"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import ListEditor from "@/components/builder/ListEditor";
import ExperienceEditor from "@/components/builder/ExperienceEditor";
import AtsScorePanel from "@/components/AtsScorePanel";
import { getSectionOrder, pageCapFor, normalizeSections } from "@/lib/builder-sections";
import { MIN_SKILLS_FOR_EXPORT } from "@/lib/export-docx";
import type { AtsScoreResult, BuilderSections, EducationEntry, ExperienceEntry } from "@/lib/types";

const inputClass =
  "w-full rounded-xl border border-charcoal/15 px-3.5 py-2 text-sm focus:outline-none focus:border-teal";

const SECTION_LABELS: Record<string, string> = {
  header: "Header",
  summary: "Professional Summary",
  coreCompetencies: "Core Competencies",
  experience: "Experience",
  awards: "Awards",
  education: "Education",
  certifications: "Certifications",
  memberships: "Memberships",
  publications: "Publications",
  volunteer: "Volunteer",
};

function newId() {
  return crypto.randomUUID();
}

function emptyExperience(): ExperienceEntry {
  return {
    id: newId(),
    title: "",
    company: "",
    location: "",
    startDate: "",
    endDate: "",
    challenge: "",
    change: "",
    metric: "",
    bullets: [],
  };
}

function emptyEducation(): EducationEntry {
  return { id: newId(), degree: "", school: "", year: "" };
}

export default function BuilderPage() {
  const router = useRouter();
  const [sections, setSections] = useState<BuilderSections | null>(null);
  const [jdText, setJdText] = useState("");
  const [atsScore, setAtsScore] = useState<AtsScoreResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [tailorResult, setTailorResult] = useState<{
    jdKeywords: string[];
    summaryRewrite: string;
    headerTitleSuggestion: string | null;
    experienceReorders: { experienceId: string; orderedBullets: string[] }[];
    skillsAligned: string[];
    suggestions: string[];
  } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/builder")
      .then(async (res) => {
        if (!res.ok) throw new Error("unauthenticated");
        const data = await res.json();
        setSections(normalizeSections(data.sections));
        setJdText(data.jdText ?? "");
        setAtsScore(data.atsScore ?? null);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!sections) return null;

  function patch(fields: Partial<BuilderSections>) {
    setSections((s) => (s ? { ...s, ...fields } : s));
  }

  async function save() {
    if (!sections) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/builder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections, jdText: jdText.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("save_failed");
      setAtsScore(data.atsScore ?? null);
      setMessage("Saved.");
    } catch {
      setMessage("Something hiccuped while saving. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function runTailor() {
    if (!sections || !jdText.trim()) return;
    setTailoring(true);
    setTailorResult(null);
    setMessage(null);
    try {
      const res = await fetch("/api/builder/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections, jdText: jdText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "tailor_failed");
      setTailorResult(data);
    } catch {
      setMessage("Couldn't tailor to this JD right now. Try again.");
    } finally {
      setTailoring(false);
    }
  }

  function applySummary() {
    if (tailorResult) patch({ summary: tailorResult.summaryRewrite });
  }
  function applyHeaderTitle() {
    if (sections && tailorResult?.headerTitleSuggestion) {
      patch({ header: { ...sections.header, title: tailorResult.headerTitleSuggestion } });
    }
  }
  function applySkills() {
    if (tailorResult) patch({ coreCompetencies: tailorResult.skillsAligned });
  }
  function applyReorders() {
    if (!tailorResult || !sections) return;
    const byId = new Map(tailorResult.experienceReorders.map((r) => [r.experienceId, r.orderedBullets]));
    patch({
      experience: sections.experience.map((e) =>
        byId.has(e.id) ? { ...e, bullets: byId.get(e.id)! } : e,
      ),
    });
  }

  async function exportDocx() {
    setExporting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/builder/export", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.message ?? "Couldn't export yet. Save your resume first.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+)"/);
      a.download = match?.[1] ?? "resume.docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage("Something hiccuped while exporting. Try again.");
    } finally {
      setExporting(false);
    }
  }

  const order = getSectionOrder(sections.experienceLevel);
  const pageCap = pageCapFor(sections.experienceLevel);

  return (
    <main className="flex-1">
      <Header solid />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-heading font-bold text-3xl text-indigo text-center">
          Build your resume
        </h1>
        <p className="mt-3 text-center text-charcoal/70">
          Guided input, AI polish, and a live ATS score as you go.
        </p>

        <div className="mt-8 rounded-2xl bg-white border border-charcoal/10 shadow-sm p-5">
          <fieldset className="flex items-center gap-4 text-sm">
            <legend className="font-heading font-semibold text-indigo mb-2">
              Experience level
            </legend>
            {(["fresher", "experienced"] as const).map((level) => (
              <label key={level} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  checked={sections.experienceLevel === level}
                  onChange={() => patch({ experienceLevel: level })}
                  className="accent-[#12B886]"
                />
                {level === "fresher" ? "Fresher (0-2 yrs)" : "Experienced (2+ yrs)"}
              </label>
            ))}
          </fieldset>
          <p className="mt-2 text-xs text-charcoal/50">
            Section order: {order.map((k) => SECTION_LABELS[k]).join(" -> ")}. Page cap: {pageCap}.
          </p>
        </div>

        {/* Header */}
        <section className="mt-6 rounded-2xl bg-white border border-charcoal/10 shadow-sm p-5">
          <h2 className="font-heading font-semibold text-indigo">Header</h2>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <input
              value={sections.header.name}
              onChange={(e) => patch({ header: { ...sections.header, name: e.target.value } })}
              placeholder="Full name"
              className={inputClass}
            />
            <input
              value={sections.header.title}
              onChange={(e) => patch({ header: { ...sections.header, title: e.target.value } })}
              placeholder="Target title"
              className={inputClass}
            />
            <input
              value={sections.header.email}
              onChange={(e) => patch({ header: { ...sections.header, email: e.target.value } })}
              placeholder="Email"
              className={inputClass}
            />
            <input
              value={sections.header.phone}
              onChange={(e) => patch({ header: { ...sections.header, phone: e.target.value } })}
              placeholder="Phone"
              className={inputClass}
            />
            <input
              value={sections.header.location}
              onChange={(e) => patch({ header: { ...sections.header, location: e.target.value } })}
              placeholder="Location"
              className={inputClass}
            />
            <input
              value={sections.header.linkedin}
              onChange={(e) => patch({ header: { ...sections.header, linkedin: e.target.value } })}
              placeholder="LinkedIn URL"
              className={inputClass}
            />
            <input
              value={sections.header.portfolio}
              onChange={(e) => patch({ header: { ...sections.header, portfolio: e.target.value } })}
              placeholder="Portfolio URL (optional)"
              className={inputClass}
            />
          </div>
        </section>

        {/* Summary */}
        <section className="mt-6 rounded-2xl bg-white border border-charcoal/10 shadow-sm p-5">
          <h2 className="font-heading font-semibold text-indigo">Professional Summary</h2>
          <textarea
            value={sections.summary}
            onChange={(e) => patch({ summary: e.target.value })}
            rows={3}
            className={`mt-3 ${inputClass}`}
          />
        </section>

        {/* Core competencies */}
        <section className="mt-6 rounded-2xl bg-white border border-charcoal/10 shadow-sm p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-heading font-semibold text-indigo">Core Competencies</h2>
            <span
              className={`text-xs font-semibold ${
                sections.coreCompetencies.length >= MIN_SKILLS_FOR_EXPORT ? "text-teal" : "text-coral-dark"
              }`}
            >
              {sections.coreCompetencies.length}/{MIN_SKILLS_FOR_EXPORT}+
            </span>
          </div>
          <div className="mt-3">
            <ListEditor
              items={sections.coreCompetencies}
              onChange={(items) => patch({ coreCompetencies: items })}
              placeholder="Add a skill…"
            />
          </div>
        </section>

        {/* Experience */}
        <section className="mt-6">
          <h2 className="font-heading font-semibold text-indigo px-1">Experience</h2>
          <div className="mt-3 space-y-4">
            {sections.experience.map((entry) => (
              <ExperienceEditor
                key={entry.id}
                entry={entry}
                jdText={jdText.trim() || null}
                onChange={(updated) =>
                  patch({ experience: sections.experience.map((e) => (e.id === entry.id ? updated : e)) })
                }
                onRemove={() => patch({ experience: sections.experience.filter((e) => e.id !== entry.id) })}
              />
            ))}
            <button
              type="button"
              onClick={() => patch({ experience: [...sections.experience, emptyExperience()] })}
              className="w-full rounded-xl border-2 border-dashed border-charcoal/20 hover:border-teal transition-colors py-3 text-sm font-semibold text-charcoal/60"
            >
              + Add role
            </button>
          </div>
        </section>

        {/* Education */}
        <section className="mt-6 rounded-2xl bg-white border border-charcoal/10 shadow-sm p-5">
          <h2 className="font-heading font-semibold text-indigo">Education</h2>
          <div className="mt-3 space-y-2.5">
            {sections.education.map((ed) => (
              <div key={ed.id} className="grid grid-cols-3 gap-2">
                <input
                  value={ed.degree}
                  onChange={(e) =>
                    patch({
                      education: sections.education.map((x) =>
                        x.id === ed.id ? { ...x, degree: e.target.value } : x,
                      ),
                    })
                  }
                  placeholder="Degree"
                  className={inputClass}
                />
                <input
                  value={ed.school}
                  onChange={(e) =>
                    patch({
                      education: sections.education.map((x) =>
                        x.id === ed.id ? { ...x, school: e.target.value } : x,
                      ),
                    })
                  }
                  placeholder="School"
                  className={inputClass}
                />
                <div className="flex gap-2">
                  <input
                    value={ed.year}
                    onChange={(e) =>
                      patch({
                        education: sections.education.map((x) =>
                          x.id === ed.id ? { ...x, year: e.target.value } : x,
                        ),
                      })
                    }
                    placeholder="Year"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => patch({ education: sections.education.filter((x) => x.id !== ed.id) })}
                    className="text-charcoal/40 hover:text-coral-dark"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => patch({ education: [...sections.education, emptyEducation()] })}
              className="text-sm text-teal hover:underline underline-offset-2"
            >
              + Add education
            </button>
          </div>
        </section>

        {/* Simple list sections */}
        {(
          [
            ["awards", "Awards", "Add an award…"],
            ["certifications", "Certifications", "Add a certification…"],
            ["memberships", "Memberships", "Add a membership…"],
            ["publications", "Publications", "Add a publication…"],
            ["volunteer", "Volunteer", "Add volunteer experience…"],
          ] as const
        ).map(([key, label, placeholder]) => (
          <section key={key} className="mt-6 rounded-2xl bg-white border border-charcoal/10 shadow-sm p-5">
            <h2 className="font-heading font-semibold text-indigo">{label}</h2>
            <div className="mt-3">
              <ListEditor
                items={sections[key]}
                onChange={(items) => patch({ [key]: items } as Partial<BuilderSections>)}
                placeholder={placeholder}
              />
            </div>
          </section>
        ))}

        {/* JD tailoring */}
        <section className="mt-8 rounded-2xl bg-indigo p-6">
          <h2 className="font-heading font-semibold text-white">Tailor to a job description</h2>
          <textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            rows={6}
            placeholder="Paste the job description you're targeting…"
            className="mt-3 w-full rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-teal"
          />
          <button
            onClick={runTailor}
            disabled={tailoring || !jdText.trim()}
            className="mt-3 rounded-full bg-teal hover:bg-teal/90 disabled:opacity-40 transition-colors px-5 py-2.5 text-sm font-semibold text-white"
          >
            {tailoring ? "Tailoring…" : "Extract keywords and suggest changes"}
          </button>

          {tailorResult && (
            <div className="mt-5 rounded-xl bg-white/10 p-4 space-y-3 text-white text-sm">
              <div>
                <p className="font-semibold">JD keywords</p>
                <p className="text-white/70">{tailorResult.jdKeywords.join(", ")}</p>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Suggested summary</p>
                  <p className="text-white/70">{tailorResult.summaryRewrite}</p>
                </div>
                <button
                  onClick={applySummary}
                  className="shrink-0 rounded-full bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-semibold"
                >
                  Apply
                </button>
              </div>

              {tailorResult.headerTitleSuggestion && (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">Suggested title</p>
                    <p className="text-white/70">{tailorResult.headerTitleSuggestion}</p>
                  </div>
                  <button
                    onClick={applyHeaderTitle}
                    className="shrink-0 rounded-full bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-semibold"
                  >
                    Apply
                  </button>
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Skills, JD-aligned order</p>
                  <p className="text-white/70">{tailorResult.skillsAligned.join(", ")}</p>
                </div>
                <button
                  onClick={applySkills}
                  className="shrink-0 rounded-full bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-semibold"
                >
                  Apply
                </button>
              </div>

              {tailorResult.experienceReorders.length > 0 && (
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">Reorder experience bullets, most-relevant-first</p>
                  <button
                    onClick={applyReorders}
                    className="shrink-0 rounded-full bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-semibold"
                  >
                    Apply
                  </button>
                </div>
              )}

              <div>
                <p className="font-semibold">Suggestions</p>
                <ul className="text-white/70 space-y-1">
                  {tailorResult.suggestions.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        {message && <p className="mt-4 text-center text-sm text-charcoal/70">{message}</p>}

        <div className="mt-6 flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-full bg-coral hover:bg-coral-dark disabled:opacity-40 transition-colors px-6 py-3.5 font-heading font-semibold text-white"
          >
            {saving ? "Saving…" : "Save & score"}
          </button>
          <button
            onClick={exportDocx}
            disabled={exporting}
            className="flex-1 rounded-full bg-indigo hover:bg-indigo-light disabled:opacity-40 transition-colors px-6 py-3.5 font-heading font-semibold text-white"
          >
            {exporting ? "Exporting…" : "Export .docx"}
          </button>
        </div>

        {atsScore && (
          <div className="mt-10">
            <h2 className="font-heading font-bold text-2xl text-indigo text-center mb-4">
              Live ATS feedback
            </h2>
            <AtsScorePanel score={atsScore} />
          </div>
        )}
      </div>
    </main>
  );
}
