import color from "picocolors";
import { CacheManager } from "../../utils/cache";
import { TestBenchArgs, formatBytes, formatRelativeTime, formatTable } from "../types";

export function runCacheStatus(): void {
  const cache = new CacheManager();
  const manifest = cache.getStatus();

  console.log(`\n${color.cyan("Cache Status")} (.prompt-cache/)\n`);
  console.log(`Total entries: ${manifest.totalEntries}`);
  console.log(`Disk usage: ${formatBytes(manifest.diskUsageBytes)}\n`);

  if (Object.keys(manifest.byStrategy).length > 0) {
    console.log("By Strategy:");
    const rows = Object.entries(manifest.byStrategy).map(([strategy, data]) => [
      strategy,
      String(data.count),
      data.engines.join(", "),
      formatRelativeTime(data.lastUpdated),
    ]);
    console.log(formatTable(["Strategy", "Count", "Engines", "Last Updated"], rows));
  }

  if (manifest.staleEntries.length > 0) {
    console.log(`\n${color.yellow("Stale entries:")} ${manifest.staleEntries.length}`);
    for (const entry of manifest.staleEntries.slice(0, 5)) {
      console.log(`  - ${entry}`);
    }
    if (manifest.staleEntries.length > 5) {
      console.log(`  ... and ${manifest.staleEntries.length - 5} more`);
    }
  }

  console.log("");
}

export function runCacheClear(args: TestBenchArgs): void {
  const cache = new CacheManager();
  const filterDesc = args.strategy ? `strategy=${args.strategy}` : args.all ? "all" : "all";

  console.log(`\n${color.cyan("Clearing cache")}... (filter: ${filterDesc})\n`);

  const result = cache.clear(args.strategy ? { strategy: args.strategy } : undefined);

  console.log(`Cleared: ${result.cleared} entries (${formatBytes(result.bytesFreed)} freed)`);
  console.log(`Remaining: ${result.total - result.cleared} entries\n`);
}
