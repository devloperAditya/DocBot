/**
 * Environment configuration for Firebase Functions
 * Uses Firebase Functions params API for type-safe configuration
 * Set these via Firebase secrets or environment variables
 */

import { defineString, defineInt, defineSecret } from "firebase-functions/params";

// AWS Bedrock configuration
const awsAccessKeyIdParam = defineString("AWS_ACCESS_KEY_ID", {
  default: "",
  description: "AWS Access Key ID",
});

const awsSecretAccessKeyParam = defineString("AWS_SECRET_ACCESS_KEY", {
  default: "",
  description: "AWS Secret Access Key",
});

const awsRegionParam = defineString("AWS_REGION", {
  default: "us-east-1",
  description: "AWS Region for Bedrock",
});

const bedrockModelIdParam = defineString("BEDROCK_MODEL_ID", {
  default: "anthropic.claude-3-sonnet-20240229-v1:0",
  description: "AWS Bedrock model ID to use",
});

// Legacy OpenAI embed model param (kept for backward compatibility)
const openaiEmbedModelParam = defineString("OPENAI_EMBED_MODEL", {
  default: "text-embedding-3-small",
  description: "OpenAI embedding model to use (legacy, using local embeddings)",
});

const s3VectorBucketParam = defineString("S3_VECTOR_BUCKET", {
  default: "",
  description: "S3 bucket name for storing vectors",
});

// Integer parameter
const sessionTtlMinutesParam = defineInt("SESSION_TTL_MINUTES", {
  default: 60,
  description: "Session TTL in minutes",
});

export const config = {
  get awsAccessKeyId() {
    return awsAccessKeyIdParam.value();
  },
  get awsSecretAccessKey() {
    return awsSecretAccessKeyParam.value();
  },
  get awsRegion() {
    return awsRegionParam.value();
  },
  get bedrockModelId() {
    return bedrockModelIdParam.value();
  },
  // Legacy OpenAI embed model (kept for backward compatibility with embeddings if needed)
  get openaiEmbedModel() {
    return openaiEmbedModelParam.value();
  },
  get s3VectorBucket() {
    return s3VectorBucketParam.value();
  },
  get sessionTtlMinutes() {
    return sessionTtlMinutesParam.value();
  },
};

let configValidated = false;

/**
 * Validate config at runtime (when function is called)
 * Don't validate at module load time to avoid calling .value() during deployment
 */
export function validateConfig(): void {
  if (configValidated) {
    return;
  }

  const errors: string[] = [];

  try {
    const accessKeyId = config.awsAccessKeyId;
    if (!accessKeyId) {
      errors.push("AWS_ACCESS_KEY_ID is required");
    }
  } catch (error) {
    errors.push("AWS_ACCESS_KEY_ID is required");
  }

  try {
    const secretAccessKey = config.awsSecretAccessKey;
    if (!secretAccessKey) {
      errors.push("AWS_SECRET_ACCESS_KEY is required");
    }
  } catch (error) {
    errors.push("AWS_SECRET_ACCESS_KEY is required");
  }

  try {
    const s3Bucket = config.s3VectorBucket;
    if (!s3Bucket) {
      errors.push("S3_VECTOR_BUCKET is required");
    }
  } catch (error) {
    errors.push("S3_VECTOR_BUCKET is required");
  }

  if (errors.length > 0) {
    const errorMessage = `Configuration errors: ${errors.join(", ")}`;
    console.error(errorMessage);
    console.error(
      "Please set environment variables using Firebase secrets or defineString/defineSecret parameters."
    );
    throw new Error(errorMessage);
  }

  configValidated = true;
}

/**
 * Validate config and return a user-friendly error message if invalid
 * This can be used in API handlers to return proper error responses
 */
export function validateConfigOrThrow(): void {
  validateConfig();
}

/**
 * Export the secret parameters so they can be referenced in function definitions
 * This allows Firebase Functions to automatically inject secrets
 */
