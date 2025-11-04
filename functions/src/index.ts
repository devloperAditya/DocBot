import { startSession as startSessionFn } from "./api/startSession";
import { ingest as ingestFn } from "./api/ingest";
import { chat as chatFn } from "./api/chat";
import { endSession as endSessionFn } from "./api/endSession";
import { search as searchFn } from "./api/search";
import { validateConfig } from "./utils/config";
import * as functions from "firebase-functions";

// Don't validate config at startup - params.value() should only be called at runtime
// Validation will happen when functions are called and actually need the config values

// Export functions with secrets configured
export const startSession = functions.https.onRequest(startSessionFn);
export const ingest = functions.https.onRequest(ingestFn);
export const chat = functions.https.onRequest(chatFn);
export const endSession = functions.https.onRequest(endSessionFn);
export const search = functions.https.onRequest(searchFn);
