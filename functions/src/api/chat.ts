import * as express from "express";
import { z } from "zod";
import {
  getSession,
  updateSessionActivity,
  addMessage,
} from "../services/firestore";
import { createEmbedding, chatCompletion } from "../services/openai";
import { queryCollection } from "../services/s3-vector";
import { sendSuccess, sendError } from "../utils/response";
import { authMiddleware, AuthenticatedRequest } from "../utils/authMiddleware";
import { config } from "../utils/config";
import cors from "cors";

const corsHandler = cors({ origin: true });

const chatSchema = z.object({
  sessionId: z.string().uuid(),
  userMessage: z.string().min(1),
  topK: z.number().int().min(1).max(20).optional().default(5),
});

/**
 * POST /api/chat
 * Chat with the RAG system using the session's knowledge base
 */
export const chat = async (req: express.Request, res: express.Response) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      return sendError(res, 405, "Method not allowed");
    }

    try {
      const authReq = req as AuthenticatedRequest;
      await authMiddleware(authReq, res, () => {});

      const body = chatSchema.parse(req.body);

      // Validate session
      const session = await getSession(body.sessionId);
      if (!session) {
        return sendError(res, 404, "Session not found");
      }

      // Extend session expiration on activity
      await updateSessionActivity(body.sessionId, config.sessionTtlMinutes);

      // Store user message
      await addMessage(body.sessionId, {
        role: "user",
        content: body.userMessage,
      });

      // Embed query
      const queryEmbedding = await createEmbedding(body.userMessage);

      // Query vector storage for relevant chunks
      const results = await queryCollection(
        body.sessionId,
        queryEmbedding,
        body.topK
      );

      // Log all retrieval results for debugging
      console.log(`Query: "${body.userMessage}"`);
      console.log(`Retrieved ${results.length} results from S3 vector storage`);
      
      if (results.length === 0) {
        console.error("ERROR: No results retrieved from vector storage! Check if documents were ingested correctly.");
      } else {
        console.log("Retrieval results with raw values from vector storage:");
        results.forEach((r, idx) => {
          // Vector storage returns cosine distance (lower = more similar, 0 = identical)
          // Cosine distance ranges from 0 (identical) to 2 (opposite)
          // Calculate similarity score: similarity = 1 - distance
          const similarity = Math.max(0, 1 - r.distance);
          console.log(`  [${idx + 1}] Cosine Distance: ${r.distance.toFixed(3)}, Similarity: ${similarity.toFixed(3)}, Doc length: ${r.document.length}`);
          console.log(`    Preview: ${r.document.substring(0, 150)}...`);
        });
      }

      // For now, use all results regardless of similarity threshold
      // The threshold was too strict and filtering out valid matches
      // Lower distance = higher similarity. For cosine distance, typical good matches are < 0.5
      const filteredResults = results; // Use all results for now
      
      // Build RAG prompt with full context (no truncation for better answers)
      const context =
        filteredResults.length > 0
          ? filteredResults
              .map((r, idx) => {
                // L2 distance on normalized embeddings: lower = better match
                // Distance ~1.76 means reasonable semantic similarity
                // Don't filter based on this - let LLM assess relevance from content
                return `[Source ${idx + 1}]\n${r.document}`;
              })
              .join("\n\n---\n\n")
          : "No relevant context found in the knowledge base. Please make sure documents have been ingested for this session.";

      const systemPrompt = `You are a helpful assistant that answers questions based on the provided context documents. Your goal is to be helpful and answer the user's question to the best of your ability.

Guidelines:
- Answer the question using the information from the provided context
- If the context contains relevant information, synthesize it into a clear, helpful answer
- Only say you don't have enough information if the context is truly insufficient or irrelevant
- Be concise but complete in your answers
- If you can partially answer based on the context, do so and mention what information is available`;

      const userPrompt = `Based on the following context documents, answer the user's question.

Context Documents:
${context}

User Question: ${body.userMessage}

Provide a helpful answer based on the context above.`;

      // Generate answer
      const answer = await chatCompletion(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        0.2
      );

      // Prepare sources - handle both distance and similarity cases
      const sources = results.map((r) => {
        const score = r.distance < 0 ? r.distance : (1 - r.distance);
        return {
          chunk_idx: r.metadata.chunk_idx,
          score, // Similarity score (1 - distance)
          source: r.metadata.source,
        };
      });

      // Store assistant message
      await addMessage(body.sessionId, {
        role: "assistant",
        content: answer,
        retrieval: { sources },
      });

      sendSuccess(res, {
        sessionId: body.sessionId,
        answer,
        sources,
      });
    } catch (error) {
      console.error("Error in chat:", error);
      if (error instanceof z.ZodError) {
        return sendError(res, 400, `Validation error: ${error.message}`);
      }
      sendError(
        res,
        500,
        error instanceof Error ? error.message : "Internal server error"
      );
    }
  });
};
