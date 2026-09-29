import TranslatorMount from "@/components/TranslatorMount";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh]"
        style={{
          background:
            "linear-gradient(180deg, rgba(20,34,31,0.08) 0%, transparent 70%), url(\"data:image/svg+xml,%3Csvg width='160' height='160' viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 120c30-40 50-40 80 0' fill='none' stroke='%231f6f63' stroke-opacity='0.08' stroke-width='2'/%3E%3Cpath d='M40 40c20 10 40 10 60 0' fill='none' stroke='%23a6792d' stroke-opacity='0.1' stroke-width='2'/%3E%3C/svg%3E\")",
          backgroundSize: "auto, 180px 180px",
        }}
      />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-5 pb-2 pt-8 sm:px-8">
        <p className="animate-rise text-sm font-semibold tracking-[0.14em] text-[var(--teal-deep)]">
          EN → UR
        </p>
        <p className="animate-rise animate-delay-1 text-sm text-[var(--ink-soft)]">
          Vercel-ready · PDF OCR · .txt export
        </p>
      </header>

      <section className="relative mx-auto w-full max-w-6xl px-5 pt-10 sm:px-8 sm:pt-14">
        <p
          className="animate-brand text-[clamp(3.4rem,9vw,6.5rem)] leading-none text-[var(--ink)]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 560 }}
        >
          Qalam
        </p>
        <p
          className="animate-rise animate-delay-1 mt-2 text-3xl text-[var(--teal-deep)] sm:text-4xl"
          style={{ fontFamily: "var(--font-urdu)" }}
          lang="ur"
          dir="rtl"
        >
          قلم
        </p>
        <h1
          className="animate-rise animate-delay-1 mt-6 max-w-2xl text-2xl leading-snug text-[var(--ink-soft)] sm:text-3xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          English in. Nastaliq Urdu out.
        </h1>
        <p className="animate-rise animate-delay-2 mt-4 max-w-xl text-base leading-7 text-[var(--ink-soft)] sm:text-lg">
          Paste text, drop a `.txt`, or upload a PDF — we extract English (with OCR
          when needed), run your chosen model, and hand back downloadable Urdu.
        </p>
      </section>

      <TranslatorMount />

      <footer className="relative mx-auto w-full max-w-6xl px-5 pb-10 text-sm text-[var(--ink-soft)] sm:px-8">
        Models run through the Hugging Face Inference API. Set{" "}
        <code className="rounded bg-white/60 px-1.5 py-0.5">HF_API_TOKEN</code> in
        Vercel for higher rate limits.
      </footer>
    </main>
  );
}
