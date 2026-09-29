export async function extractTextFromTxt(file: File): Promise<string> {
  return file.text();
}

export async function extractTextFromPdf(file: File): Promise<{
  text: string;
  usedOcr: boolean;
}> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");

  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) pages.push(pageText);
  }

  const embeddedText = pages.join("\n\n").trim();
  if (embeddedText.length >= 40) {
    return { text: embeddedText, usedOcr: false };
  }

  const ocrText = await runPdfOcr(pdf);
  return { text: ocrText, usedOcr: true };
}

import type { PDFDocumentProxy } from "pdfjs-dist";

async function runPdfOcr(pdf: PDFDocumentProxy): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  const chunks: string[] = [];

  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      if (!context) continue;

      await page.render({
        canvasContext: context,
        viewport,
        canvas,
      }).promise;
      const {
        data: { text },
      } = await worker.recognize(canvas);
      const cleaned = text.replace(/\s+/g, " ").trim();
      if (cleaned) chunks.push(cleaned);
    }
  } finally {
    await worker.terminate();
  }

  return chunks.join("\n\n").trim();
}
