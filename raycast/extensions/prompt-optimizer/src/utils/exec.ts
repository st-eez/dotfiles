import execa from "execa";
import { homedir } from "os";

/**
 * Safely executes a shell command and returns the output.
 * @param command The command to execute.
 * @param args The arguments to pass to the command.
 * @returns A promise that resolves to the stdout of the command.
 */
const DEFAULT_TIMEOUT_MS = 180_000;

export async function safeExec(
  command: string,
  args: string[],
  input?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  console.log(`Executing: ${command} ${args.join(" ")}`);
  const basePath = process.env.PATH ?? "";
  const bunPath = `${homedir()}/.bun/bin`;
  // Prefer Bun-installed binaries, then Homebrew, then existing PATH
  let normalizedPath = basePath;
  if (!basePath.includes(bunPath)) {
    normalizedPath = `${bunPath}:${normalizedPath}`;
  }
  if (!basePath.includes("/opt/homebrew/bin")) {
    normalizedPath = `/opt/homebrew/bin:${normalizedPath}`;
  }
  try {
    const { stdout } = await execa(command, args, {
      env: {
        ...process.env,
        PATH: normalizedPath, // make sure Homebrew bin is available for Raycast runtime
      },
      shell: false, // avoid shell splitting newlines from multi-line prompts
      stderr: "pipe",
      input,
      timeout: timeoutMs,
      killSignal: "SIGTERM",
    });
    console.log(`Execution success: ${command}`);
    return stdout;
  } catch (error: unknown) {
    console.error(`Execution failed: ${command}`, error);

    if (error instanceof Error) {
      const execError = error as Error & { code?: string; timedOut?: boolean; stderr?: string };

      if (execError.code === "ENOENT") {
        throw new Error(`Command '${command}' not found. Install it or add it to PATH (${normalizedPath}).`);
      }
      if (execError.timedOut) {
        throw new Error(`Command '${command}' timed out after ${(timeoutMs / 1000).toFixed(0)}s.`);
      }
      if (execError.stderr) {
        throw new Error(execError.stderr);
      }
      throw error;
    }
    throw new Error(String(error));
  }
}

export function getTimeout(mode: string, isOrchestrated: boolean): number {
  const base = mode === "detailed" ? 300_000 : 180_000;
  // 1.5x multiplier for orchestrated runs to account for multiple parallel calls + synthesis
  return isOrchestrated ? base * 1.5 : base;
}

/**
 * Gemini CLI JSON response structure
 */
export interface GeminiJsonResponse {
  response: string;
  stats?: {
    tokens?: Record<string, number>;
    tool_calls?: unknown[];
    file_modifications?: unknown[];
  };
  error?: string;
}

/**
 * Parse Gemini CLI JSON output and extract the response text.
 * Falls back to raw output if JSON parsing fails.
 */
export function parseGeminiJson(output: string): string {
  try {
    const parsed: GeminiJsonResponse = JSON.parse(output);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    return parsed.response ?? output;
  } catch {
    // Fallback: return raw output if not valid JSON
    console.warn("Failed to parse Gemini JSON response, using raw output");
    return output;
  }
}
