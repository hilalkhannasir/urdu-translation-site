/**
 * Split text into chunks that respect sentence boundaries.
 * Prefers packing whole sentences up to maxChars; falls back to clause /
 * whitespace splits only when a single sentence exceeds the limit.
 */
export function chunkBySentences(text: string, maxChars: number): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const sentences = splitSentences(normalized);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const sentence of sentences) {
    const piece = sentence.trim();
    if (!piece) continue;

    if (piece.length > maxChars) {
      flush();
      for (const part of splitOversized(piece, maxChars)) {
        chunks.push(part);
      }
      continue;
    }

    if (!current) {
      current = piece;
      continue;
    }

    const joiner = /\n$/.test(current) || /^\n/.test(piece) ? "\n" : " ";
    if (current.length + joiner.length + piece.length <= maxChars) {
      current = `${current}${joiner}${piece}`;
    } else {
      flush();
      current = piece;
    }
  }

  flush();
  return chunks;
}

function splitSentences(text: string): string[] {
  // Keep paragraph breaks as hard separators, then split sentences inside.
  const paragraphs = text.split(/\n{2,}/);
  const sentences: string[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();
    if (!paragraph) continue;

    const { text: protectedParagraph, restore } = protectAbbreviations(paragraph);
    const parts =
      protectedParagraph.match(
        /[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g,
      ) ?? [protectedParagraph];

    for (const part of parts) {
      const trimmed = restore(part).trim();
      if (trimmed) sentences.push(trimmed);
    }

    // Preserve a blank line between paragraphs in the join logic.
    if (i < paragraphs.length - 1 && sentences.length > 0) {
      sentences[sentences.length - 1] = `${sentences[sentences.length - 1]}\n`;
    }
  }

  return sentences;
}

/** Common scholarly / title abbreviations that should not end a sentence. */
const ABBREVIATION_MATCH =
  /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|Fig|Eq|No|Vol|pp|cf|al)\./gi;

function protectAbbreviations(text: string): {
  text: string;
  restore: (value: string) => string;
} {
  const saved: string[] = [];
  // First protect multi-letter abbreviations, then initialisms like U.S.A.
  let out = text.replace(ABBREVIATION_MATCH, (match) => {
    const index = saved.push(match) - 1;
    return `⟦A${index}⟧`;
  });

  out = out.replace(/\b(?:[A-Z]\.){2,}/g, (match) => {
    const index = saved.push(match) - 1;
    return `⟦A${index}⟧`;
  });

  out = out.replace(/\b[A-Z]\.(?=\s|$)/g, (match) => {
    const index = saved.push(match) - 1;
    return `⟦A${index}⟧`;
  });

  return {
    text: out,
    restore: (value: string) =>
      value.replace(/⟦A(\d+)⟧/g, (_, index: string) => saved[Number(index)] ?? ""),
  };
}

function splitOversized(sentence: string, maxChars: number): string[] {
  // Prefer splitting on clauses, then spaces, then hard cut.
  const clauseParts =
    sentence.match(/[^,;:]+[,;:]+(?:\s+)?|[^,;:]+$/g)?.map((p) => p.trim()).filter(Boolean) ??
    [sentence];

  const out: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) out.push(current.trim());
    current = "";
  };

  for (const clause of clauseParts) {
    if (clause.length > maxChars) {
      pushCurrent();
      for (const wordChunk of splitByWords(clause, maxChars)) {
        out.push(wordChunk);
      }
      continue;
    }

    if (!current) {
      current = clause;
      continue;
    }

    if (current.length + 1 + clause.length <= maxChars) {
      current = `${current} ${clause}`;
    } else {
      pushCurrent();
      current = clause;
    }
  }

  pushCurrent();
  return out;
}

function splitByWords(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        out.push(current);
        current = "";
      }
      for (let i = 0; i < word.length; i += maxChars) {
        out.push(word.slice(i, i + maxChars));
      }
      continue;
    }

    if (!current) {
      current = word;
      continue;
    }

    if (current.length + 1 + word.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      out.push(current);
      current = word;
    }
  }

  if (current) out.push(current);
  return out;
}
