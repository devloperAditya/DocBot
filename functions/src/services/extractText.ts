import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export type SupportedMimeType =
  | "application/pdf"
  | "application/msword"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "text/plain";

/**
 * Normalize whitespace: collapse weird line breaks, preserve paragraphs
 */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r/g, "") // Remove carriage returns
    .replace(/[ \t]+\n/g, "\n") // Trim line-end spaces and tabs
    .replace(/\n{3,}/g, "\n\n") // Max two newlines in a row
    .replace(/[ \t]{2,}/g, " "); // Collapse multiple spaces/tabs to single space
}

/**
 * Extract text from a PDF buffer
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  // Validate PDF header
  if (buffer.slice(0, 4).toString() !== "%PDF") {
    throw new Error("Invalid PDF file: missing PDF header");
  }

  // Suppress pdf-parse library warnings (e.g., "TT: undefined function")
  const originalWarn = console.warn;
  console.warn = () => {}; // Suppress during parsing

  let data;
  try {
    data = await pdfParse(buffer, { max: 0 });
  } finally {
    console.warn = originalWarn; // Restore original
  }

  if (!data.text || typeof data.text !== "string" || !data.text.trim()) {
    throw new Error("No text content extracted from PDF");
  }

  const rawText = data.text.trim();

  // Check for PDF structure artifacts indicating parsing failure
  if (rawText.includes("obj<<") || rawText.includes("/Filter") || rawText.includes("/Type/Font")) {
    throw new Error("Failed to extract readable text from PDF");
  }

  // Split by page breaks and normalize
  const pages = rawText
    .split("\f") // Form feed character used as page separator
    .map((p) => normalizeWhitespace(p).trim())
    .filter((p) => p.length > 0);

  // If no pages after splitting, use the whole normalized text
  const fullText = pages.length > 0 ? pages.join("\n\n") : normalizeWhitespace(rawText).trim();

  if (!fullText) {
    throw new Error("No readable text extracted from PDF after processing");
  }

  return fullText;
}

/**
 * Extract text from DOCX/DOC buffer
 */
async function extractFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });

  if (result.messages && result.messages.length > 0) {
    console.warn("Mammoth extraction warnings:", result.messages);
  }

  if (!result.value || !result.value.trim()) {
    throw new Error("No text content extracted from DOCX file");
  }

  return result.value;
}

/**
 * Extract text from plain text buffer
 */
function extractFromText(buffer: Buffer): string {
  const text = buffer.toString("utf-8");

  if (!text || !text.trim()) {
    throw new Error("Empty text file");
  }

  return text;
}

/**
 * Detect MIME type from file extension or URL
 */
export function detectMimeType(filenameOrUrl: string): SupportedMimeType {
  const lower = filenameOrUrl.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".txt")) return "text/plain";
  return "text/plain"; // Default
}

/**
 * Normalize MIME type from Content-Type header
 */
function normalizeMimeTypeFromContentType(contentType: string): SupportedMimeType | null {
  if (contentType.includes("pdf")) return "application/pdf";
  if (contentType.includes("wordprocessingml") || contentType.includes("msword")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (contentType.includes("text/plain") || contentType.includes("text/")) return "text/plain";
  return null;
}

/**
 * Extract text from buffer based on MIME type
 */
export async function extractText(buffer: Buffer, mimeType: SupportedMimeType): Promise<string> {
  if (!buffer || buffer.length === 0) {
    throw new Error("Empty buffer provided for text extraction");
  }

  switch (mimeType) {
    case "application/pdf":
      return await extractPdfText(buffer);
    case "application/msword":
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return await extractFromDocx(buffer);
    case "text/plain":
      return extractFromText(buffer);
    default:
      throw new Error(`Unsupported MIME type: ${mimeType}`);
  }
}

/**
 * Sanitize text: clean up whitespace, remove control characters, normalize formatting
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  return text
    .replace(/\x00/g, "") // Remove null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control characters
    .replace(/\r\n/g, "\n") // Normalize line endings
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n") // Max two consecutive newlines
    .replace(/[ \t]+/g, " ") // Collapse multiple spaces/tabs
    .replace(/^[ \t]+/gm, "") // Remove leading whitespace from lines
    .replace(/[ \t]+$/gm, "") // Remove trailing whitespace from lines
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Fetch file from URL and extract text
 */
export async function fetchAndExtractText(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength === 0) {
    throw new Error("Fetched file is empty");
  }

  const buffer = Buffer.from(arrayBuffer);

  // Detect MIME type: prefer Content-Type header, fall back to URL extension
  const mimeType =
    normalizeMimeTypeFromContentType(contentType) || detectMimeType(url);

  console.log(`Extracting text from ${mimeType} file (${buffer.length} bytes)`);

  const rawText = await extractText(buffer, mimeType);
  const sanitized = sanitizeText(rawText);

  if (!sanitized || !sanitized.trim()) {
    throw new Error("No text content remaining after extraction and sanitization");
  }

  console.log(`Successfully extracted and sanitized ${sanitized.length} characters`);

  return sanitized;
}