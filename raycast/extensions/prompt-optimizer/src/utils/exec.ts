import execa from "execa";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { TokenData } from "./types";

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
  const basePath = process.env.PATH ?? "";
  const bunPath = `${homedir()}/.bun/bin`;
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
        ...env,
        PATH: normalizedPath,
      },
      shell: false,
      stderr: "pipe",
      input,
      timeout: timeoutMs,
      killSignal: "SIGTERM",
    });
    return stdout;
  } catch (error: unknown) {
    if (error instanceof Error) {
      const execError = error as Error & { code?: string; timedOut?: boolean; stderr?: string };

      if (execError.code === "ENOENT") {
        throw new Error(`Command '${command}' not found. Install it or add it to PATH (${normalizedPath}).`);
      }
      if (execError.timedOut) {
        throw new Error(`${command} timed out after ${(timeoutMs / 1000).toFixed(0)}s`);
      }
      if (execError.stderr) {
        throw new Error(execError.stderr);
      }
      throw error;
    }
    throw new Error(String(error));
  }
}

export function getTimeout(isOrchestrated: boolean): number {
  const base = 180_000;
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

export interface GeminiJsonResponseFull {
  response: string;
  tokens: TokenData | null;
  apiLatencyMs: number | null;
}

export function parseGeminiJsonFull(output: string, model: string): GeminiJsonResponseFull {
  try {
    const parsed = JSON.parse(output) as {
      response?: string;
      stats?: {
        models?: Record<
          string,
          {
            api?: { totalLatencyMs?: number };
            tokens?: {
              input?: number;
              candidates?: number;
              total?: number;
              cached?: number;
              thoughts?: number;
            };
          }
        >;
      };
      error?: string;
    };

    if (parsed.error) {
      throw new Error(parsed.error);
    }

    const modelStats = parsed.stats?.models?.[model];
    const tokens: TokenData | null = modelStats?.tokens
      ? {
          input: modelStats.tokens.input ?? 0,
          output: modelStats.tokens.candidates ?? 0,
          total: modelStats.tokens.total ?? 0,
          cached: modelStats.tokens.cached ?? 0,
          thoughts: modelStats.tokens.thoughts ?? 0,
          latencyMs: modelStats.api?.totalLatencyMs ?? 0,
        }
      : null;

    return {
      response: parsed.response ?? output,
      tokens,
      apiLatencyMs: modelStats?.api?.totalLatencyMs ?? null,
    };
  } catch {
    console.warn("Failed to parse Gemini JSON with stats, using raw output");
    return { response: output, tokens: null, apiLatencyMs: null };
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

    // 2. Create isolated settings with tools disabled
    const settingsPath = path.join(homeGemini, "settings.json");
    let authSettings = {};
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
        authSettings = settings.security?.auth || {};
      } catch (e) {
        console.warn("Failed to parse Gemini settings", e);
      }
    }
    const isolatedSettings = {
      security: { auth: authSettings },
      coreTools: [],
      allowMCPServers: [],
    };
    fs.writeFileSync(path.join(geminiDir, "settings.json"), JSON.stringify(isolatedSettings, null, 2));

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
/**
 * Parse OpenCode CLI JSON streaming output.
 * Extracts text from "text" events in NDJSON stream.
 */
export function parseOpencodeJson(output: string): string {
  const lines = output.trim().split("\n");
  const textParts: string[] = [];

  for (const line of lines) {
    try {
      const event = JSON.parse(line) as {
        type?: string;
        part?: { type?: string; text?: string };
      };
      if (event.type === "text" && event.part?.text) {
        textParts.push(event.part.text);
      }
    } catch {
      // Skip non-JSON lines
    }
  }

  return textParts.join("") || output;
}

export interface OpencodeIsolatedEnv {
  XDG_CACHE_HOME: string;
  XDG_CONFIG_HOME: string;
  XDG_DATA_HOME: string;
}

export async function withIsolatedOpencode<T>(callback: (env: OpencodeIsolatedEnv) => Promise<T>): Promise<T> {
  const id = crypto.randomUUID();
  const cacheDir = path.join(os.tmpdir(), `opencode-cache-${id}`);
  const configDir = path.join(os.tmpdir(), `opencode-config-${id}`);
  const dataDir = path.join(os.tmpdir(), `opencode-data-${id}`);

  fs.mkdirSync(path.join(cacheDir, "opencode"), { recursive: true });
  fs.mkdirSync(path.join(configDir, "opencode"), { recursive: true });
  fs.mkdirSync(path.join(dataDir, "opencode"), { recursive: true });

  try {
    const homeConfig = path.join(os.homedir(), ".config", "opencode");
    const homeData = path.join(os.homedir(), ".local", "share", "opencode");

    const configFiles = ["opencode.json", "oh-my-opencode.json", "antigravity-accounts.json"];
    for (const file of configFiles) {
      const src = path.join(homeConfig, file);
      if (fs.existsSync(src)) {
        fs.symlinkSync(src, path.join(configDir, "opencode", file));
      }
    }

    const authPath = path.join(homeData, "auth.json");
    if (fs.existsSync(authPath)) {
      fs.symlinkSync(authPath, path.join(dataDir, "opencode", "auth.json"));
    }

    return await callback({
      XDG_CACHE_HOME: cacheDir,
      XDG_CONFIG_HOME: configDir,
      XDG_DATA_HOME: dataDir,
    });
  } finally {
    try {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      fs.rmSync(configDir, { recursive: true, force: true });
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch (e) {
      console.error("Failed to cleanup temp opencode dirs", e);
    }
  }
}

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
