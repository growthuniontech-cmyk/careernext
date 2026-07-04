"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import LoadingCard from "@/components/LoadingCard";

type Phase = "choose" | "parsing" | "matching" | "manual";

const PARSE_MESSAGES = [
  "Reading your resume…",
  "Spotting your transferable skills…",
  "You have more going for you than you think…",
  "Almost there — mapping your strengths…",
];

const MATCH_MESSAGES = [
  "Matching you to real roles…",
  "Scoring your compatibility…",
  "Finding where you'd shine fastest…",
];

const FALLBACK_COPY =
  "No resume yet? No problem — tell us where you're starting from, and we'll build your path from there.";

export default function StartPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("choose");
  const [parseFailed, setParseFailed] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [role, setRole] = useState("");
  const [years, setYears] = useState("");
  const [skills, setSkills] = useState(["", "", ""]);
  const [manualError, setManualError] = useState("");

  async function runMatch() {
    setPhase("matching");
    const res = await fetch("/api/match", { method: "POST" });
    if (!res.ok) {
      setParseFailed(true);
      setPhase("manual");
      return;
    }
    router.push("/results");
  }

  async function handleFile(file: File) {
    setPhase("parsing");
    setParseFailed(false);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("parse_failed");
      await runMatch();
    } catch {
      setParseFailed(true);
      setPhase("manual");
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const topSkills = skills.map((s) => s.trim()).filter(Boolean);
    if (!role.trim() || topSkills.length === 0) {
      setManualError("Please add your role and at least one skill.");
      return;
    }
    setManualError("");
    setPhase("matching");
    const res = await fetch("/api/manual-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentRole: role,
        yearsExperience: Number(years) || 0,
        skills: topSkills,
      }),
    });
    if (!res.ok) {
      setManualError("That didn't save — mind trying again?");
      setPhase("manual");
      return;
    }
    await runMatch();
  }

  const busy = phase === "parsing" || phase === "matching";

  return (
    <main className="flex-1">
      <Header solid />
      <div className="mx-auto max-w-xl px-5 py-14">
        {busy ? (
          <LoadingCard
            messages={phase === "parsing" ? PARSE_MESSAGES : MATCH_MESSAGES}
          />
        ) : (
          <>
            <h1 className="font-heading font-bold text-3xl text-indigo text-center">
              Let&apos;s find your path
            </h1>
            <p className="mt-3 text-center text-charcoal/70">
              Start with your resume — or without one. Both work.
            </p>

            {phase === "choose" && (
              <>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFile(file);
                  }}
                  onClick={() => fileInput.current?.click()}
                  className={`mt-8 cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors bg-white ${
                    dragging
                      ? "border-teal bg-teal-soft"
                      : "border-charcoal/20 hover:border-teal"
                  }`}
                >
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />
                  <div className="mx-auto h-12 w-12 rounded-full bg-teal-soft flex items-center justify-center">
                    <svg
                      className="h-6 w-6 text-teal"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4"
                      />
                    </svg>
                  </div>
                  <p className="mt-4 font-heading font-semibold text-indigo">
                    Upload your resume
                  </p>
                  <p className="mt-1 text-sm text-charcoal/60">
                    PDF or DOCX · drag and drop or click to browse
                  </p>
                </div>

                <div className="my-6 flex items-center gap-3 text-xs text-charcoal/40">
                  <span className="h-px flex-1 bg-charcoal/10" />
                  or
                  <span className="h-px flex-1 bg-charcoal/10" />
                </div>

                <button
                  onClick={() => setPhase("manual")}
                  className="w-full rounded-2xl bg-white border border-charcoal/10 p-6 text-left hover:border-teal transition-colors"
                >
                  <p className="font-heading font-semibold text-indigo">
                    No resume yet? No problem.
                  </p>
                  <p className="mt-1 text-sm text-charcoal/60">
                    Tell us where you&apos;re starting from, and we&apos;ll
                    build your path from there.
                  </p>
                </button>
              </>
            )}

            {phase === "manual" && (
              <form
                onSubmit={handleManualSubmit}
                className="mt-8 rounded-2xl bg-white border border-charcoal/10 shadow-sm p-7"
              >
                {parseFailed ? (
                  <p className="rounded-xl bg-gold-soft border border-gold/40 p-4 text-sm text-charcoal/80">
                    We couldn&apos;t read that file — but nothing is lost.{" "}
                    {FALLBACK_COPY}
                  </p>
                ) : (
                  <p className="text-sm text-charcoal/70">{FALLBACK_COPY}</p>
                )}

                <label className="block mt-6 text-sm font-semibold text-indigo">
                  Current or most recent role
                  <input
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Marketing Coordinator, or CS Graduate"
                    className="mt-2 w-full rounded-xl border border-charcoal/15 px-4 py-3 text-sm font-normal focus:outline-none focus:border-teal"
                  />
                </label>

                <label className="block mt-4 text-sm font-semibold text-indigo">
                  Years of experience
                  <input
                    value={years}
                    onChange={(e) => setYears(e.target.value)}
                    type="number"
                    min="0"
                    max="50"
                    placeholder="0 is a perfectly good answer"
                    className="mt-2 w-full rounded-xl border border-charcoal/15 px-4 py-3 text-sm font-normal focus:outline-none focus:border-teal"
                  />
                </label>

                <fieldset className="mt-4">
                  <legend className="text-sm font-semibold text-indigo">
                    Your top 3 skills
                  </legend>
                  {skills.map((skill, i) => (
                    <input
                      key={i}
                      value={skill}
                      onChange={(e) =>
                        setSkills(
                          skills.map((s, j) => (j === i ? e.target.value : s)),
                        )
                      }
                      placeholder={
                        ["e.g. Excel", "e.g. Writing", "e.g. Customer support"][i]
                      }
                      className="mt-2 w-full rounded-xl border border-charcoal/15 px-4 py-3 text-sm focus:outline-none focus:border-teal"
                    />
                  ))}
                </fieldset>

                {manualError && (
                  <p className="mt-3 text-sm text-coral-dark">{manualError}</p>
                )}

                <button
                  type="submit"
                  className="mt-6 w-full rounded-full bg-coral hover:bg-coral-dark transition-colors px-6 py-3.5 font-heading font-semibold text-white"
                >
                  Build my path
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhase("choose");
                    setParseFailed(false);
                  }}
                  className="mt-3 w-full text-sm text-charcoal/50 hover:text-charcoal"
                >
                  Back — I&apos;ll upload a resume instead
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
