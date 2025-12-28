import { safeExec, parseGeminiJson, withIsolatedGemini, withIsolatedCodex } from "../../utils/exec";

export interface LLMRunOptions {
  timeout?: number;
  model?: string;
}

const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
const DEFAULT_CODEX_MODEL = "gpt-5.2-codex";
const DEFAULT_TIMEOUT = 180_000;

export async function runGemini(prompt: string, options: LLMRunOptions = {}): Promise<string> {
  const model = options.model || DEFAULT_GEMINI_MODEL;
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  return withIsolatedGemini(async (homeDir) => {
    const rawOutput = await safeExec(
      "gemini",
      ["--allowed-mcp-server-names", "none", "-e", "none", "--model", model, "--output-format", "json"],
      prompt,
      timeout,
      { HOME: homeDir },
    );
    return parseGeminiJson(rawOutput);
  });
}

export async function runCodex(prompt: string, options: LLMRunOptions = {}): Promise<string> {
  const model = options.model || DEFAULT_CODEX_MODEL;
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  return withIsolatedCodex(async (homeDir) => {
    return safeExec(
      "codex",
      ["exec", "-m", model, "--config", 'model_reasoning_effort="high"', "--skip-git-repo-check"],
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

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 1,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
