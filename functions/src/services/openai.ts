import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { config } from "../utils/config";
import * as localEmbeddings from "./localEmbeddings";

// Lazy initialization - only create client when first used (at runtime, not deployment)
let bedrockClient: BedrockRuntimeClient | null = null;

function getBedrockClient(): BedrockRuntimeClient {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({
      region: config.awsRegion,
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
    });
  }
  return bedrockClient;
}

/**
 * Generate embeddings for document chunks
 * Uses local embeddings (free, no API cost)
 */
export async function createEmbeddings(
  texts: string[]
): Promise<number[][]> {
  // Use local embeddings (free, no API cost)
  return localEmbeddings.createEmbeddings(texts);
}

/**
 * Generate a single embedding for a query
 * Uses local embeddings (free, no API cost)
 */
export async function createEmbedding(text: string): Promise<number[]> {
  // Use local embeddings (free, no API cost)
  return localEmbeddings.createEmbedding(text);
}

/**
 * Chat completion with AWS Bedrock
 * Supports Claude models (default) and other Bedrock models
 */
export async function chatCompletion(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  temperature = 0.2
): Promise<string> {
  const client = getBedrockClient();
  const modelId = config.bedrockModelId;

  // Separate system messages from conversation messages
  const systemMessages: string[] = [];
  const conversationMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemMessages.push(msg.content);
    } else {
      conversationMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }
  }

  const systemContent = systemMessages.join("\n\n");

  // Determine if this is a Claude model or another model type
  const isClaudeModel = modelId.includes("claude") || modelId.includes("anthropic");

  let requestBody: any;
  if (isClaudeModel) {
    // Claude models use a specific format
    requestBody = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4096,
      temperature,
      messages: conversationMessages,
    };
    if (systemContent) {
      requestBody.system = systemContent;
    }
  } else {
    // For other models (like Titan, Llama, etc.), adapt format as needed
    // This is a generic format - you may need to adjust for specific models
    requestBody = {
      inputText: conversationMessages
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join("\n"),
      textGenerationConfig: {
        temperature,
        maxTokenCount: 4096,
      },
    };
    if (systemContent) {
      requestBody.inputText = `System: ${systemContent}\n${requestBody.inputText}`;
    }
  }

  const command = new InvokeModelCommand({
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: new TextEncoder().encode(JSON.stringify(requestBody)),
  });

  const response = await client.send(command);
  
  if (!response.body) {
    throw new Error("Empty response from Bedrock");
  }

  // Handle response body (can be Readable stream or Uint8Array)
  let responseBody: any;
  if (response.body instanceof Uint8Array) {
    responseBody = JSON.parse(new TextDecoder().decode(response.body));
  } else {
    // Handle as stream - convert to Uint8Array
    const chunks: Uint8Array[] = [];
    const stream = response.body as any; // Type assertion to handle stream types
    
    // Check if it's a ReadableStream (web standard) with getReader method
    if (stream && typeof stream.getReader === 'function') {
      const reader = stream.getReader();
      let done = false;
      
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          chunks.push(value);
        }
      }
    } else {
      // Handle as Node.js Readable stream or async iterable
      const nodeStream = stream as { [Symbol.asyncIterator]?: () => AsyncIterableIterator<any> };
      if (nodeStream && typeof nodeStream[Symbol.asyncIterator] === 'function') {
        for await (const chunk of nodeStream as AsyncIterable<any>) {
          if (chunk instanceof Uint8Array) {
            chunks.push(chunk);
          } else if (Buffer.isBuffer(chunk)) {
            chunks.push(new Uint8Array(chunk));
          } else {
            chunks.push(new TextEncoder().encode(String(chunk)));
          }
        }
      } else {
        throw new Error("Unexpected response body type from Bedrock - not a ReadableStream or async iterable");
      }
    }
    
    // Concatenate all chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    responseBody = JSON.parse(new TextDecoder().decode(combined));
  }

  if (isClaudeModel) {
    // Claude response format
    return responseBody.content?.[0]?.text || "";
  } else {
    // Generic response format (adjust based on actual model response structure)
    return responseBody.results?.[0]?.outputText || responseBody.outputText || "";
  }
}

/**
 * Get the Bedrock client (for potential future use)
 * Note: OpenAI client is no longer available - this function is kept for compatibility
 */
export function getOpenAIClient(): BedrockRuntimeClient {
  return getBedrockClient();
}

