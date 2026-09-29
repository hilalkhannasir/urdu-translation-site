"use client";

import { useRef, useState, useTransition } from "react";
import { TRANSLATION_MODELS } from "@/lib/models";

type StatusTone = "idle" | "working" | "success" | "error";

export default function Translator() {
  const [sourceText, setSourceText] = useState("");
  const [translation, setTranslation] = useState("");
  const [modelId, setModelId] = useState(TRANSLATION_MODELS[0].id);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [status, setStatus] = useState("Paste English, or upload a .txt / PDF.");
  const [tone, setTone] = useState<StatusTone>("idle");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;

    const lower = file.name.toLowerCase();
    setFileLabel(file.name);
    setTone("working");
    setStatus(`Reading ${file.name}…`);

    try {
      const { extractTextFromPdf, extractTextFromTxt } = await import(
        "@/lib/extractText"
      );

      if (lower.endsWith(".txt") || file.type === "text/plain") {
        const text = await extractTextFromTxt(file);
        setSourceText(text);
        setStatus("Text file loaded. Choose a model and translate.");
        setTone("success");
        return;
      }

      if (lower.endsWith(".pdf") || file.type === "application/pdf") {
        const { text, usedOcr } = await extractTextFromPdf(file);
        if (!text) {
          throw new Error("No readable text found in this PDF.");
        }
        setSourceText(text);
        setStatus(
          usedOcr
            ? "PDF scanned with OCR. Review the extracted English, then translate."
            : "PDF text extracted. Review it, then translate.",
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

  function translate() {
    const trimmed = sourceText.trim();
    if (!trimmed) {
      setTone("error");
      setStatus("Add some English text before translating.");
      return;
    }

    setTone("working");
    setStatus("Sending text to the selected model…");

    startTransition(async () => {
      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed, modelId }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Translation failed.");
        }
        setTranslation(data.translation);
        setTone("success");
        setStatus(`Translated with ${data.modelLabel}.`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Translation failed.";
        setTone("error");
        setStatus(message);
      }
    });
  }

  function downloadTranslation() {
    if (!translation.trim()) return;
    const blob = new Blob([translation], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "urdu-translation.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    setSourceText("");
    setTranslation("");
    setFileLabel(null);
    setTone("idle");
    setStatus("Paste English, or upload a .txt / PDF.");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

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

        <div className="relative grid gap-0 lg:grid-cols-2">
          <div className="border-b border-[var(--line)] p-6 sm:p-8 lg:border-b-0 lg:border-r">
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
                  onClick={clearAll}
                  className="rounded-xl border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold text-[var(--ink-soft)] transition hover:bg-white"
                >
                  Clear
                </button>
              </div>
            </div>

            {fileLabel ? (
              <p className="mb-3 text-sm text-[var(--ink-soft)]">
                Loaded: <span className="font-semibold text-[var(--ink)]">{fileLabel}</span>
              </p>
            ) : null}

            <textarea
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="Paste English text here, or upload a .txt / PDF…"
              className="min-h-[280px] w-full resize-y rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-4 text-[0.98rem] leading-7 text-[var(--ink)] outline-none transition focus:border-[var(--teal)]"
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal-deep)]">
                  Model
                </span>
                <select
                  value={modelId}
                  onChange={(event) => setModelId(event.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-3 text-sm outline-none focus:border-[var(--teal)]"
                >
                  {TRANSLATION_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={translate}
                  disabled={isPending}
                  className="w-full rounded-xl bg-[var(--ink)] px-6 py-3 text-sm font-semibold text-[var(--fog)] transition hover:bg-[var(--teal-deep)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {isPending ? "Translating…" : "Translate to Urdu"}
                </button>
              </div>
            </div>

            <p className="mt-3 text-sm text-[var(--ink-soft)]">
              {TRANSLATION_MODELS.find((model) => model.id === modelId)?.description}
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brass)]">
                  Output · اردو
                </p>
                <h2
                  className="mt-1 text-2xl text-[var(--ink)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Preview
                </h2>
              </div>
              <button
                type="button"
                onClick={downloadTranslation}
                disabled={!translation.trim()}
                className="rounded-xl border border-[var(--brass)] bg-[rgba(166,121,45,0.12)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[rgba(166,121,45,0.22)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Download .txt
              </button>
            </div>

            <div className="min-h-[280px] rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-5">
              {translation ? (
                <p className="urdu-text text-[var(--ink)]">{translation}</p>
              ) : (
                <p className="text-sm leading-7 text-[var(--ink-soft)]">
                  Urdu translation will appear here after you run a model. You can
                  download the result as a UTF-8 `.txt` file.
                </p>
              )}
            </div>
          </div>
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
