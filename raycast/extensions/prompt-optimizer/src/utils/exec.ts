import execa from "execa";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

const { homedir } = os;

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
  env?: NodeJS.ProcessEnv,
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
        ...env, // Overlay custom env vars
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

/**
 * Creates a temporary, isolated HOME environment for Gemini.
 * 1. Creates temp dir structure matching ~/.gemini
 * 2. Symlinks ~/.gemini/oauth_creds.json to preserve authentication
 * 3. Copies ONLY the security.auth section of ~/.gemini/settings.json
 * 4. Creates empty AGENTS.md and GEMINI.md to prevent loading global instructions
 */
export async function withIsolatedGemini<T>(callback: (homeDir: string) => Promise<T>): Promise<T> {
  const tmpDir = path.join(os.tmpdir(), `gemini-${crypto.randomUUID()}`);
  const geminiDir = path.join(tmpDir, ".gemini");
  fs.mkdirSync(geminiDir, { recursive: true });

  try {
    const homeGemini = path.join(os.homedir(), ".gemini");

    // 1. Symlink Auth Credentials
    const credsPath = path.join(homeGemini, "oauth_creds.json");
    if (fs.existsSync(credsPath)) {
      fs.symlinkSync(credsPath, path.join(geminiDir, "oauth_creds.json"));
    }

    // 2. Extract and Copy Auth Settings ONLY
    const settingsPath = path.join(homeGemini, "settings.json");
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
        const isolatedSettings = {
          security: {
            auth: settings.security?.auth || {},
          },
        };
        fs.writeFileSync(path.join(geminiDir, "settings.json"), JSON.stringify(isolatedSettings, null, 2));
      } catch (e) {
        console.warn("Failed to parse/copy Gemini settings for isolation", e);
      }
    }

    // 3. Create empty override files to silence global instructions
    fs.writeFileSync(path.join(geminiDir, "AGENTS.md"), "");
    fs.writeFileSync(path.join(geminiDir, "GEMINI.md"), "");

    return await callback(tmpDir);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      console.error("Failed to cleanup temp gemini dir", e);
    }
  }
}

/**
 * Creates a temporary, isolated CODEX_HOME environment.
 * 1. Symlinks ~/.codex/auth.json to preserve authentication.
 * 2. Creates an empty AGENTS.md to prevent loading global instructions.
 * 3. Does NOT copy config.toml, preventing MCP server startup.
 */
export async function withIsolatedCodex<T>(callback: (homeDir: string) => Promise<T>): Promise<T> {
  const tmpDir = path.join(os.tmpdir(), `codex-${crypto.randomUUID()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const homeCodex = path.join(os.homedir(), ".codex");
    const authPath = path.join(homeCodex, "auth.json");

    if (fs.existsSync(authPath)) {
      fs.symlinkSync(authPath, path.join(tmpDir, "auth.json"));
    }

    // Create minimal AGENTS.md to prevent loading global instructions
    fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "# Isolated Prompt Optimizer Test");

    return await callback(tmpDir);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      console.error("Failed to cleanup temp codex dir", e);
    }
  }
}
