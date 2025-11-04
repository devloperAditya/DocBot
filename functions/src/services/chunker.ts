import { encoding_for_model } from "tiktoken";

interface ChunkOptions {
  maxTokens?: number;
  overlap?: number;
}

/**
 * Split text into semantic chunks using sentence boundaries
 * Uses tiktoken for accurate token counting
 */
export async function semanticChunk(
  text: string,
  options: ChunkOptions = {}
): Promise<string[]> {
  const { maxTokens = 800, overlap = 100 } = options;

  // Get encoding for token counting (using gpt-3.5-turbo as a common model)
  const encoding = encoding_for_model("gpt-3.5-turbo");

  // Split into sentences (preserve sentence boundaries)
  const sentences = splitIntoSentences(text);

  if (sentences.length === 0) {
    encoding.free();
    return [text.trim()];
  }

  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentTokens = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceTokens = encoding.encode(sentence).length;

    // If adding this sentence would exceed maxTokens, finalize current chunk
    if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.join(" ").trim());
      
      // Handle overlap: keep last N sentences for overlap
      if (overlap > 0) {
        const overlapTokens = Math.floor((overlap / maxTokens) * currentTokens);
        let overlapTokensUsed = 0;
        const overlapSentences: string[] = [];
        
        // Add sentences from end of current chunk for overlap
        for (let j = currentChunk.length - 1; j >= 0; j--) {
          const sent = currentChunk[j];
          const sentTokens = encoding.encode(sent).length;
          if (overlapTokensUsed + sentTokens <= overlapTokens) {
            overlapSentences.unshift(sent);
            overlapTokensUsed += sentTokens;
          } else {
            break;
          }
        }
        
        currentChunk = overlapSentences;
        currentTokens = overlapTokensUsed;
      } else {
        currentChunk = [];
        currentTokens = 0;
      }
    }

    // Add sentence to current chunk
    currentChunk.push(sentence);
    currentTokens += sentenceTokens;
  }

  // Add remaining chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(" ").trim());
  }

  encoding.free();
  return chunks.filter((chunk) => chunk.trim().length > 0);
}

/**
 * Split text into sentences while preserving sentence boundaries
 */
function splitIntoSentences(text: string): string[] {
  // Normalize whitespace
  const normalized = text.replace(/\s+/g, " ").trim();
  
  // Split on sentence endings, but keep the punctuation
  // This regex matches: period, exclamation, question mark followed by space or end of string
  const sentenceEndings = /([.!?]+)\s+/g;
  const parts: string[] = [];
  let lastIndex = 0;
  let match;

  while ((match = sentenceEndings.exec(normalized)) !== null) {
    const endIndex = match.index + match[0].length;
    parts.push(normalized.substring(lastIndex, endIndex).trim());
    lastIndex = endIndex;
  }

  // Add remaining text
  if (lastIndex < normalized.length) {
    parts.push(normalized.substring(lastIndex).trim());
  }

  // Filter out empty parts and handle cases where sentences might be split incorrectly
  const sentences = parts.filter((p) => p.length > 0);

  // If no sentence endings found, try splitting on paragraph breaks or large chunks
  if (sentences.length === 0) {
    // Fallback: split on double newlines or large chunks
    return normalized
      .split(/\n\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  return sentences;
}
