import { Request, Response } from "express";
import * as admin from "firebase-admin";

export interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

/**
 * Middleware to verify Firebase ID token
 * Optional: can be made strict or permissive based on requirements
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: () => void
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // For now, make it optional - you can change this to return 401 if auth is required
    return next();
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    // Check if running in emulator mode
    const isEmulator = process.env.FUNCTIONS_EMULATOR === "true" || process.env.FIREBASE_AUTH_EMULATOR_HOST;
    
    let decodedToken: admin.auth.DecodedIdToken;
    
    if (isEmulator) {
      // In emulator mode, use checkRevoked: false and allow unsigned tokens
      // The emulator doesn't sign tokens with the same key as production
      decodedToken = await admin.auth().verifyIdToken(idToken, true);
    } else {
      // In production, verify normally
      decodedToken = await admin.auth().verifyIdToken(idToken);
    }
    
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    // Optional: return 401 here if auth is required
    // For now, allow the request to continue without authentication
    next();
  }
}

