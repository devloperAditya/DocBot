import * as express from "express";
import { v4 as uuidv4 } from "uuid";
import { createSession } from "../services/firestore";
import { config } from "../utils/config";
import { sendSuccess, sendError } from "../utils/response";
import { authMiddleware, AuthenticatedRequest } from "../utils/authMiddleware";
import cors from "cors";

const corsHandler = cors({ origin: true });

/**
 * POST /api/startSession
 * Creates a new ephemeral session
 */
export const startSession = async (req: express.Request, res: express.Response) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      return sendError(res, 405, "Method not allowed");
    }

    try {
      const authReq = req as AuthenticatedRequest;
      await authMiddleware(authReq, res, () => {});

      const sessionId = uuidv4();
      const uid = authReq.user?.uid;

      await createSession(sessionId, uid, config.sessionTtlMinutes);

      sendSuccess(res, {
        sessionId,
        ttlMinutes: config.sessionTtlMinutes,
      });
    } catch (error) {
      console.error("Error starting session:", error);
      sendError(
        res,
        500,
        error instanceof Error ? error.message : "Internal server error"
      );
    }
  });
};

