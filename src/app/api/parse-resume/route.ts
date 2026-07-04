import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { getClaude, MODEL, isClaudeConfigured, ParsedResumeSchema } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/journey";

export const maxDuration = 60;

declare global {
  // eslint-disable-next-line no-var
  var pdfjsWorker: { WorkerMessageHandler: unknown } | undefined;
}

// pdfjs-dist (used by pdf-parse) tries to dynamically `import()` its worker
// module at runtime to set up a "fake worker" for Node.js. Pre-loading it
// ourselves and registering it on globalThis makes pdfjs-dist skip that
// internal dynamic import. Done lazily inside the request's try/catch (not
// at module top-level) so a bundling problem with this deep import can't
// crash the whole route module.
async function ensurePdfWorker() {
  if (!globalThis.pdfjsWorker) {
    const { WorkerMessageHandler } = await import(
      "pdfjs-dist/legacy/build/pdf.worker.mjs"
    );
    globalThis.pdfjsWorker = { WorkerMessageHandler };
  }
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const SYSTEM =
  "You extract structured career profiles from resume text for a career guidance tool. Be accurate and generous — surface transferable skills, not just literal keywords. For sparse resumes (freshers), infer sensible titlesHeld from education (e.g. 'Computer Science Graduate').";

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
      await ensurePdfWorker();
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
    return Response.json(
      { error: "parse_failed", debug: err instanceof Error ? err.message : String(err) },
      { status: 422 },
    );
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
