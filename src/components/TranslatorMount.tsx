"use client";

import dynamic from "next/dynamic";

const Translator = dynamic(() => import("@/components/Translator"), {
  ssr: false,
  loading: () => (
    <section className="mx-auto w-full max-w-6xl px-5 pb-16 pt-4 sm:px-8">
      <div
        className="min-h-[420px] rounded-[1.75rem] border border-[var(--line)]"
        style={{ background: "var(--panel)" }}
      />
    </section>
  ),
});

export default function TranslatorMount() {
  return <Translator />;
}
