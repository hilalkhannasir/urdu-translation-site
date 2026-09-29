import { NextRequest, NextResponse } from "next/server";
import { getModelById } from "@/lib/models";

type TranslateBody = {
  text?: string;
  modelId?: string;
};

export async function POST(request: NextRequest) {
  let body: TranslateBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = body.text?.trim() ?? "";
  const modelId = body.modelId?.trim() ?? "";

  if (!text) {
    return NextResponse.json({ error: "Text is required." }, { status: 400 });
  }

  if (text.length > 12000) {
    return NextResponse.json(
      { error: "Text is too long. Keep input under 12,000 characters." },
      { status: 400 },
    );
  }

  const model = getModelById(modelId);
  if (!model) {
    return NextResponse.json({ error: "Unknown model." }, { status: 400 });
  }

  try {
    const translation = await translateWithHuggingFace(model.hfModel, text, model.id);
    return NextResponse.json({
      translation,
      modelId: model.id,
      modelLabel: model.label,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Translation request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function translateWithHuggingFace(
  hfModel: string,
  text: string,
  modelId: string,
): Promise<string> {
  const token = process.env.HF_API_TOKEN;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const payload = buildPayload(hfModel, text, modelId);
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${hfModel}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    },
  );

  if (response.status === 503) {
    throw new Error(
      "The selected model is loading on Hugging Face. Wait a few seconds and try again.",
    );
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      detail || `Hugging Face returned ${response.status}. Check HF_API_TOKEN or model availability.`,
    );
  }

  const data = await response.json();
  return extractTranslation(data);
}

function buildPayload(hfModel: string, text: string, modelId: string) {
  if (modelId === "nllb-200") {
    return {
      inputs: text,
      parameters: {
        src_lang: "eng_Latn",
        tgt_lang: "urd_Arab",
      },
    };
  }

  if (modelId === "mbart-50" || hfModel.includes("mbart")) {
    return {
      inputs: text,
      parameters: {
        src_lang: "en_XX",
        tgt_lang: "ur_PK",
      },
    };
  }

  return { inputs: text };
}

function extractTranslation(data: unknown): string {
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as Record<string, unknown>;
    if (typeof first.translation_text === "string") {
      return first.translation_text;
    }
    if (typeof first.generated_text === "string") {
      return first.generated_text;
    }
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.translation_text === "string") {
      return record.translation_text;
    }
    if (typeof record.generated_text === "string") {
      return record.generated_text;
    }
    if (typeof record.error === "string") {
      throw new Error(record.error);
    }
  }

  throw new Error("Unexpected response format from the translation model.");
}
