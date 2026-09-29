"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { TRANSLATION_MODELS } from "@/lib/models";
import type { LoadedPdf } from "@/lib/extractText";

type StatusTone = "idle" | "working" | "success" | "error";

type ModelResult = {
  translation: string;
  error: string | null;
  loading: boolean;
};

function emptyResults(): Record<string, ModelResult> {
  return Object.fromEntries(
    TRANSLATION_MODELS.map((model) => [
      model.id,
      { translation: "", error: null, loading: false },
    ]),
  );
}

export default function Translator() {
  const [sourceText, setSourceText] = useState("");
  const [results, setResults] = useState<Record<string, ModelResult>>(emptyResults);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [status, setStatus] = useState("Paste English, or upload a .txt / PDF.");
  const [tone, setTone] = useState<StatusTone>("idle");
  const [isPending, startTransition] = useTransition();
  const [isExtracting, setIsExtracting] = useState(false);

  const [pdfDoc, setPdfDoc] = useState<LoadedPdf | null>(null);
  const [pageFrom, setPageFrom] = useState(1);
  const [pageTo, setPageTo] = useState(1);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<LoadedPdf | null>(null);

  useEffect(() => {
    pdfRef.current = pdfDoc;
  }, [pdfDoc]);

  useEffect(() => {
    return () => {
      const current = pdfRef.current;
      if (current) {
        void current.pdf.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (!pdfDoc) {
      setPreviewUrl(null);
      return;
    }

    const page = Math.min(Math.max(previewPage, pageFrom), pageTo);
    let cancelled = false;

    async function loadPreview() {
      setPreviewLoading(true);
      try {
        const { renderPdfPagePreview } = await import("@/lib/extractText");
        const url = await renderPdfPagePreview(pdfDoc!.pdf, page);
        if (!cancelled) setPreviewUrl(url);
      } catch {
        if (!cancelled) {
          setPreviewUrl(null);
          setTone("error");
          setStatus("Could not render PDF preview.");
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, previewPage, pageFrom, pageTo]);

  async function destroyPdf() {
    if (pdfRef.current) {
      await pdfRef.current.pdf.destroy();
      pdfRef.current = null;
    }
    setPdfDoc(null);
    setPreviewUrl(null);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;

    const lower = file.name.toLowerCase();
    setFileLabel(file.name);
    setTone("working");
    setStatus(`Reading ${file.name}…`);
    setResults(emptyResults());

    try {
      const { extractTextFromTxt, loadPdf } = await import("@/lib/extractText");

      if (lower.endsWith(".txt") || file.type === "text/plain") {
        await destroyPdf();
        const text = await extractTextFromTxt(file);
        setSourceText(text);
        setStatus("Text file loaded. Review it, then translate with both models.");
        setTone("success");
        return;
      }

      if (lower.endsWith(".pdf") || file.type === "application/pdf") {
        await destroyPdf();
        const loaded = await loadPdf(file);
        setPdfDoc(loaded);
        setPageFrom(1);
        setPageTo(loaded.numPages);
        setPreviewPage(1);
        setSourceText("");
        setStatus(
          `PDF loaded · ${loaded.numPages} page${loaded.numPages === 1 ? "" : "s"}. Choose a page range, preview, then extract.`,
        );
        setTone("success");
        return;
      }

      throw new Error("Please upload a .txt or .pdf file.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read file.";
      setTone("error");
      setStatus(message);
    }
  }

  function clampRange(nextFrom: number, nextTo: number) {
    if (!pdfDoc) return;
    const from = Math.max(1, Math.min(nextFrom, pdfDoc.numPages));
    const to = Math.max(from, Math.min(nextTo, pdfDoc.numPages));
    setPageFrom(from);
    setPageTo(to);
    setPreviewPage((current) => Math.min(Math.max(current, from), to));
  }

  function parsePageInput(raw: string, fallback: number): number {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function setPreviewPageClamped(next: number) {
    setPreviewPage(Math.min(Math.max(next, pageFrom), pageTo));
  }

  async function extractSelectedPages() {
    if (!pdfDoc) return;

    setIsExtracting(true);
    setTone("working");
    setStatus(`Extracting pages ${pageFrom}–${pageTo}…`);

    try {
      const { extractTextFromPdfPages } = await import("@/lib/extractText");
      const { text, usedOcr } = await extractTextFromPdfPages(
        pdfDoc.pdf,
        pageFrom,
        pageTo,
      );
      if (!text) {
        throw new Error("No readable text found in the selected pages.");
      }
      setSourceText(text);
      setStatus(
        usedOcr
          ? `Pages ${pageFrom}–${pageTo} scanned with OCR. Review the English, then translate.`
          : `Pages ${pageFrom}–${pageTo} extracted. Review the English, then translate.`,
      );
      setTone("success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not extract PDF pages.";
      setTone("error");
      setStatus(message);
    } finally {
      setIsExtracting(false);
    }
  }

  function translate() {
    const trimmed = sourceText.trim();
    if (!trimmed) {
      setTone("error");
      setStatus("Add some English text before translating.");
      return;
    }

    setTone("working");
    setStatus("Translating with both models…");
    setResults(
      Object.fromEntries(
        TRANSLATION_MODELS.map((model) => [
          model.id,
          { translation: "", error: null, loading: true },
        ]),
      ),
    );

    startTransition(async () => {
      const settled = await Promise.all(
        TRANSLATION_MODELS.map(async (model) => {
          try {
            const response = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: trimmed, modelId: model.id }),
            });
            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.error || "Translation failed.");
            }
            return {
              id: model.id,
              translation: data.translation as string,
              error: null as string | null,
            };
          } catch (error) {
            return {
              id: model.id,
              translation: "",
              error:
                error instanceof Error ? error.message : "Translation failed.",
            };
          }
        }),
      );

      const next: Record<string, ModelResult> = {};
      let successCount = 0;
      for (const item of settled) {
        next[item.id] = {
          translation: item.translation,
          error: item.error,
          loading: false,
        };
        if (item.translation) successCount += 1;
      }
      setResults(next);

      if (successCount === TRANSLATION_MODELS.length) {
        setTone("success");
        setStatus("Both models finished. Compare the Urdu outputs below.");
      } else if (successCount > 0) {
        setTone("success");
        setStatus("One model finished; the other needs attention — see below.");
      } else {
        setTone("error");
        setStatus("Both translations failed. Check the messages under each model.");
      }
    });
  }

  function downloadTranslation(modelId: string, label: string) {
    const text = results[modelId]?.translation?.trim();
    if (!text) return;
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `urdu-${slug}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function clearAll() {
    setSourceText("");
    setResults(emptyResults());
    setFileLabel(null);
    setTone("idle");
    setStatus("Paste English, or upload a .txt / PDF.");
    setPageFrom(1);
    setPageTo(1);
    setPreviewPage(1);
    await destroyPdf();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const busy = isPending || isExtracting;
  const pageCountLabel =
    pageFrom === pageTo ? `page ${pageFrom}` : `pages ${pageFrom}–${pageTo}`;

  return (
    <section className="animate-rise animate-delay-2 relative mx-auto w-full max-w-6xl px-5 pb-16 pt-4 sm:px-8">
      <div
        className="relative overflow-hidden rounded-[1.75rem] border border-[var(--line)] shadow-[var(--shadow)]"
        style={{ background: "var(--panel)", backdropFilter: "blur(14px)" }}
      >
        <div
          aria-hidden
          className="bg-wash pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-70"
          style={{
            background:
              "radial-gradient(circle, rgba(31,111,99,0.28), transparent 68%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-16 h-80 w-80 rounded-full opacity-60"
          style={{
            background:
              "radial-gradient(circle, rgba(166,121,45,0.2), transparent 70%)",
          }}
        />

        <div className="relative border-b border-[var(--line)] p-6 sm:p-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal-deep)]">
                Source · English
              </p>
              <h2
                className="mt-1 text-2xl text-[var(--ink)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Input
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-xl bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--teal-deep)]">
                Upload file
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf,text/plain,application/pdf"
                  className="sr-only"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
              </label>
              <button
                type="button"
                onClick={() => void clearAll()}
                className="rounded-xl border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold text-[var(--ink-soft)] transition hover:bg-white"
              >
                Clear
              </button>
            </div>
          </div>

          {fileLabel ? (
            <p className="mb-3 text-sm text-[var(--ink-soft)]">
              Loaded:{" "}
              <span className="font-semibold text-[var(--ink)]">{fileLabel}</span>
            </p>
          ) : null}

          {pdfDoc ? (
            <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)]">
                <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal-deep)]">
                    Page preview
                  </p>
                  <p className="text-sm text-[var(--ink-soft)]">
                    {previewPage} / {pdfDoc.numPages}
                  </p>
                </div>
                <div className="flex min-h-[280px] items-center justify-center bg-[#edf3f0] p-3">
                  {previewLoading ? (
                    <p className="text-sm text-[var(--ink-soft)]">Rendering preview…</p>
                  ) : previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={`PDF page ${previewPage}`}
                      className="max-h-[420px] w-auto max-w-full rounded-lg shadow-sm"
                    />
                  ) : (
                    <p className="text-sm text-[var(--ink-soft)]">No preview available.</p>
                  )}
                </div>
                <div className="border-t border-[var(--line)] px-4 py-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                      Browse preview
                    </span>
                    <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
                      <span className="sr-only">Preview page</span>
                      <input
                        type="number"
                        min={pageFrom}
                        max={pageTo}
                        value={Math.min(Math.max(previewPage, pageFrom), pageTo)}
                        onChange={(event) =>
                          setPreviewPageClamped(
                            parsePageInput(event.target.value, previewPage),
                          )
                        }
                        className="w-16 rounded-lg border border-[var(--line)] bg-white/80 px-2 py-1 text-center text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)]"
                      />
                      <span>/ {pdfDoc.numPages}</span>
                    </label>
                  </div>
                  <input
                    type="range"
                    min={pageFrom}
                    max={pageTo}
                    value={Math.min(Math.max(previewPage, pageFrom), pageTo)}
                    onChange={(event) =>
                      setPreviewPage(Number(event.target.value))
                    }
                    className="w-full accent-[var(--teal)]"
                  />
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-[var(--line)] bg-white/55 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal-deep)]">
                    Page range
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                    Choose which pages to extract for OCR and translation. Type a
                    page number or use the sliders — preview updates as you move
                    through the selected range.
                  </p>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm text-[var(--ink)]">From</span>
                      <input
                        type="number"
                        min={1}
                        max={pdfDoc.numPages}
                        value={pageFrom}
                        onChange={(event) =>
                          clampRange(
                            parsePageInput(event.target.value, pageFrom),
                            pageTo,
                          )
                        }
                        className="w-16 rounded-lg border border-[var(--line)] bg-white/80 px-2 py-1 text-center text-sm font-semibold text-[var(--ink)] outline-none focus:border-[var(--teal)]"
                      />
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={pdfDoc.numPages}
                      value={pageFrom}
                      onChange={(event) =>
                        clampRange(Number(event.target.value), pageTo)
                      }
                      className="w-full accent-[var(--teal)]"
                    />
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm text-[var(--ink)]">To</span>
                      <input
                        type="number"
                        min={1}
                        max={pdfDoc.numPages}
                        value={pageTo}
                        onChange={(event) =>
                          clampRange(
                            pageFrom,
                            parsePageInput(event.target.value, pageTo),
                          )
                        }
                        className="w-16 rounded-lg border border-[var(--line)] bg-white/80 px-2 py-1 text-center text-sm font-semibold text-[var(--ink)] outline-none focus:border-[var(--brass)]"
                      />
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={pdfDoc.numPages}
                      value={pageTo}
                      onChange={(event) =>
                        clampRange(pageFrom, Number(event.target.value))
                      }
                      className="w-full accent-[var(--brass)]"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void extractSelectedPages()}
                  disabled={isExtracting}
                  className="mt-6 w-full rounded-xl bg-[var(--teal)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--teal-deep)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isExtracting
                    ? `Extracting ${pageCountLabel}…`
                    : `Extract ${pageCountLabel}`}
                </button>
              </div>
            </div>
          ) : null}

          <textarea
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            placeholder="Paste English text here, or upload a .txt / PDF…"
            className="min-h-[220px] w-full resize-y rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-4 text-[0.98rem] leading-7 text-[var(--ink)] outline-none transition focus:border-[var(--teal)]"
          />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm leading-6 text-[var(--ink-soft)]">
              Both models run together so you can compare NLLB-200 and Qwen3-8B side
              by side, then download whichever you prefer.
            </p>
            <button
              type="button"
              onClick={translate}
              disabled={busy}
              className="rounded-xl bg-[var(--ink)] px-6 py-3 text-sm font-semibold text-[var(--fog)] transition hover:bg-[var(--teal-deep)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Translating both…" : "Translate with both models"}
            </button>
          </div>
        </div>

        <div className="relative grid gap-0 lg:grid-cols-2">
          {TRANSLATION_MODELS.map((model, index) => {
            const result = results[model.id] ?? {
              translation: "",
              error: null,
              loading: false,
            };

            return (
              <div
                key={model.id}
                className={`p-6 sm:p-8 ${
                  index === 0
                    ? "border-b border-[var(--line)] lg:border-b-0 lg:border-r"
                    : ""
                }`}
              >
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p
                      className="text-xs font-semibold uppercase tracking-[0.18em]"
                      style={{
                        color: index === 0 ? "var(--teal-deep)" : "var(--brass)",
                      }}
                    >
                      Output · اردو
                    </p>
                    <h2
                      className="mt-1 text-2xl text-[var(--ink)]"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {model.label}
                    </h2>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--ink-soft)]">
                      {model.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadTranslation(model.id, model.label)}
                    disabled={!result.translation.trim()}
                    className="rounded-xl border border-[var(--brass)] bg-[rgba(166,121,45,0.12)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[rgba(166,121,45,0.22)] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Download .txt
                  </button>
                </div>

                <div className="min-h-[260px] rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-5">
                  {result.loading ? (
                    <p className="text-sm leading-7 text-[var(--ink-soft)]">
                      Translating with {model.label}…
                    </p>
                  ) : result.error ? (
                    <p className="text-sm leading-7 text-[var(--danger)]">
                      {result.error}
                    </p>
                  ) : result.translation ? (
                    <p className="urdu-text text-[var(--ink)]">{result.translation}</p>
                  ) : (
                    <p className="text-sm leading-7 text-[var(--ink-soft)]">
                      Urdu from {model.label} will appear here after you translate.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="relative border-t border-[var(--line)] px-6 py-4 text-sm sm:px-8"
          style={{
            color:
              tone === "error"
                ? "var(--danger)"
                : tone === "success"
                  ? "var(--teal-deep)"
                  : "var(--ink-soft)",
          }}
          role="status"
          aria-live="polite"
        >
          {status}
        </div>
      </div>
    </section>
  );
}
