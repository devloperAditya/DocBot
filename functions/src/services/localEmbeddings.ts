import { pipeline } from "@xenova/transformers";

// Cache the pipeline to avoid reloading the model on every request
let embeddingPipeline: any = null;
let loadingPromise: Promise<any> | null = null;

/**
 * Get or initialize the embedding pipeline
 * Uses all-MiniLM-L6-v2: fast, lightweight, 384-dimensional embeddings
 */
async function getEmbeddingPipeline(): Promise<any> {
  if (embeddingPipeline) {
    return embeddingPipeline;
  }

  // If already loading, wait for it
  if (loadingPromise) {
    return loadingPromise;
  }

  // Start loading the model
  loadingPromise = (async () => {
    try {
      console.log("Loading local embedding model (all-MiniLM-L6-v2)...");
      
      // Use a fast, lightweight embedding model
      // all-MiniLM-L6-v2: 384 dimensions, ~90MB, fast inference
      embeddingPipeline = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        {
          quantized: true, // Use quantized model for faster loading and smaller size
        }
      );
      
      console.log("Local embedding model loaded successfully");
      loadingPromise = null;
      return embeddingPipeline!;
    } catch (error) {
      loadingPromise = null;
      console.error("Error loading embedding model:", error);
      throw error;
    }
  })();

  return loadingPromise;
}

/**
 * Generate embeddings for text chunks using local model
 * Returns 384-dimensional vectors (normalized)
 */
export async function createEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const pipeline = await getEmbeddingPipeline();
  const embeddings: number[][] = [];

  // Process texts one at a time for better compatibility with the transformers library
  for (const text of texts) {
    try {
      const output = await pipeline(text, {
        pooling: "mean",
        normalize: true,
      });

      // Convert tensor output to number array
      let embedding: number[];
      
      // Handle different output formats
      if (output && typeof output === "object") {
        if ("data" in output && output.data) {
          // Tensor with .data property
          embedding = Array.from(output.data as any);
        } else if (Array.isArray(output)) {
          // Already an array
          embedding = output;
        } else if ("tolist" in output) {
          // Tensor with tolist method
          embedding = (output as any).tolist();
        } else {
          // Try to extract as array
          embedding = Array.from(Object.values(output as any)) as number[];
        }
      } else if (Array.isArray(output)) {
        embedding = output as number[];
      } else {
        throw new Error(`Unexpected output format from embedding pipeline: ${typeof output}`);
      }

      // Ensure we have a valid 384-dimensional vector
      if (embedding.length !== 384) {
        console.warn(`Expected 384 dimensions, got ${embedding.length} for text: ${text.substring(0, 50)}...`);
      }

      embeddings.push(embedding);
    } catch (error) {
      console.error(`Error generating embedding for text: ${text.substring(0, 50)}...`, error);
      throw error;
    }
  }

  return embeddings;
}

/**
 * Generate a single embedding for a query
 */
export async function createEmbedding(text: string): Promise<number[]> {
  const embeddings = await createEmbeddings([text]);
  return embeddings[0] || [];
}

