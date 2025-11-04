import * as express from "express";
import { z } from "zod";
import { getSession, updateSessionActivity, ensureConversation } from "../services/firestore";
import {
  fetchAndExtractText,
  extractText,
  detectMimeType,
  sanitizeText,
  SupportedMimeType,
} from "../services/extractText";
import { semanticChunk } from "../services/chunker";
import { sendSuccess, sendError } from "../utils/response";
import { authMiddleware, AuthenticatedRequest } from "../utils/authMiddleware";
import { config } from "../utils/config";
import Busboy from "busboy";
import { createEmbeddings } from "../services/localEmbeddings";
import { upsertChunks } from "../services/s3-vector";

const ingestSchema = z.object({
  sessionId: z.string().uuid(),
  fileUrl: z.string().url().optional(),
  text: z.string().optional(),
  overlap: z.number().int().min(0).max(500).optional().default(100),
  maxTokens: z.number().int().min(100).max(2000).optional().default(800),
});

interface ParsedFile {
  buffer: Buffer;
  filename: string;
  mimetype?: string;
}

interface ParsedFormData {
  sessionId: string;
  overlap: number;
  maxTokens: number;
  file?: ParsedFile;
}

/**
 * Normalize MIME type from filename and provided mimetype
 */
function normalizeMimeType(filename: string, providedMimetype?: string): SupportedMimeType {
  // If provided mimetype is available and valid, use it
  if (providedMimetype) {
    if (providedMimetype.includes("pdf")) {
      return "application/pdf";
    }
    if (providedMimetype.includes("wordprocessingml") || providedMimetype.includes("msword")) {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    if (providedMimetype.includes("text/plain") || providedMimetype.includes("text/")) {
      return "text/plain";
    }
  }
  // Fall back to filename-based detection
  return detectMimeType(filename);
}

/**
 * Extract text from uploaded file
 */
async function extractTextFromFile(file: ParsedFile): Promise<string> {
  const mimeType = normalizeMimeType(file.filename, file.mimetype);
  console.log(`Extracting text from ${mimeType} file: ${file.filename} (${file.buffer.length} bytes)`);
  const extractedText = await extractText(file.buffer, mimeType);
  const sanitized = sanitizeText(extractedText);
  console.log(`Extracted and sanitized ${sanitized.length} characters`);
  return sanitized;
}

/**
 * Parse multipart/form-data file upload
 */
function parseMultipartForm(req: express.Request): Promise<ParsedFormData> {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers as Record<string, string>,
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
    });

    const formData: Partial<ParsedFormData> = {
      overlap: 100,
      maxTokens: 800,
    };

    busboy.on("file", (name: string, file: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
      const fileChunks: Buffer[] = [];
      file.on("data", (chunk: Buffer) => fileChunks.push(chunk));
      file.on("end", () => {
        if (fileChunks.length > 0) {
          formData.file = {
            buffer: Buffer.concat(fileChunks),
            filename: info.filename || "unknown",
            mimetype: info.mimeType,
          };
        }
      });
      file.on("error", (err: Error) => reject(new Error(`File stream error: ${err.message}`)));
    });

    busboy.on("field", (name: string, value: string) => {
      if (name === "sessionId") {
        formData.sessionId = value;
      } else if (name === "overlap") {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) formData.overlap = parsed;
      } else if (name === "maxTokens") {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) formData.maxTokens = parsed;
      }
    });

    busboy.on("finish", () => {
      if (!formData.sessionId) {
        reject(new Error("sessionId is required"));
        return;
      }
      resolve(formData as ParsedFormData);
    });

    busboy.on("error", (error: Error) => reject(error));
    req.on("error", (error: Error) => reject(new Error(`Request stream error: ${error.message}`)));

    // Handle request stream
    const rawBody = (req as any).rawBody;
    if (rawBody && Buffer.isBuffer(rawBody)) {
      try {
        busboy.write(rawBody);
        busboy.end();
      } catch (error) {
        reject(new Error(`Failed to write rawBody to busboy: ${error instanceof Error ? error.message : String(error)}`));
      }
    } else if (typeof req.pipe === "function") {
      if (req.isPaused?.()) {
        req.resume();
      }
      req.pipe(busboy);
    } else {
      reject(new Error("Request stream has been consumed"));
    }
  });
}

/**
 * Handle CORS for multipart requests
 */
function handleCors(req: express.Request, res: express.Response): boolean {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  if (origin) {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

/**
 * Process ingest request - unified handler for both multipart and JSON
 */
async function processIngestRequest(
  req: express.Request,
  res: express.Response,
  parsedData: ParsedFormData | z.infer<typeof ingestSchema>
): Promise<void> {
  // Authenticate request
  const authReq = req as AuthenticatedRequest;
  await authMiddleware(authReq, res, () => {});

  const sessionId = parsedData.sessionId;
  const overlap = parsedData.overlap ?? 100;
  const maxTokens = parsedData.maxTokens ?? 800;

  // Validate session
  const session = await getSession(sessionId);
  if (!session) {
    sendError(res, 404, "Session not found or expired");
    return;
  }

  // Update session activity
  await updateSessionActivity(sessionId, config.sessionTtlMinutes);
  await ensureConversation(sessionId);

  // Extract text from different sources
  let rawText = "";
  if ("file" in parsedData && parsedData.file) {
    // Multipart file upload
    rawText = await extractTextFromFile(parsedData.file);
  } else if ("fileUrl" in parsedData && parsedData.fileUrl) {
    // JSON with file URL
    console.log(`Extracting text from file URL: ${parsedData.fileUrl}`);
    rawText = await fetchAndExtractText(parsedData.fileUrl);
    console.log(`Extracted and sanitized ${rawText.length} characters`);
  } else if ("text" in parsedData && parsedData.text) {
    // JSON with raw text
    rawText = sanitizeText(parsedData.text);
  } else {
    sendError(res, 400, "Either file, fileUrl, or text must be provided");
    return;
  }

  // Validate extracted text
  if (!rawText || rawText.trim().length === 0) {
    sendError(res, 400, "No text content extracted");
    return;
  }

  // Semantic chunking
  const chunks = await semanticChunk(rawText, { maxTokens, overlap });
  if (chunks.length === 0) {
    sendError(res, 400, "No chunks created from text");
    return;
  }

  // Validate chunks contain readable text (not binary data)
  const invalidChunks = chunks.filter(chunk => {
    // Check if chunk contains non-printable characters or appears to be binary
    // Allow normal whitespace and common Unicode characters
    const printableRatio = (chunk.match(/[\x20-\x7E\n\r\t]/g) || []).length / chunk.length;
    return printableRatio < 0.7 || chunk.length === 0;
  });

  if (invalidChunks.length > 0) {
    console.error(`Warning: ${invalidChunks.length} chunks appear to contain binary/invalid data`);
    console.error(`Sample invalid chunk preview: ${invalidChunks[0]?.substring(0, 200)}`);
    // Don't fail, but log a warning - might be valid Unicode text
  }

  // Log sample chunks for debugging
  console.log(`Created ${chunks.length} chunks from text`);
  if (chunks.length > 0) {
    console.log(`Sample chunk 1 (first 200 chars): ${chunks[0].substring(0, 200)}`);
  }

  // Generate embeddings
  const embeddings = await createEmbeddings(chunks);

  // Prepare metadata
  const source = ("fileUrl" in parsedData && parsedData.fileUrl) || ("text" in parsedData && parsedData.text) 
    ? "text" 
    : "upload";
  const metadatas = chunks.map((_, i) => ({
    sessionId,
    chunk_idx: i,
    source,
  }));

  // Upsert to S3 vector storage
  await upsertChunks(sessionId, chunks, embeddings, metadatas);

  sendSuccess(res, {
    sessionId,
    chunks: chunks.length,
    collection: `kb_${sessionId}`,
  });
}

/**
 * POST /api/ingest
 * Ingest a document (file URL, file upload, or raw text) into the session's knowledge base
 */
export const ingest = async (req: express.Request, res: express.Response): Promise<void> => {
  // Handle CORS
  if (handleCors(req, res)) {
    return; // OPTIONS request handled
  }

  if (req.method !== "POST") {
    sendError(res, 405, "Method not allowed");
    return;
  }

  const contentType = req.headers["content-type"] || "";
  const isMultipart = contentType.includes("multipart/form-data");

  try {
    if (isMultipart) {
      // Handle multipart/form-data
      const formData = await parseMultipartForm(req);
      if (!formData.file) {
        sendError(res, 400, "File is required when using multipart/form-data upload");
        return;
      }
      await processIngestRequest(req, res, formData);
    } else {
      // Handle JSON request
      const body = ingestSchema.parse(req.body);
      await processIngestRequest(req, res, body);
    }
  } catch (error) {
    console.error("Error ingesting document:", error);
    if (error instanceof z.ZodError) {
      sendError(res, 400, `Validation error: ${error.message}`);
    } else {
      sendError(
        res,
        error instanceof Error && error.message.includes("parse") ? 400 : 500,
        error instanceof Error ? error.message : "Internal server error"
      );
    }
  }
};