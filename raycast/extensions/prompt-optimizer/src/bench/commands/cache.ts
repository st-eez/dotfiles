import { CacheManager } from "../../utils/cache";
import { log, subheader, keyValue } from "../../utils/cli-output";
import { printSimpleTable } from "../../utils/cli-table";
import { TestBenchArgs, formatBytes, formatRelativeTime } from "../types";

export function runCacheStatus(): void {
  const cache = new CacheManager();
  const manifest = cache.getStatus();

  subheader("Cache Status (.prompt-cache/)");
  keyValue("Total entries", manifest.totalEntries);
  keyValue("Disk usage", formatBytes(manifest.diskUsageBytes));

  if (Object.keys(manifest.byStrategy).length > 0) {
    log.blank();
    log.plain("By Strategy:");
    const rows = Object.entries(manifest.byStrategy).map(([strategy, data]) => [
      strategy,
      String(data.count),
      data.engines.join(", "),
      formatRelativeTime(data.lastUpdated),
    ]);
    printSimpleTable(["Strategy", "Count", "Engines", "Last Updated"], rows);
  }

  if (manifest.staleEntries.length > 0) {
    log.blank();
    log.warn(`Stale entries: ${manifest.staleEntries.length}`);
    for (const entry of manifest.staleEntries.slice(0, 5)) {
      log.plain(`  - ${entry}`);
    }
    if (manifest.staleEntries.length > 5) {
      log.plain(`  ... and ${manifest.staleEntries.length - 5} more`);
    }
  }

  log.blank();
}

export function runCacheClear(args: TestBenchArgs): void {
  const cache = new CacheManager();
  const filterDesc = args.strategy ? `strategy=${args.strategy}` : args.all ? "all" : "all";

  subheader(`Clearing cache (filter: ${filterDesc})`);

  const result = cache.clear(args.strategy ? { strategy: args.strategy } : undefined);

  log.success(`Cleared: ${result.cleared} entries (${formatBytes(result.bytesFreed)} freed)`);
  keyValue("Remaining", `${result.total - result.cleared} entries`);
  log.blank();
}
