import type { PDFDocumentProxy } from "pdfjs-dist";

export type LoadedPdf = {
  pdf: PDFDocumentProxy;
  numPages: number;
  fileName: string;
};

export async function extractTextFromTxt(file: File): Promise<string> {
  return file.text();
}

export async function loadPdf(file: File): Promise<LoadedPdf> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");

  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  return { pdf, numPages: pdf.numPages, fileName: file.name };
}

export async function renderPdfPagePreview(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  scale = 1.35,
): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create a preview canvas.");
  }

  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise;

  return canvas.toDataURL("image/jpeg", 0.82);
}

export async function extractTextFromPdfPages(
  pdf: PDFDocumentProxy,
  pageFrom: number,
  pageTo: number,
): Promise<{ text: string; usedOcr: boolean }> {
  const from = Math.max(1, Math.min(pageFrom, pageTo));
  const to = Math.min(pdf.numPages, Math.max(pageFrom, pageTo));
  const pages: string[] = [];

  for (let pageNum = from; pageNum <= to; pageNum += 1) {
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
  // Short embedded text usually means a scanned/image PDF for this range.
  if (embeddedText.length >= 40) {
    return { text: embeddedText, usedOcr: false };
  }

  const ocrText = await runPdfOcr(pdf, from, to);
  return { text: ocrText, usedOcr: true };
}

async function runPdfOcr(
  pdf: PDFDocumentProxy,
  pageFrom: number,
  pageTo: number,
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  const chunks: string[] = [];

  try {
    for (let pageNum = pageFrom; pageNum <= pageTo; pageNum += 1) {
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
