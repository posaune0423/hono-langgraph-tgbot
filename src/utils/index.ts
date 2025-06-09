import { TIMEOUT_MS } from "../constants";
import type { StreamChunk } from "../types";
import { logger } from "./logger";

// timeout processing
export const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), TIMEOUT_MS));

export const dumpTokenUsage = (chunk: StreamChunk) => {
  // Dump token usage
  if (
    "analyzer" in chunk &&
    chunk.analyzer?.messages?.length > 0 &&
    chunk.analyzer.messages[chunk.analyzer.messages.length - 1]?.usage_metadata
  ) {
    logger.info(
      "message handler",
      "Usage metadata (analyzer)",
      chunk.analyzer.messages[chunk.analyzer.messages.length - 1].usage_metadata,
    );
  } else if (
    "generalist" in chunk &&
    chunk.generalist?.messages?.length > 0 &&
    chunk.generalist.messages[chunk.generalist.messages.length - 1]?.usage_metadata
  ) {
    logger.info(
      "message handler",
      "Usage metadata (generalist)",
      chunk.generalist.messages[chunk.generalist.messages.length - 1].usage_metadata,
    );
  }
};

export const isAnalyzerMessage = (chunk: StreamChunk) => {
  return "analyzer" in chunk && chunk.analyzer?.messages?.length > 0;
};

export const isGeneralistMessage = (chunk: StreamChunk) => {
  return "generalist" in chunk && chunk.generalist?.messages?.length > 0;
};

/**
 * Sleep utility for rate limiting
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
