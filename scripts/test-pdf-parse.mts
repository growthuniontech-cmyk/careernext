/**
 * Regression test for PDF resume parsing. Verifies pdf-parse (via
 * pdfjs-dist) can actually be imported and used in this exact runtime,
 * catching the class of bug where it works in `next dev` but crashes in a
 * production build (`next start`/Vercel) due to missing browser globals
 * (DOMMatrix) or broken dynamic worker imports — see
 * src/lib/dommatrix-polyfill.ts and src/app/api/parse-resume/route.ts.
 *
 *   npx tsx scripts/test-pdf-parse.mts
 */
import { installDomMatrixPolyfill } from "../src/lib/dommatrix-polyfill";

installDomMatrixPolyfill();

declare global {
  // eslint-disable-next-line no-var
  var pdfjsWorker: { WorkerMessageHandler: unknown } | undefined;
}
if (!globalThis.pdfjsWorker) {
  const { WorkerMessageHandler } = await import(
    "pdfjs-dist/legacy/build/pdf.worker.mjs"
  );
  globalThis.pdfjsWorker = { WorkerMessageHandler };
}

const { PDFParse } = await import("pdf-parse");

// Minimal valid single-page PDF containing one line of text.
const contentStream = "BT /F1 12 Tf 72 720 Td (Hello resume parsing) Tj ET";
const objects = [
  `<< /Type /Catalog /Pages 2 0 R >>`,
  `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
  `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>`,
  `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
  `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`,
];
let pdf = "%PDF-1.4\n";
const offsets: number[] = [0];
for (let i = 0; i < objects.length; i++) {
  offsets[i + 1] = pdf.length;
  pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
}
const xrefOffset = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (let i = 1; i <= objects.length; i++) {
  pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

const parser = new PDFParse({ data: Buffer.from(pdf, "latin1") });
let failures = 0;
try {
  const result = await parser.getText();
  if (result.text.includes("Hello resume parsing")) {
    console.log("ok — PDF text extraction works in this runtime");
  } else {
    failures++;
    console.error("FAIL — extracted text did not match:", result.text);
  }
} finally {
  await parser.destroy();
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
