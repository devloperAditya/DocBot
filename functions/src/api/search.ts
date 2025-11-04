import * as express from "express";
import { z } from "zod";
import { getSession, updateSessionActivity } from "../services/firestore";
import { createEmbedding } from "../services/openai";
import { queryCollection } from "../services/s3-vector";
import { sendSuccess, sendError } from "../utils/response";
import { authMiddleware, AuthenticatedRequest } from "../utils/authMiddleware";
import cors from "cors";

const corsHandler = cors({ origin: true });

/**
 * GET /api/search?sessionId=...&q=...&topK=5
 * Debug endpoint for raw vector search results
 */
export const search = async (req: express.Request, res: express.Response) => {
    corsHandler(req, res, async () => {
      if (req.method !== "GET") {
        return sendError(res, 405, "Method not allowed");
      }

      try {
        const authReq = req as AuthenticatedRequest;
        await authMiddleware(authReq, res, () => {});

        const querySchema = z.object({
          sessionId: z.string().uuid(),
          q: z.string().min(1),
          topK: z.string().optional().transform((val) => {
            const num = parseInt(val || "5", 10);
            return isNaN(num) ? 5 : num;
          }),
        });

        const params = querySchema.parse(req.query);

        // Validate session
        const session = await getSession(params.sessionId);
        if (!session) {
          return sendError(res, 404, "Session not found");
        }

        await updateSessionActivity(params.sessionId);

        // Embed query
        const queryEmbedding = await createEmbedding(params.q);

        // Query vector storage
        const results = await queryCollection(
          params.sessionId,
          queryEmbedding,
          params.topK || 5
        );

        sendSuccess(res, {
          sessionId: params.sessionId,
          query: params.q,
          results: results.map((r) => ({
            chunk_idx: r.metadata.chunk_idx,
            document: r.document.substring(0, 500),
            score: 1 - r.distance,
            source: r.metadata.source,
          })),
        });
      } catch (error) {
        console.error("Error in search:", error);
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

