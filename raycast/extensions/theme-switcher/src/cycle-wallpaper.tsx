import { showHUD } from "@raycast/api";
import { execFile } from "child_process";
import { promisify } from "util";
import { homedir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);

const WALLPAPER_SET_PATH = join(homedir(), ".local", "bin", "wallpaper-set");

function parseWallpaperIndex(output: string): { current: number; total: number } | null {
  const match = output.match(/\((\d+)\s*\/\s*(\d+)\)/);
  if (!match) return null;

  const current = Number(match[1]);
  const total = Number(match[2]);

  if (!Number.isFinite(current) || !Number.isFinite(total) || current <= 0 || total <= 0) return null;
  return { current, total };
}

export default async function Command() {
  try {
    const { stdout } = await execFileAsync(WALLPAPER_SET_PATH, ["--next"], { encoding: "utf-8" });

    const output = typeof stdout === "string" ? stdout.trim() : stdout.toString("utf-8").trim();
    const index = parseWallpaperIndex(output);

    if (index) {
      await showHUD(`Wallpaper ${index.current}/${index.total}`);
      return;
    }

    await showHUD(output ? `Wallpaper ${output}` : "Wallpaper changed");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await showHUD(`Failed to set wallpaper: ${message}`);
  }
}
