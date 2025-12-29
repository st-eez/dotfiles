/**
 * Persistent Isolation Manager
 *
 * Creates isolated CLI environments ONCE and reuses them across all calls.
 * This eliminates the per-call overhead of mkdir/symlink/cleanup (50-100ms → ~0ms).
 *
 * Design:
 * - Lazy initialization: directories created on first use
 * - Singleton pattern: same environment reused for all calls
 * - No auto-cleanup: directories persist for extension lifetime
 * - Manual cleanup: available for testing via cleanup()
 *
 * Why isolation is needed:
 * - Prevents loading user's global AGENTS.md/GEMINI.md instructions
 * - Disables MCP servers and other tools that could interfere
 * - Preserves auth credentials via symlinks
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Stable ID based on process start time - survives within same process, new on restart
const INSTANCE_ID = `${process.pid}-${Date.now().toString(36).slice(-4)}`;

let cleanupRegistered = false;
function registerCleanupHandlers(): void {
  if (cleanupRegistered) return;
  cleanupRegistered = true;

  const cleanup = () => {
    cleanupIsolation();
  };

  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });
}

interface GeminiIsolation {
  homeDir: string;
  env: { HOME: string };
}

interface CodexIsolation {
  homeDir: string;
  env: { CODEX_HOME: string };
}

interface OpencodeIsolation {
  cacheDir: string;
  configDir: string;
  dataDir: string;
  env: {
    XDG_CACHE_HOME: string;
    XDG_CONFIG_HOME: string;
    XDG_DATA_HOME: string;
  };
}

let geminiIsolation: GeminiIsolation | null = null;
let codexIsolation: CodexIsolation | null = null;
let opencodeIsolation: OpencodeIsolation | null = null;

/**
 * Get or create isolated Gemini environment.
 * Returns environment variables to pass to safeExec.
 */
export function getGeminiIsolation(): GeminiIsolation {
  if (geminiIsolation) return geminiIsolation;

  registerCleanupHandlers();
  const tmpDir = path.join(os.tmpdir(), `prompt-opt-gemini-${INSTANCE_ID}`);
  const geminiDir = path.join(tmpDir, ".gemini");
  fs.mkdirSync(geminiDir, { recursive: true });

  const homeGemini = path.join(os.homedir(), ".gemini");

  // 1. Symlink Auth Credentials
  const credsPath = path.join(homeGemini, "oauth_creds.json");
  const credsLink = path.join(geminiDir, "oauth_creds.json");
  if (fs.existsSync(credsPath) && !fs.existsSync(credsLink)) {
    fs.symlinkSync(credsPath, credsLink);
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

  geminiIsolation = {
    homeDir: tmpDir,
    env: { HOME: tmpDir },
  };

  return geminiIsolation;
}

/**
 * Get or create isolated Codex environment.
 * Returns environment variables to pass to safeExec.
 */
export function getCodexIsolation(): CodexIsolation {
  if (codexIsolation) return codexIsolation;

  registerCleanupHandlers();
  const tmpDir = path.join(os.tmpdir(), `prompt-opt-codex-${INSTANCE_ID}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const homeCodex = path.join(os.homedir(), ".codex");
  const authPath = path.join(homeCodex, "auth.json");
  const authLink = path.join(tmpDir, "auth.json");

  if (fs.existsSync(authPath) && !fs.existsSync(authLink)) {
    fs.symlinkSync(authPath, authLink);
  }

  // Create minimal AGENTS.md to prevent loading global instructions
  fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "# Isolated Prompt Optimizer");

  codexIsolation = {
    homeDir: tmpDir,
    env: { CODEX_HOME: tmpDir },
  };

  return codexIsolation;
}

/**
 * Get or create isolated OpenCode environment.
 * Returns environment variables to pass to safeExec.
 */
export function getOpencodeIsolation(): OpencodeIsolation {
  if (opencodeIsolation) return opencodeIsolation;

  registerCleanupHandlers();
  const cacheDir = path.join(os.tmpdir(), `prompt-opt-oc-cache-${INSTANCE_ID}`);
  const configDir = path.join(os.tmpdir(), `prompt-opt-oc-config-${INSTANCE_ID}`);
  const dataDir = path.join(os.tmpdir(), `prompt-opt-oc-data-${INSTANCE_ID}`);

  fs.mkdirSync(path.join(cacheDir, "opencode"), { recursive: true });
  fs.mkdirSync(path.join(configDir, "opencode"), { recursive: true });
  fs.mkdirSync(path.join(dataDir, "opencode"), { recursive: true });

  const homeConfig = path.join(os.homedir(), ".config", "opencode");
  const homeData = path.join(os.homedir(), ".local", "share", "opencode");

  // Symlink config files
  const configFiles = ["opencode.json", "oh-my-opencode.json", "antigravity-accounts.json"];
  for (const file of configFiles) {
    const src = path.join(homeConfig, file);
    const dest = path.join(configDir, "opencode", file);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.symlinkSync(src, dest);
    }
  }

  // Symlink auth
  const authPath = path.join(homeData, "auth.json");
  const authDest = path.join(dataDir, "opencode", "auth.json");
  if (fs.existsSync(authPath) && !fs.existsSync(authDest)) {
    fs.symlinkSync(authPath, authDest);
  }

  opencodeIsolation = {
    cacheDir,
    configDir,
    dataDir,
    env: {
      XDG_CACHE_HOME: cacheDir,
      XDG_CONFIG_HOME: configDir,
      XDG_DATA_HOME: dataDir,
    },
  };

  return opencodeIsolation;
}

/**
 * Cleanup all isolation directories.
 * Call this for testing or explicit cleanup needs.
 * In normal operation, directories persist for extension lifetime.
 */
export function cleanupIsolation(): void {
  if (geminiIsolation) {
    try {
      fs.rmSync(geminiIsolation.homeDir, { recursive: true, force: true });
    } catch (e) {
      console.error("Failed to cleanup Gemini isolation", e);
    }
    geminiIsolation = null;
  }

  if (codexIsolation) {
    try {
      fs.rmSync(codexIsolation.homeDir, { recursive: true, force: true });
    } catch (e) {
      console.error("Failed to cleanup Codex isolation", e);
    }
    codexIsolation = null;
  }

  if (opencodeIsolation) {
    try {
      fs.rmSync(opencodeIsolation.cacheDir, { recursive: true, force: true });
      fs.rmSync(opencodeIsolation.configDir, { recursive: true, force: true });
      fs.rmSync(opencodeIsolation.dataDir, { recursive: true, force: true });
    } catch (e) {
      console.error("Failed to cleanup OpenCode isolation", e);
    }
    opencodeIsolation = null;
  }
}

export function getIsolationStatus(): {
  gemini: boolean;
  codex: boolean;
  opencode: boolean;
  instanceId: string;
} {
  return {
    gemini: geminiIsolation !== null,
    codex: codexIsolation !== null,
    opencode: opencodeIsolation !== null,
    instanceId: INSTANCE_ID,
  };
}
