export async function GET() {
  const steps: string[] = [];
  try {
    steps.push("before pdf-parse import");
    const { PDFParse } = await import("pdf-parse");
    steps.push("pdf-parse imported ok");
    const parser = new PDFParse({ data: Buffer.from("%PDF-1.4\n%%EOF") });
    steps.push("PDFParse instantiated ok");
    await parser.destroy();
    steps.push("destroyed ok");
    return Response.json({ ok: true, steps });
  } catch (err) {
    steps.push("CAUGHT ERROR");
    return Response.json({
      ok: false,
      steps,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
    });
  }
}
