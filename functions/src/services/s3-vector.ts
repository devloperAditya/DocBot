/**
 * S3 Vector Storage Service
 * Stores vectors, documents, and metadata in S3 buckets
 * 
 * Architecture:
 * - Each session has a JSON file in S3 containing all vectors, documents, and metadata
 * - Files are stored as: s3://bucket/vectors/{sessionId}.json
 * - Vector search is performed in-memory after loading from S3
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { config } from "../utils/config";

// In-memory cache to avoid reloading from S3 on every request
const vectorCache = new Map<string, {
  data: VectorData;
  timestamp: number;
}>();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

interface VectorData {
  ids: string[];
  embeddings: number[][];
  documents: string[];
  metadatas: Array<{ sessionId: string; chunk_idx: number; source: string }>;
}

interface QueryResult {
  id: string;
  document: string;
  metadata: { sessionId: string; chunk_idx: number; source: string };
  distance: number;
}

// Initialize S3 client
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: config.awsRegion,
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
    });
  }
  return s3Client;
}

/**
 * Get S3 bucket name from config
 */
function getS3Bucket(): string {
  const bucket = config.s3VectorBucket;
  if (!bucket) {
    throw new Error("S3_VECTOR_BUCKET is not set in config");
  }
  return bucket;
}

/**
 * Get S3 key for a session's vector data
 */
function getS3Key(sessionId: string): string {
  return `vectors/${sessionId}.json`;
}

/**
 * Calculate cosine distance between two vectors (lower is more similar)
 */
function cosineDistance(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error(`Vector dimension mismatch: ${vec1.length} vs ${vec2.length}`);
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (denominator === 0) {
    return 1; // Vectors are zero, return max distance
  }

  // Cosine similarity (1 - similarity gives us distance)
  const similarity = dotProduct / denominator;
  return 1 - similarity;
}

/**
 * Load vector data from S3 (with caching)
 */
async function loadVectorData(sessionId: string): Promise<VectorData> {
  // Check cache first
  const cached = vectorCache.get(sessionId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const bucket = getS3Bucket();
  const key = getS3Key(sessionId);

  try {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);
    
    if (!response.Body) {
      // File doesn't exist yet, return empty data
      return {
        ids: [],
        embeddings: [],
        documents: [],
        metadatas: [],
      };
    }

    // Read the body stream
    let bodyString = "";
    
    // Handle different stream types - S3 SDK v3 uses a stream with transformToString
    if (response.Body) {
      // AWS SDK v3 provides transformToString method
      if ("transformToString" in response.Body && typeof response.Body.transformToString === "function") {
        bodyString = await (response.Body as any).transformToString();
      } else if (Buffer.isBuffer(response.Body)) {
        // Handle Buffer directly
        bodyString = response.Body.toString("utf-8");
      } else {
        // Fallback: convert to string
        bodyString = String(response.Body);
      }
    }

    const data = JSON.parse(bodyString) as VectorData;

    // Update cache
    vectorCache.set(sessionId, { data, timestamp: Date.now() });

    return data;
  } catch (error: any) {
    if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
      // File doesn't exist, return empty data
      return {
        ids: [],
        embeddings: [],
        documents: [],
        metadatas: [],
      };
    }
    console.error(`[S3-Vector] Error loading data for session ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Save vector data to S3
 */
async function saveVectorData(sessionId: string, data: VectorData): Promise<void> {
  const bucket = getS3Bucket();
  const key = getS3Key(sessionId);

  try {
    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    });

    await client.send(command);

    // Update cache
    vectorCache.set(sessionId, { data, timestamp: Date.now() });

    console.log(`[S3-Vector] Saved ${data.ids.length} vectors to s3://${bucket}/${key}`);
  } catch (error) {
    console.error(`[S3-Vector] Error saving data for session ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Get or create collection (compatibility function, no-op for S3)
 */
export async function getOrCreateCollection(sessionId: string): Promise<any> {
  // S3 doesn't have collections, but we keep this for API compatibility
  await loadVectorData(sessionId);
  return { name: `kb_${sessionId}` };
}

/**
 * Get existing collection (compatibility function)
 */
export async function getCollection(sessionId: string): Promise<any> {
  const data = await loadVectorData(sessionId);
  if (data.ids.length === 0) {
    throw new Error(
      `Collection kb_${sessionId} not found. Make sure documents have been ingested for this session.`
    );
  }
  return { name: `kb_${sessionId}` };
}

/**
 * Upsert chunks into a session collection
 */
export async function upsertChunks(
  sessionId: string,
  chunks: string[],
  embeddings: number[][],
  metadatas: Array<{ sessionId: string; chunk_idx: number; source: string }>
): Promise<void> {
  if (chunks.length !== embeddings.length || chunks.length !== metadatas.length) {
    throw new Error("Chunks, embeddings, and metadatas arrays must have the same length");
  }

  // Load existing data
  const existing = await loadVectorData(sessionId);

  // Generate IDs
  const ids = chunks.map((_, i) => `${sessionId}::${i}`);

  // Validate chunks
  const validatedChunks = chunks.map((chunk, i) => {
    if (typeof chunk !== "string") {
      console.error(`[S3-Vector] Chunk ${i} is not a string: ${typeof chunk}`);
      return String(chunk);
    }
    return chunk;
  });

  // Check for duplicates (by ID) and update/append
  const existingIds = new Set(existing.ids);
  const toUpdate: number[] = [];
  const toAppend: number[] = [];

  ids.forEach((id, i) => {
    if (existingIds.has(id)) {
      toUpdate.push(i);
    } else {
      toAppend.push(i);
    }
  });

  // Update existing vectors
  toUpdate.forEach((i) => {
    const idx = existing.ids.indexOf(ids[i]);
    if (idx !== -1) {
      existing.ids[idx] = ids[i];
      existing.embeddings[idx] = embeddings[i];
      existing.documents[idx] = validatedChunks[i];
      existing.metadatas[idx] = metadatas[i];
    }
  });

  // Append new vectors
  toAppend.forEach((i) => {
    existing.ids.push(ids[i]);
    existing.embeddings.push(embeddings[i]);
    existing.documents.push(validatedChunks[i]);
    existing.metadatas.push(metadatas[i]);
  });

  // Save to S3
  await saveVectorData(sessionId, existing);

  console.log(
    `[S3-Vector] Upserted ${chunks.length} chunks (${toUpdate.length} updated, ${toAppend.length} new) for session ${sessionId}`
  );
}

/**
 * Query collection for similar chunks
 */
export async function queryCollection(
  sessionId: string,
  queryEmbedding: number[],
  topK = 5
): Promise<QueryResult[]> {
  if (!queryEmbedding || queryEmbedding.length === 0) {
    throw new Error("Query embedding is empty");
  }

  try {
    const data = await loadVectorData(sessionId);

    if (data.ids.length === 0) {
      console.warn(`[S3-Vector] No vectors found for session ${sessionId}`);
      return [];
    }

    console.log(
      `[S3-Vector] Querying kb_${sessionId} with dim=${queryEmbedding.length}, topK=${topK}, total vectors=${data.ids.length}`
    );

    // Calculate distances to all vectors
    const distances = data.embeddings.map((embedding, i) => ({
      index: i,
      distance: cosineDistance(queryEmbedding, embedding),
    }));

    // Sort by distance (ascending) and take top K
    distances.sort((a, b) => a.distance - b.distance);
    const topResults = distances.slice(0, topK);

    // Map to results
    const results: QueryResult[] = topResults.map(({ index, distance }) => {
      let doc = data.documents[index] || "";

      // Ensure document is a string
      if (typeof doc !== "string") {
        console.warn(`[S3-Vector] Document ${index} is not a string, converting...`);
        try {
          if (typeof Buffer !== "undefined" && Buffer.isBuffer && Buffer.isBuffer(doc)) {
            doc = (doc as Buffer).toString("utf-8");
          } else {
            doc = String(doc);
          }
        } catch (error) {
          console.error(`[S3-Vector] Failed to convert document ${index} to string:`, error);
          doc = "";
        }
      }

      return {
        id: data.ids[index],
        document: doc,
        metadata: data.metadatas[index] || {
          sessionId,
          chunk_idx: index,
          source: "unknown",
        },
        distance,
      };
    });

    console.log(`[S3-Vector] Returned ${results.length} results for session ${sessionId}`);
    return results;
  } catch (error) {
    console.error(`[S3-Vector] Error querying kb_${sessionId}:`, error);
    throw error;
  }
}

/**
 * Delete a session collection
 */
export async function deleteCollection(sessionId: string): Promise<void> {
  const bucket = getS3Bucket();
  const key = getS3Key(sessionId);

  try {
    const client = getS3Client();
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);

    // Remove from cache
    vectorCache.delete(sessionId);

    console.log(`[S3-Vector] Deleted collection kb_${sessionId} from S3`);
  } catch (error: any) {
    if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
      console.warn(`[S3-Vector] Collection kb_${sessionId} not found in S3 (already deleted)`);
      return;
    }
    console.error(`[S3-Vector] Error deleting collection kb_${sessionId}:`, error);
    throw error;
  }
}

/**
 * Ensure S3 is ready (compatibility function)
 */
export async function ensureChromaReady(): Promise<void> {
  // Note: Function name kept for backward compatibility
  // Verify S3 credentials and bucket exist
  const bucket = getS3Bucket();
  try {
    const client = getS3Client();
    // Try to list objects (this verifies bucket access)
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      MaxKeys: 1,
    });
    await client.send(command);
    console.log(`[S3-Vector] S3 bucket ${bucket} is accessible`);
  } catch (error) {
    console.error(`[S3-Vector] Error accessing S3 bucket ${bucket}:`, error);
    throw new Error(`Cannot access S3 bucket: ${bucket}. Check AWS credentials and bucket permissions.`);
  }
}

