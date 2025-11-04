import * as functions from "firebase-functions";
import * as express from "express";
import { z } from "zod";
import { getSession, deleteSession } from "../services/firestore";
import { deleteCollection } from "../services/s3-vector";
import { sendSuccess, sendError } from "../utils/response";
import { authMiddleware, AuthenticatedRequest } from "../utils/authMiddleware";
import cors from "cors";

const corsHandler = cors({ origin: true });

const endSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

/**
 * POST /api/endSession
 * Delete session, conversations, and vector storage data
 */
export const endSession = async (req: express.Request, res: express.Response) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") {
        return sendError(res, 405, "Method not allowed");
      }

      try {
        const authReq = req as AuthenticatedRequest;
        await authMiddleware(authReq, res, () => {});

        const body = endSessionSchema.parse(req.body);

        const session = await getSession(body.sessionId);
        if (!session) {
          return sendError(res, 404, "Session not found");
        }

        // Delete vector storage data
        await deleteCollection(body.sessionId);

        // Delete Firestore data
        await deleteSession(body.sessionId);

        sendSuccess(res, {
          sessionId: body.sessionId,
          message: "Session ended successfully",
        });
      } catch (error) {
        console.error("Error ending session:", error);
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

