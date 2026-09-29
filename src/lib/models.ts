export type TranslationModel = {
  id: string;
  label: string;
  description: string;
  provider: "huggingface" | "nllb-space";
  hfModel: string;
  inference: "chat" | "nllb-space";
  /** Soft character budget per request before sentence-aware chunking. */
  chunkChars: number;
};

export const TRANSLATION_MODELS: TranslationModel[] = [
  {
    id: "nllb-200",
    label: "NLLB-200",
    description:
      "Meta’s multilingual translator — strong general English → Urdu coverage across many domains.",
    provider: "nllb-space",
    hfModel: "facebook/nllb-200-distilled-600M",
    inference: "nllb-space",
    chunkChars: 1600,
  },
  {
    id: "qwen3-8b",
    label: "Qwen3-8B",
    description:
      "Instruction-tuned model that can preserve tone and phrasing when rendering English prose into Urdu.",
    provider: "huggingface",
    hfModel: "Qwen/Qwen3-8B",
    inference: "chat",
    chunkChars: 3500,
  },
];

export function getModelById(id: string): TranslationModel | undefined {
  return TRANSLATION_MODELS.find((model) => model.id === id);
}
