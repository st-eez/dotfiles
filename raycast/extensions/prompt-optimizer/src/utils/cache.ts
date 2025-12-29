/**
 * Disk-based Cache Manager for Prompt Optimizations
 *
 * Provides persistent caching of LLM optimization results to eliminate
 * redundant API calls when running multi-judge comparisons.
 *
 * Cache structure:
 * .prompt-cache/
 * +-- manifest.json
 * +-- optimizations/
 *     +-- {strategy}_{engine}_{model}/
 *         +-- {test_case_id}.json
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { OptimizationMetadata } from "./types";

/**
 * Cached optimization entry stored on disk.
 * Contains the optimized prompt output and metadata for cache invalidation.
 */
export interface CachedOptimizationEntry {
  /** Schema version for forward compatibility */
  schemaVersion: "1.0";

  /** Unique test case identifier (e.g., "code-001") */
  testCaseId: string;

  /** Strategy identifier (e.g., "v1-baseline") */
  strategyId: string;

  /** Engine used for optimization */
  engine: "gemini" | "codex";

  /** Model used (e.g., "gemini-3-flash-preview") */
  model: string;

  /** SHA-256 hash of the input prompt for invalidation detection */
  promptHash: string;

  /** The optimized prompt output from LLM */
  optimizedOutput: string;

  /** Optimization metadata (timing, tokens, retries) */
  metadata: OptimizationMetadata;

  /** ISO timestamp of when this was cached */
  cachedAt: string;
}

/**
 * Manifest file for human-readable cache status.
 * Located at .prompt-cache/manifest.json
 */
export interface CacheManifest {
  /** Last updated timestamp */
  lastUpdated: string;

  /** Total entries in cache */
  totalEntries: number;

  /** Entries grouped by strategy */
  byStrategy: Record<
    string,
    {
      count: number;
      engines: string[];
      lastUpdated: string;
    }
  >;

  /** List of stale entry paths (prompt hash mismatch detected) */
  staleEntries: string[];

  /** Approximate disk usage in bytes */
  diskUsageBytes: number;
}

/**
 * Options for cache operations
 */
export interface CacheOptions {
  /** Force regeneration even if cache exists */
  force?: boolean;

  /** Strategy ID to filter operations */
  strategy?: string;

  /** Engine to filter operations */
  engine?: "gemini" | "codex";

  /** Model to filter operations */
  model?: string;
}

/**
 * Result of a cache clear operation
 */
export interface CacheClearResult {
  /** Number of entries cleared */
  cleared: number;

  /** Total entries before clearing */
  total: number;

  /** Bytes freed */
  bytesFreed: number;
}

/**
 * Represents a cached optimization run (strategy + engine + model combination)
 */
export interface CachedOptimizationRun {
  /** Strategy identifier (e.g., "v1-baseline") */
  strategyId: string;

  /** Engine used (e.g., "gemini") */
  engine: "gemini" | "codex";

  /** Model used (e.g., "gemini-3-flash-preview") */
  model: string;

  /** Number of cached test cases */
  testCaseCount: number;

  /** List of cached test case IDs */
  testCaseIds: string[];

  /** Most recent cache timestamp */
  lastUpdated: string;

  /** Directory name for this run */
  dirName: string;
}

/**
 * Manages disk-based optimization cache.
 *
 * @example
 * const cache = new CacheManager();
 * const entry = cache.get("v1-baseline", "gemini", "gemini-3-flash-preview", "code-001", currentHash);
 * if (!entry) {
 *   // Run optimization
 *   cache.set(newEntry);
 * }
 */
export class CacheManager {
  private readonly cacheDir: string;
  private readonly optimizationsDir: string;
  private readonly manifestPath: string;

  /**
   * @param baseDir - Base directory for cache (defaults to .prompt-cache/)
   */
  constructor(baseDir?: string) {
    this.cacheDir = baseDir || path.join(process.cwd(), ".prompt-cache");
    this.optimizationsDir = path.join(this.cacheDir, "optimizations");
    this.manifestPath = path.join(this.cacheDir, "manifest.json");
  }

  /**
   * Generate cache key from optimization parameters.
   * Format: {strategy}_{engine}_{model}/{test_case_id}
   *
   * @returns Relative path for cache file (without .json extension)
   */
  getCacheKey(strategyId: string, engine: string, model: string, testCaseId: string): string {
    const sanitizedModel = model.replace(/\//g, "-");
    const dirName = `${strategyId}_${engine}_${sanitizedModel}`;
    return path.join(dirName, testCaseId);
  }

  /**
   * Compute SHA-256 hash of prompt content for invalidation detection.
   */
  computePromptHash(prompt: string): string {
    return crypto.createHash("sha256").update(prompt).digest("hex");
  }

  /**
   * Check if entry is stale (prompt hash mismatch).
   * Stale entries indicate the strategy has changed since caching.
   */
  isStale(entry: CachedOptimizationEntry, currentPromptHash: string): boolean {
    return entry.promptHash !== currentPromptHash;
  }

  /**
   * Get cached optimization if valid, or null if missing/stale.
   *
   * @param strategyId - Strategy identifier (e.g., "v1-baseline")
   * @param engine - Engine name (e.g., "gemini")
   * @param model - Model name (e.g., "gemini-3-flash-preview")
   * @param testCaseId - Test case ID (e.g., "code-001")
   * @param currentPromptHash - Hash of current prompt for staleness check
   * @returns Cached entry if valid and fresh, null if missing or stale
   */
  get(
    strategyId: string,
    engine: string,
    model: string,
    testCaseId: string,
    currentPromptHash: string,
  ): CachedOptimizationEntry | null {
    const cacheKey = this.getCacheKey(strategyId, engine, model, testCaseId);
    const filePath = path.join(this.optimizationsDir, `${cacheKey}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const entry: CachedOptimizationEntry = JSON.parse(content);

      if (this.isStale(entry, currentPromptHash)) {
        return null;
      }

      return entry;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to read cache entry ${filePath}: ${message}`);
      return null;
    }
  }

  /**
   * Store optimization result in cache.
   * Creates directory structure if needed.
   */
  set(entry: CachedOptimizationEntry): void {
    this.ensureDirectories();

    const cacheKey = this.getCacheKey(entry.strategyId, entry.engine, entry.model, entry.testCaseId);
    const filePath = path.join(this.optimizationsDir, `${cacheKey}.json`);
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf-8");
    this.updateManifest();
  }

  /**
   * Get cache status summary.
   * Reads manifest or rebuilds if missing.
   */
  getStatus(): CacheManifest {
    if (fs.existsSync(this.manifestPath)) {
      try {
        const content = fs.readFileSync(this.manifestPath, "utf-8");
        return JSON.parse(content);
      } catch (_) {
        void _;
      }
    }

    this.updateManifest();

    if (fs.existsSync(this.manifestPath)) {
      const content = fs.readFileSync(this.manifestPath, "utf-8");
      return JSON.parse(content);
    }

    return {
      lastUpdated: new Date().toISOString(),
      totalEntries: 0,
      byStrategy: {},
      staleEntries: [],
      diskUsageBytes: 0,
    };
  }

  /**
   * Clear cache entries matching filter.
   *
   * @param options - Filter options (strategy, engine, model)
   * @returns Clear result with count and bytes freed
   */
  clear(options?: CacheOptions): CacheClearResult {
    if (!fs.existsSync(this.optimizationsDir)) {
      return { cleared: 0, total: 0, bytesFreed: 0 };
    }

    let cleared = 0;
    let bytesFreed = 0;
    let total = 0;

    const strategyDirs = fs.readdirSync(this.optimizationsDir);

    for (const strategyDir of strategyDirs) {
      const strategyDirPath = path.join(this.optimizationsDir, strategyDir);
      if (!fs.statSync(strategyDirPath).isDirectory()) continue;

      const parts = strategyDir.split("_");
      if (parts.length < 3) continue;

      const strategyId = parts[0];
      const engine = parts[1];
      const model = parts.slice(2).join("_");

      if (options?.strategy && strategyId !== options.strategy) continue;
      if (options?.engine && engine !== options.engine) continue;
      if (options?.model && model !== options.model) continue;

      const files = fs.readdirSync(strategyDirPath).filter((f) => f.endsWith(".json"));
      total += files.length;

      for (const file of files) {
        const filePath = path.join(strategyDirPath, file);
        const stats = fs.statSync(filePath);
        bytesFreed += stats.size;
        fs.unlinkSync(filePath);
        cleared++;
      }

      const remainingFiles = fs.readdirSync(strategyDirPath);
      if (remainingFiles.length === 0) {
        fs.rmdirSync(strategyDirPath);
      }
    }

    this.updateManifest();
    return { cleared, total, bytesFreed };
  }

  /**
   * List all stale entries (entries where current prompt hash doesn't match).
   * Requires passing a map of testCaseId -> currentPromptHash.
   */
  listStaleEntries(strategyId: string, engine: string, model: string, hashMap: Map<string, string>): string[] {
    const staleEntries: string[] = [];
    const cacheKeyPrefix = `${strategyId}_${engine}_${model.replace(/\//g, "-")}`;
    const dirPath = path.join(this.optimizationsDir, cacheKeyPrefix);

    if (!fs.existsSync(dirPath)) {
      return staleEntries;
    }

    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      const testCaseId = file.replace(".json", "");
      const currentHash = hashMap.get(testCaseId);

      if (!currentHash) continue;

      const filePath = path.join(dirPath, file);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const entry: CachedOptimizationEntry = JSON.parse(content);

        if (this.isStale(entry, currentHash)) {
          staleEntries.push(`${cacheKeyPrefix}/${testCaseId}`);
        }
      } catch (_) {
        void _;
      }
    }

    return staleEntries;
  }

  listCachedOptimizations(): CachedOptimizationRun[] {
    if (!fs.existsSync(this.optimizationsDir)) {
      return [];
    }

    const runs: CachedOptimizationRun[] = [];
    const strategyDirs = fs.readdirSync(this.optimizationsDir);

    for (const dirName of strategyDirs) {
      const dirPath = path.join(this.optimizationsDir, dirName);
      if (!fs.statSync(dirPath).isDirectory()) continue;

      const parts = dirName.split("_");
      if (parts.length < 3) continue;

      const strategyId = parts[0];
      const engine = parts[1] as "gemini" | "codex";
      const model = parts.slice(2).join("_");

      const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".json"));
      if (files.length === 0) continue;

      const testCaseIds = files.map((f) => f.replace(".json", ""));

      let latestTime = "";
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const mtime = fs.statSync(filePath).mtime.toISOString();
        if (mtime > latestTime) latestTime = mtime;
      }

      runs.push({
        strategyId,
        engine,
        model,
        testCaseCount: files.length,
        testCaseIds,
        lastUpdated: latestTime,
        dirName,
      });
    }

    return runs.sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    if (!fs.existsSync(this.optimizationsDir)) {
      fs.mkdirSync(this.optimizationsDir, { recursive: true });
    }
  }

  /**
   * Rebuild and update manifest file.
   * Called automatically after set/clear operations.
   */
  private updateManifest(): void {
    this.ensureDirectories();

    const manifest: CacheManifest = {
      lastUpdated: new Date().toISOString(),
      totalEntries: 0,
      byStrategy: {},
      staleEntries: [],
      diskUsageBytes: 0,
    };

    if (!fs.existsSync(this.optimizationsDir)) {
      fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
      return;
    }

    const strategyDirs = fs.readdirSync(this.optimizationsDir);

    for (const strategyDir of strategyDirs) {
      const strategyDirPath = path.join(this.optimizationsDir, strategyDir);
      if (!fs.statSync(strategyDirPath).isDirectory()) continue;

      const parts = strategyDir.split("_");
      if (parts.length < 3) continue;

      const strategyId = parts[0];
      const engine = parts[1];

      const files = fs.readdirSync(strategyDirPath).filter((f) => f.endsWith(".json"));
      let latestTime = "";
      let dirSize = 0;

      for (const file of files) {
        const filePath = path.join(strategyDirPath, file);
        const stats = fs.statSync(filePath);
        dirSize += stats.size;

        const mtime = stats.mtime.toISOString();
        if (mtime > latestTime) {
          latestTime = mtime;
        }
      }

      manifest.totalEntries += files.length;
      manifest.diskUsageBytes += dirSize;

      if (!manifest.byStrategy[strategyId]) {
        manifest.byStrategy[strategyId] = {
          count: 0,
          engines: [],
          lastUpdated: "",
        };
      }

      manifest.byStrategy[strategyId].count += files.length;
      if (!manifest.byStrategy[strategyId].engines.includes(engine)) {
        manifest.byStrategy[strategyId].engines.push(engine);
      }
      if (latestTime > manifest.byStrategy[strategyId].lastUpdated) {
        manifest.byStrategy[strategyId].lastUpdated = latestTime;
      }
    }

    fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  }
}
