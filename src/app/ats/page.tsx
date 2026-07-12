"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import LoadingCard from "@/components/LoadingCard";
import AtsScorePanel from "@/components/AtsScorePanel";
import type { AtsScoreResult } from "@/lib/types";

const LOADING_MESSAGES = [
  "Reading your resume against the JD…",
  "Checking keyword coverage…",
  "Scanning for ATS-unfriendly formatting…",
];

export default function AtsScorePage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [hasResume, setHasResume] = useState<boolean | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [jdText, setJdText] = useState("");
  const [scoring, setScoring] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [score, setScore] = useState<AtsScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/parse-resume", { method: "POST", body: formData });
      if (!res.ok) throw new Error("parse_failed");
      setHasResume(true);
    } catch {
      setUploadError("Couldn't read that file. Try a different PDF or DOCX, or build a profile manually instead.");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    fetch("/api/ats-score")
      .then(async (res) => {
        if (!res.ok) throw new Error("unauthenticated");
        const data = await res.json();
        setHasResume(data.hasResume);
        setSelectedTitle(data.selectedTitle);
        setScore(data.score);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function runScore(useRoleJd: boolean) {
    setScoring(true);
    setError(null);
    try {
      const res = await fetch("/api/ats-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(useRoleJd ? { useRoleJd: true } : { jdText }),
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "missing_jd"
            ? "Paste a job description first."
            : "Something hiccuped while scoring. Try again.",
        );
        return;
      }
      setScore(data.score);
    } catch {
      setError("Something hiccuped while scoring. Try again.");
    } finally {
      setScoring(false);
    }
  }

  if (hasResume === null) return null;

  return (
    <main className="flex-1">
      <Header solid />
      <div className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="font-heading font-bold text-3xl text-indigo text-center">
          ATS score your resume
        </h1>
        <p className="mt-3 text-center text-charcoal/70">
          Compare your resume against a real job description and see exactly
          what to fix.
        </p>

        {!hasResume ? (
          <div className="mt-10">
            {uploading ? (
              <LoadingCard messages={["Reading your resume…"]} />
            ) : (
              <div
                onClick={() => fileInput.current?.click()}
                className="cursor-pointer rounded-2xl border-2 border-dashed border-charcoal/20 hover:border-teal p-10 text-center transition-colors bg-white"
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
                <p className="font-heading font-semibold text-indigo">Upload a resume to score</p>
                <p className="mt-1 text-sm text-charcoal/60">PDF or DOCX, click to browse</p>
              </div>
            )}
            {uploadError && (
              <p className="mt-3 text-center text-sm text-coral-dark">
                {uploadError}{" "}
                <button onClick={() => router.push("/start")} className="underline underline-offset-2">
                  Go to manual entry
                </button>
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="mt-8 rounded-2xl bg-white border border-charcoal/10 shadow-sm p-6">
              <label className="block text-sm font-semibold text-indigo">
                Paste the job description
                <textarea
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  rows={8}
                  placeholder="Paste the full job posting text here…"
                  className="mt-2 w-full rounded-xl border border-charcoal/15 px-4 py-3 text-sm focus:outline-none focus:border-teal"
                />
              </label>
              <button
                onClick={() => runScore(false)}
                disabled={scoring || !jdText.trim()}
                className="mt-4 w-full rounded-full bg-coral hover:bg-coral-dark disabled:opacity-40 transition-colors px-6 py-3 font-heading font-semibold text-white"
              >
                Score against this JD
              </button>

              {selectedTitle && (
                <>
                  <div className="my-4 flex items-center gap-3 text-xs text-charcoal/40">
                    <span className="h-px flex-1 bg-charcoal/10" />
                    or
                    <span className="h-px flex-1 bg-charcoal/10" />
                  </div>
                  <button
                    onClick={() => runScore(true)}
                    disabled={scoring}
                    className="w-full rounded-full bg-indigo hover:bg-indigo-light disabled:opacity-40 transition-colors px-6 py-3 font-heading font-semibold text-white"
                  >
                    Score against my matched role: {selectedTitle}
                  </button>
                </>
              )}

              {error && <p className="mt-3 text-sm text-coral-dark">{error}</p>}
            </div>

            <div className="mt-8">
              {scoring ? (
                <LoadingCard messages={LOADING_MESSAGES} />
              ) : (
                score && <AtsScorePanel score={score} />
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
