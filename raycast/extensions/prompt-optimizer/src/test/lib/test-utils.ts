import {
  safeExec,
  parseGeminiJson,
  parseGeminiJsonFull,
  withIsolatedGemini,
  withIsolatedCodex,
} from "../../utils/exec";
import type { TokenData, TimingData } from "../../utils/types";

export interface LLMRunOptions {
  timeout?: number;
  model?: string;
  reasoningEffort?: "high" | "medium" | "low";
}

const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
const DEFAULT_CODEX_MODEL = "gpt-5.2-codex";
const DEFAULT_TIMEOUT = 60_000;

export async function runGemini(prompt: string, options: LLMRunOptions = {}): Promise<string> {
  const model = options.model || DEFAULT_GEMINI_MODEL;
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  return withIsolatedGemini(async (homeDir) => {
    const rawOutput = await safeExec("gemini", ["--model", model, "--output-format", "json"], prompt, timeout, {
      HOME: homeDir,
    });
    return parseGeminiJson(rawOutput);
  });
}

export async function runCodex(prompt: string, options: LLMRunOptions = {}): Promise<string> {
  const model = options.model || DEFAULT_CODEX_MODEL;
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const reasoning = options.reasoningEffort || "high";

  return withIsolatedCodex(async (homeDir) => {
    return safeExec(
      "codex",
      ["exec", "-m", model, "--config", `model_reasoning_effort="${reasoning}"`, "--skip-git-repo-check"],
      prompt,
      timeout,
      { CODEX_HOME: homeDir },
    );
  });
}

export async function runWithEngine(
  engine: "gemini" | "codex",
  prompt: string,
  options: LLMRunOptions = {},
): Promise<string> {
  if (engine === "gemini") {
    return runGemini(prompt, options);
  } else {
    return runCodex(prompt, options);
  }
}

/**
 * Retry with exponential backoff and jitter.
 * Handles Gemini rate limits gracefully.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 2000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isRateLimit = lastError.message.includes("exhausted your capacity");

      if (attempt < maxRetries) {
        // Exponential backoff with jitter (±25%)
        const baseDelay = baseDelayMs * Math.pow(2, attempt);
        const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
        const delay = Math.round(baseDelay + jitter);

        if (isRateLimit) {
          console.warn(`Rate limited, retry ${attempt + 1}/${maxRetries} in ${delay}ms...`);
        } else {
          console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// --- V3 Metadata Tracking ---

export interface RetryResult<T> {
  result: T;
  attempts: number;
  totalRetryDelayMs: number;
  failedAttempts: string[];
}

export interface GeminiRunResult {
  response: string;
  tokens: TokenData | null;
  timing: TimingData;
  retry: RetryResult<string>;
}

export async function withRetryTracked<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 2000,
): Promise<RetryResult<T>> {
  const failedAttempts: string[] = [];
  let totalRetryDelayMs = 0;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return { result, attempts: attempt + 1, totalRetryDelayMs, failedAttempts };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      failedAttempts.push(lastError.message);

      if (attempt < maxRetries) {
        const baseDelay = baseDelayMs * Math.pow(2, attempt);
        const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
        const delay = Math.round(baseDelay + jitter);
        totalRetryDelayMs += delay;

        const isRateLimit = lastError.message.includes("exhausted your capacity");
        if (isRateLimit) {
          console.warn(`Rate limited, retry ${attempt + 1}/${maxRetries} in ${delay}ms...`);
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export async function runGeminiWithMetadata(prompt: string, options: LLMRunOptions = {}): Promise<GeminiRunResult> {
  const model = options.model || DEFAULT_GEMINI_MODEL;
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  const startMs = Date.now();

  const retryResult = await withRetryTracked(async () => {
    return withIsolatedGemini(async (homeDir) => {
      const rawOutput = await safeExec("gemini", ["--model", model, "--output-format", "json"], prompt, timeout, {
        HOME: homeDir,
      });
      return rawOutput;
    });
  });

  const endMs = Date.now();
  const parsed = parseGeminiJsonFull(retryResult.result, model);

  return {
    response: parsed.response,
    tokens: parsed.tokens,
    timing: {
      startMs,
      endMs,
      durationMs: endMs - startMs,
    },
    retry: {
      result: parsed.response,
      attempts: retryResult.attempts,
      totalRetryDelayMs: retryResult.totalRetryDelayMs,
      failedAttempts: retryResult.failedAttempts,
    },
  };
}
