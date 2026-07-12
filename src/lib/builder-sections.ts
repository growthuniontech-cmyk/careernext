import { EMPTY_BUILDER_SECTIONS, type BuilderSections } from "./types";

/** Pure, client-safe helpers for the resume builder's section shape. Kept
 *  separate from resume-builder.ts (which pulls in the Anthropic SDK) so
 *  client components can import this without bundling server-only code. */

/** Fixed section order per the product spec. Freshers (0-2 yrs) get Education
 *  above Experience and default to one page; 2+ yrs leads with Experience and
 *  caps at two pages. Awards/Certifications/etc. stay in the same place for
 *  both, only Education moves. */
export function getSectionOrder(
  level: BuilderSections["experienceLevel"],
): (keyof BuilderSections)[] {
  const base: (keyof BuilderSections)[] = [
    "header",
    "summary",
    "coreCompetencies",
    "experience",
    "awards",
    "education",
    "certifications",
    "memberships",
    "publications",
    "volunteer",
  ];
  if (level !== "fresher") return base;
  const withoutEducation = base.filter((s) => s !== "education");
  const experienceIdx = withoutEducation.indexOf("experience");
  return [
    ...withoutEducation.slice(0, experienceIdx),
    "education",
    ...withoutEducation.slice(experienceIdx),
  ];
}

export function pageCapFor(level: BuilderSections["experienceLevel"]): number {
  return level === "fresher" ? 1 : 2;
}

/** Fills in any missing fields with defaults so partially-saved rows (or a
 *  brand new builder_resumes row) never crash a client expecting full shape. */
export function normalizeSections(partial: Partial<BuilderSections> | null | undefined): BuilderSections {
  if (!partial) return structuredClone(EMPTY_BUILDER_SECTIONS);
  return {
    ...structuredClone(EMPTY_BUILDER_SECTIONS),
    ...partial,
    header: { ...EMPTY_BUILDER_SECTIONS.header, ...partial.header },
  };
}

/** Flattens the builder sections into plain text for ATS scoring, in the
 *  same order the resume would actually render. */
export function compileBuilderResumeText(sections: BuilderSections): string {
  const { header } = sections;
  const parts: string[] = [
    [header.name, header.title].filter(Boolean).join(", "),
    [header.email, header.phone, header.location, header.linkedin, header.portfolio]
      .filter(Boolean)
      .join(" | "),
    "",
    "SUMMARY",
    sections.summary,
    "",
    "CORE COMPETENCIES",
    sections.coreCompetencies.join(", "),
    "",
    "EXPERIENCE",
    ...sections.experience.map((e) =>
      [
        `${e.title}, ${e.company} (${e.startDate} - ${e.endDate})`,
        ...e.bullets.map((b) => `- ${b}`),
      ].join("\n"),
    ),
    "",
    "AWARDS",
    sections.awards.join("\n"),
    "",
    "EDUCATION",
    ...sections.education.map((e) => `${e.degree}, ${e.school} (${e.year})`),
    "",
    "CERTIFICATIONS",
    sections.certifications.join("\n"),
    "",
    "MEMBERSHIPS",
    sections.memberships.join("\n"),
    "",
    "PUBLICATIONS",
    sections.publications.join("\n"),
    "",
    "VOLUNTEER",
    sections.volunteer.join("\n"),
  ];
  return parts.filter((p) => p !== undefined).join("\n");
}
