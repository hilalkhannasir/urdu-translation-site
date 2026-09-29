import { NextRequest, NextResponse } from "next/server";
import { chunkBySentences } from "@/lib/chunkText";
import { getModelById, type TranslationModel } from "@/lib/models";

type TranslateBody = {
  text?: string;
  modelId?: string;
};

const NLLB_SPACE_URL =
  process.env.NLLB_API_URL?.trim() ||
  "https://winstxnhdw-nllb-api.hf.space/api/v4/translator";

/** Soft cap after chunking is available; still guards runaway payloads. */
const MAX_INPUT_CHARS = 200_000;

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

  if (text.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      {
        error: `Text is too long. Keep input under ${MAX_INPUT_CHARS.toLocaleString()} characters.`,
      },
      { status: 400 },
    );
  }

  const model = getModelById(modelId);
  if (!model) {
    return NextResponse.json({ error: "Unknown model." }, { status: 400 });
  }

  try {
    const translation = await translateChunked(model, text);
    return NextResponse.json({
      translation,
      modelId: model.id,
      modelLabel: model.label,
    });
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 502 });
  }
}

function formatError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Translation request failed.";
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  const causeCode =
    cause && typeof cause === "object" && "code" in cause
      ? String((cause as { code?: unknown }).code)
      : "";

  if (
    error.message === "fetch failed" ||
    causeCode === "ENOTFOUND" ||
    causeCode === "ECONNREFUSED"
  ) {
    return "Could not reach the translation service. Try again shortly.";
  }

  return error.message || "Translation request failed.";
}

function getHfToken(): string | undefined {
  return process.env.HF_API_TOKEN?.trim() || process.env.HF_TOKEN?.trim();
}

async function translateChunked(
  model: TranslationModel,
  text: string,
): Promise<string> {
  const chunks = chunkBySentences(text, model.chunkChars);
  if (chunks.length === 0) {
    throw new Error("No translatable text found.");
  }

  const parts: string[] = [];
  for (const chunk of chunks) {
    const translated = await translateOne(model, chunk);
    if (translated.trim()) {
      parts.push(translated.trim());
    }
  }

  if (parts.length === 0) {
    throw new Error("The model returned an empty translation.");
  }

  return parts.join("\n\n");
}

async function translateOne(
  model: TranslationModel,
  text: string,
): Promise<string> {
  switch (model.inference) {
    case "nllb-space":
      return translateWithNllbSpace(text);
    case "chat":
      return translateWithQwenChat(model, text);
    default:
      throw new Error(`Unsupported model backend for ${model.label}.`);
  }
}

async function translateWithNllbSpace(text: string): Promise<string> {
  const response = await fetch(NLLB_SPACE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      source: "eng_Latn",
      target: "urd_Arab",
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `NLLB returned ${response.status}.`);
  }

  const data = (await response.json()) as { result?: string; detail?: string };
  if (!data.result?.trim()) {
    throw new Error(data.detail || "NLLB returned an empty translation.");
  }
  return data.result.trim();
}

async function translateWithQwenChat(
  model: TranslationModel,
  text: string,
): Promise<string> {
  const token = getHfToken();
  if (!token) {
    throw new Error("Qwen3-8B is not configured on this server yet.");
  }

  const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model.hfModel,
      temperature: 0.2,
      max_tokens: 2048,
      messages: [
        {
          role: "system",
          content:
            "You are a professional literary and scholarly English-to-Urdu translator. Preserve sentence structure, paragraph breaks, and meaning. Output only Urdu in Arabic/Nastaliq script — no explanations, notes, or English.",
        },
        {
          role: "user",
          content: text,
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      detail || `Qwen returned ${response.status}. Try again shortly.`,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: string;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    throw new Error(data.error || "Qwen returned an empty translation.");
  }

  return stripQwenThinking(content);
}

function stripQwenThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^\s*<\/?think>\s*/gi, "")
    .trim();
}
