export type TranslationModel = {
  id: string;
  label: string;
  description: string;
  provider: "huggingface";
  hfModel: string;
};

export const TRANSLATION_MODELS: TranslationModel[] = [
  {
    id: "opus-mt-en-ur",
    label: "OPUS-MT English → Urdu",
    description: "Helsinki-NLP MarianMT — fast and reliable for EN→UR.",
    provider: "huggingface",
    hfModel: "Helsinki-NLP/opus-mt-en-ur",
  },
  {
    id: "nllb-200",
    label: "NLLB-200 (distilled)",
    description: "Meta NLLB distilled 600M — broader multilingual coverage.",
    provider: "huggingface",
    hfModel: "facebook/nllb-200-distilled-600M",
  },
  {
    id: "mbart-50",
    label: "mBART-50 Many-to-Many",
    description: "Facebook mBART-50 — strong document-style translation.",
    provider: "huggingface",
    hfModel: "facebook/mbart-large-50-many-to-many-mmt",
  },
];

export function getModelById(id: string): TranslationModel | undefined {
  return TRANSLATION_MODELS.find((model) => model.id === id);
}
