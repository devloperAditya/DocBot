import * as admin from "firebase-admin";
import path from "path";
import fs from "fs";

const initializeFirebase = async () => {
  if (!admin.apps.length) {
    // Check if running in emulator mode
    const isEmulator = process.env.FUNCTIONS_EMULATOR === "true" || process.env.FIREBASE_AUTH_EMULATOR_HOST;
    
    if (isEmulator) {
      // Use default initialization for emulator (no credentials needed)
      // The emulator will handle authentication internally
      try {
        admin.initializeApp({
          projectId: process.env.GCLOUD_PROJECT || "demo-project",
        });
        console.log("Firebase Admin initialized for emulator mode");
      } catch (error: unknown) {
        // If already initialized, that's fine
        if (!admin.apps.length) {
          console.warn("Firebase Admin emulator initialization issue:", error instanceof Error ? error.message : String(error));
        }
      }
    } else {
      // Production or local with service account
      try {
        // Try to use service account credentials if available (for local development)
        const serviceAccountPath = path.join(__dirname, "../../docbot-fa160-firebase-adminsdk-fbsvc-da5db32f1c.json");

        // Use fs.readFileSync for synchronous file reading
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log("Firebase Admin initialized with service account credentials");
      } catch (error: unknown) {
        console.error("Service account initialization failed:", error instanceof Error ? error.message : String(error) || "Unknown error");
        // Fallback to default initialization for Firebase Functions environment
        try {
          admin.initializeApp();
          console.log("Firebase Admin initialized with default credentials");
        } catch (fallbackError: unknown) {
          console.error("Default Firebase initialization also failed:", fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
          throw fallbackError;
        }
      }
    }
  } else {
    console.log("Firebase Admin already initialized");
  }
};

// Initialize Firebase immediately
initializeFirebase();

// Get Firestore database instance
const db = admin.firestore();

export interface SessionData {
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  uid?: string;
}

export interface MessageData {
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  retrieval?: {
    sources: Array<{
      chunk_idx: number;
      score: number;
      source: string;
    }>;
  };
}

/**
 * Create a new session in Firestore
 */
export async function createSession(
  sessionId: string,
  uid?: string,
  ttlMinutes?: number
): Promise<SessionData> {
  const now = new Date();
  // Use provided TTL or default to 60 minutes
  const ttl = ttlMinutes || 60;
  const expiresAt = new Date(now.getTime() + ttl * 60 * 1000);

  const sessionData: SessionData = {
    createdAt: now,
    lastActivityAt: now,
    expiresAt,
    ...(uid && { uid }),
  };

  await db.collection("sessions").doc(sessionId).set(sessionData);
  return sessionData;
}

/**
 * Get session data and validate it exists and hasn't expired
 */
export async function getSession(
  sessionId: string
): Promise<SessionData | null> {
  const doc = await db.collection("sessions").doc(sessionId).get();
  if (!doc.exists) {
    return null;
  }
  
  const sessionData = doc.data() as SessionData;
  
  // Check if session has expired
  if (sessionData.expiresAt) {
    let expiresAt: Date;
    
    // Handle Firestore Timestamp or Date object
    if (sessionData.expiresAt instanceof Date) {
      expiresAt = sessionData.expiresAt;
    } else if (typeof sessionData.expiresAt === 'object' && 'toDate' in sessionData.expiresAt) {
      // Firestore Timestamp
      expiresAt = (sessionData.expiresAt as any).toDate();
    } else {
      // Fallback: try to parse as date
      expiresAt = new Date(sessionData.expiresAt as any);
    }
    
    if (expiresAt < new Date()) {
      console.log(`Session ${sessionId} has expired (expired at ${expiresAt.toISOString()})`);
      return null;
    }
  }
  
  return sessionData;
}

/**
 * Update lastActivityAt timestamp for a session and extend expiration
 * This ensures that as long as the session is being used, it doesn't expire
 */
export async function updateSessionActivity(
  sessionId: string,
  ttlMinutes?: number
): Promise<void> {
  const now = new Date();
  const ttl = ttlMinutes || 60; // Default to 60 minutes
  const newExpiresAt = new Date(now.getTime() + ttl * 60 * 1000);
  
  await db
    .collection("sessions")
    .doc(sessionId)
    .update({
      lastActivityAt: now,
      expiresAt: newExpiresAt, // Extend expiration time
    });
}

/**
 * Ensure conversation document exists for session
 */
export async function ensureConversation(sessionId: string): Promise<void> {
  const conversationRef = db.collection("conversations").doc(sessionId);
  const conversation = await conversationRef.get();
  if (!conversation.exists) {
    await conversationRef.set({
      createdAt: new Date(),
      sessionId,
    });
  }
}

/**
 * Add a message to the conversation
 */
export async function addMessage(
  sessionId: string,
  message: Omit<MessageData, "createdAt">
): Promise<void> {
  await ensureConversation(sessionId);
  await db
    .collection("conversations")
    .doc(sessionId)
    .collection("messages")
    .add({
      ...message,
      createdAt: new Date(),
    });
}

/**
 * Delete session and all its conversations
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const batch = db.batch();

  // Delete session
  const sessionRef = db.collection("sessions").doc(sessionId);
  batch.delete(sessionRef);

  // Delete conversation messages
  const messagesRef = db
    .collection("conversations")
    .doc(sessionId)
    .collection("messages");
  const messages = await messagesRef.get();
  messages.docs.forEach((doc) => batch.delete(doc.ref));

  // Delete conversation document
  const conversationRef = db.collection("conversations").doc(sessionId);
  batch.delete(conversationRef);

  await batch.commit();
}

