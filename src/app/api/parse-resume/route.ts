import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import mammoth from "mammoth";
import { getClaude, MODEL, isClaudeConfigured, ParsedResumeSchema } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/journey";
import { installDomMatrixPolyfill } from "@/lib/dommatrix-polyfill";

export const maxDuration = 60;

declare global {
  // eslint-disable-next-line no-var
  var pdfjsWorker: { WorkerMessageHandler: unknown } | undefined;
}

// pdf-parse (via pdfjs-dist) references two browser-only globals at module
// evaluation time: `DOMMatrix` (for text-position matrix math) and a
// dynamic `import()` of its own worker module (to set up a Node "fake
// worker"). Both must be prepared *before* pdf-parse is imported, and both
// must happen inside this request's try/catch; importing pdf-parse itself
// is therefore also deferred to a dynamic import here, not a static
// top-level one, so ordering is guaranteed and a bundling problem with any
// of this can't crash the whole route module.
async function loadPdfParse() {
  installDomMatrixPolyfill();
  if (!globalThis.pdfjsWorker) {
    const { WorkerMessageHandler } = await import(
      "pdfjs-dist/legacy/build/pdf.worker.mjs"
    );
    globalThis.pdfjsWorker = { WorkerMessageHandler };
  }
  const { PDFParse } = await import("pdf-parse");
  return PDFParse;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const SYSTEM =
  "You extract structured career profiles from resume text for a career guidance tool. Be accurate and generous; surface transferable skills, not just literal keywords. For sparse resumes (freshers), infer sensible titlesHeld from education (e.g. 'Computer Science Graduate'). Do not use em dashes or en dashes; use commas or periods instead.";

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  if (!isClaudeConfigured()) {
    return Response.json(
      { error: "claude_not_configured", message: "ANTHROPIC_API_KEY is not set." },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "no_file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return Response.json({ error: "file_too_large" }, { status: 413 });
  }

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isDocx =
    file.name.toLowerCase().endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (!isPdf && !isDocx) {
    return Response.json({ error: "unsupported_type" }, { status: 400 });
  }

  // 1. Extract raw text locally
  let rawText: string;
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    if (isPdf) {
      const PDFParse = await loadPdfParse();
      const parser = new PDFParse({ data: bytes });
      try {
        const result = await parser.getText();
        rawText = result.text;
      } finally {
        await parser.destroy();
      }
    } else {
      const result = await mammoth.extractRawText({ buffer: bytes });
      rawText = result.value;
    }
  } catch (err) {
    console.error("text extraction failed:", err);
    return Response.json({ error: "parse_failed" }, { status: 422 });
  }

  rawText = rawText.trim();
  if (rawText.length < 100) {
    // Scanned/image-only PDFs or empty files land here
    return Response.json({ error: "parse_failed" }, { status: 422 });
  }

  // 2. Structure it with Claude
  try {
    const response = await getClaude().messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: {
        effort: "low",
        format: zodOutputFormat(ParsedResumeSchema),
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Extract this person's career profile from their resume:\n\n${rawText.slice(0, 30000)}`,
        },
      ],
    });
    if (!response.parsed_output) {
      return Response.json({ error: "parse_failed" }, { status: 422 });
    }

    // 3. Persist against the user's account
    const { error: dbError } = await supabase.from("resumes").insert({
      user_id: auth.user.id,
      filename: file.name,
      raw_text: rawText,
      parsed: response.parsed_output,
    });
    if (dbError) {
      console.error("resume insert failed:", dbError);
      return Response.json({ error: "save_failed" }, { status: 500 });
    }

    return Response.json({ parsed: response.parsed_output });
  } catch (err) {
    console.error("resume structuring failed:", err);
    return Response.json({ error: "parse_failed" }, { status: 422 });
  }
}
