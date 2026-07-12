import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertInchesToTwip,
} from "docx";
import { getSectionOrder } from "./builder-sections";
import type { BuilderSections } from "./types";

/** Exact export spec: Calibri body 10-10.5pt, name 18-22pt bold, section
 *  headings 11-12pt bold all-caps in one accent color with a 1.5-2pt rule
 *  beneath, filled round bullets, middle-dot contact line, 0.6-0.8" margins,
 *  Core Competencies as a 3-column borderless table. */
const FONT = "Calibri";
const ACCENT = "1B2A4A"; // brand deep indigo, used as the one accent color
const BODY_SIZE = 21; // 10.5pt in half-points
const NAME_SIZE = 40; // 20pt
const HEADING_SIZE = 23; // 11.5pt
const MARGIN = convertInchesToTwip(0.7);
const RULE_SIZE = 14; // ~1.75pt, in eighths of a point

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 220, after: 100 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: RULE_SIZE, color: ACCENT },
    },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        color: ACCENT,
        font: FONT,
        size: HEADING_SIZE,
      }),
    ],
  });
}

function body(text: string, opts: { bold?: boolean; italics?: boolean } = {}): TextRun {
  return new TextRun({ text, font: FONT, size: BODY_SIZE, ...opts });
}

function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    indent: { left: 260, hanging: 200 },
    children: [body(`●  ${text}`)],
  });
}

function lineListParagraphs(lines: string[]): Paragraph[] {
  return lines.filter(Boolean).map((line) => bulletParagraph(line));
}

function competenciesTable(skills: string[]): Table {
  const cols = 3;
  const rows: TableRow[] = [];
  for (let i = 0; i < skills.length; i += cols) {
    const rowSkills = skills.slice(i, i + cols);
    while (rowSkills.length < cols) rowSkills.push("");
    rows.push(
      new TableRow({
        children: rowSkills.map(
          (skill) =>
            new TableCell({
              width: { size: 100 / cols, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              },
              children: [
                new Paragraph({
                  spacing: { after: 60 },
                  children: skill ? [body(`●  ${skill}`)] : [],
                }),
              ],
            }),
        ),
      }),
    );
  }
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
  });
}

export const MIN_SKILLS_FOR_EXPORT = 12;

function sectionBlock(key: keyof BuilderSections, sections: BuilderSections): (Paragraph | Table)[] {
  switch (key) {
    case "header":
    case "experienceLevel":
      return [];
    case "summary":
      return sections.summary.trim()
        ? [heading("Professional Summary"), new Paragraph({ children: [body(sections.summary)], spacing: { after: 120 } })]
        : [];
    case "coreCompetencies":
      return sections.coreCompetencies.length
        ? [heading("Core Competencies"), competenciesTable(sections.coreCompetencies)]
        : [];
    case "experience":
      return sections.experience.length
        ? [
            heading("Experience"),
            ...sections.experience.flatMap((e) => [
              new Paragraph({
                spacing: { before: 140, after: 20 },
                children: [
                  body(`${e.title}, ${e.company}`, { bold: true }),
                  body(`    ${e.startDate} - ${e.endDate}`, { italics: true }),
                ],
              }),
              ...lineListParagraphs(e.bullets),
            ]),
          ]
        : [];
    case "awards":
      return sections.awards.length ? [heading("Awards"), ...lineListParagraphs(sections.awards)] : [];
    case "education":
      return sections.education.length
        ? [
            heading("Education"),
            ...sections.education.map(
              (e) => new Paragraph({ spacing: { after: 40 }, children: [body(`${e.degree}, ${e.school} (${e.year})`)] }),
            ),
          ]
        : [];
    case "certifications":
      return sections.certifications.length
        ? [heading("Certifications"), ...lineListParagraphs(sections.certifications)]
        : [];
    case "memberships":
      return sections.memberships.length
        ? [heading("Memberships"), ...lineListParagraphs(sections.memberships)]
        : [];
    case "publications":
      return sections.publications.length
        ? [heading("Publications"), ...lineListParagraphs(sections.publications)]
        : [];
    case "volunteer":
      return sections.volunteer.length ? [heading("Volunteer"), ...lineListParagraphs(sections.volunteer)] : [];
  }
}

export async function buildResumeDocx(sections: BuilderSections): Promise<Buffer> {
  const { header } = sections;
  const contactLine = [header.email, header.phone, header.location, header.linkedin, header.portfolio]
    .filter(Boolean)
    .join("  ·  ");

  const headerParagraphs = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: header.name || "Your Name", bold: true, font: FONT, size: NAME_SIZE })],
    }),
    ...(header.title
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [body(header.title)],
          }),
        ]
      : []),
    ...(contactLine
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [body(contactLine)],
          }),
        ]
      : []),
  ];

  const order = getSectionOrder(sections.experienceLevel);
  const body_ = order.flatMap((key) => sectionBlock(key, sections));

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } },
        },
        children: [...headerParagraphs, ...body_],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

/** Sanity-check the generated file before it's sent to the client: a valid
 *  .docx is a non-trivial zip archive (PK signature). */
export function isValidDocxBuffer(buf: Buffer): boolean {
  return buf.length > 1000 && buf[0] === 0x50 && buf[1] === 0x4b;
}
