#!/usr/bin/env npx ts-node
/**
 * CLI Benchmark: Native CLIs vs OpenCode
 *
 * Compares execution time of isolated native CLIs vs OpenCode with isolation.
 * Both use their respective isolation wrappers for fair comparison.
 */

import "./setup-test";
import {
  safeExec,
  withIsolatedGemini,
  withIsolatedCodex,
  withIsolatedOpencode,
  parseGeminiJson,
  parseOpencodeJson,
} from "./utils/exec";

const TEST_PROMPT = "What is 2+2? Reply with ONLY the number, nothing else.";
const RUNS_PER_TEST = 3;
const TIMEOUT_MS = 60_000;

interface BenchmarkResult {
  name: string;
  runs: number[];
  avgMs: number;
  minMs: number;
  maxMs: number;
}

async function runNativeGemini(): Promise<number> {
  const start = Date.now();
  await withIsolatedGemini(async (homeDir) => {
    const output = await safeExec(
      "gemini",
      ["--model", "gemini-3-flash-preview", "--output-format", "json"],
      TEST_PROMPT,
      TIMEOUT_MS,
      { HOME: homeDir },
    );
    return parseGeminiJson(output);
  });
  return Date.now() - start;
}

async function runOpencodeGemini(): Promise<number> {
  const start = Date.now();
  await withIsolatedOpencode(async (env) => {
    const output = await safeExec(
      "opencode",
      ["run", "--model", "google/gemini-3-flash", "--format", "json"],
      TEST_PROMPT,
      TIMEOUT_MS,
      { ...env },
    );
    return parseOpencodeJson(output);
  });
  return Date.now() - start;
}

async function runNativeCodex(): Promise<number> {
  const start = Date.now();
  await withIsolatedCodex(async (homeDir) => {
    return safeExec(
      "codex",
      ["exec", "-m", "gpt-5.2-codex", "--config", 'model_reasoning_effort="medium"', "--skip-git-repo-check"],
      TEST_PROMPT,
      TIMEOUT_MS,
      { CODEX_HOME: homeDir },
    );
  });
  return Date.now() - start;
}

async function runOpencodeOpenAI(): Promise<number> {
  const start = Date.now();
  await withIsolatedOpencode(async (env) => {
    const output = await safeExec(
      "opencode",
      ["run", "--model", "openai/gpt-5.2", "--format", "json"],
      TEST_PROMPT,
      TIMEOUT_MS,
      { ...env },
    );
    return parseOpencodeJson(output);
  });
  return Date.now() - start;
}

async function benchmark(name: string, fn: () => Promise<number>): Promise<BenchmarkResult> {
  const runs: number[] = [];

  for (let i = 0; i < RUNS_PER_TEST; i++) {
    process.stdout.write(`  ${name} run ${i + 1}/${RUNS_PER_TEST}...`);
    try {
      const ms = await fn();
      runs.push(ms);
      console.log(` ${ms}ms`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(` FAILED: ${msg.slice(0, 50)}`);
      runs.push(-1);
    }

    // Small delay between runs
    await new Promise((r) => setTimeout(r, 500));
  }

  const validRuns = runs.filter((r) => r > 0);
  return {
    name,
    runs,
    avgMs: validRuns.length > 0 ? Math.round(validRuns.reduce((a, b) => a + b, 0) / validRuns.length) : -1,
    minMs: validRuns.length > 0 ? Math.min(...validRuns) : -1,
    maxMs: validRuns.length > 0 ? Math.max(...validRuns) : -1,
  };
}

async function main() {
  console.log("═".repeat(60));
  console.log("CLI BENCHMARK: Native vs OpenCode (with isolation)");
  console.log("═".repeat(60));
  console.log(`Prompt: "${TEST_PROMPT}"`);
  console.log(`Runs per test: ${RUNS_PER_TEST}`);
  console.log("");

  const results: BenchmarkResult[] = [];

  // Gemini comparison
  console.log("─".repeat(60));
  console.log("GEMINI COMPARISON");
  console.log("─".repeat(60));

  console.log("\n[Native] withIsolatedGemini + gemini CLI:");
  results.push(await benchmark("Native Gemini", runNativeGemini));

  console.log("\n[OpenCode] withIsolatedOpencode + google/gemini-3-flash:");
  results.push(await benchmark("OpenCode Gemini", runOpencodeGemini));

  // OpenAI/Codex comparison
  console.log("\n" + "─".repeat(60));
  console.log("OPENAI/CODEX COMPARISON");
  console.log("─".repeat(60));

  console.log("\n[Native] withIsolatedCodex + codex CLI:");
  results.push(await benchmark("Native Codex", runNativeCodex));

  console.log("\n[OpenCode] withIsolatedOpencode + openai/gpt-5.2:");
  results.push(await benchmark("OpenCode OpenAI", runOpencodeOpenAI));

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("SUMMARY");
  console.log("═".repeat(60));
  console.log("");
  console.log("| Test             | Avg (ms) | Min (ms) | Max (ms) |");
  console.log("|------------------|----------|----------|----------|");

  for (const r of results) {
    const avg = r.avgMs > 0 ? r.avgMs.toString() : "FAIL";
    const min = r.minMs > 0 ? r.minMs.toString() : "FAIL";
    const max = r.maxMs > 0 ? r.maxMs.toString() : "FAIL";
    console.log(`| ${r.name.padEnd(16)} | ${avg.padStart(8)} | ${min.padStart(8)} | ${max.padStart(8)} |`);
  }

  // Analysis
  console.log("");
  const geminiNative = results.find((r) => r.name === "Native Gemini");
  const geminiOC = results.find((r) => r.name === "OpenCode Gemini");
  const codexNative = results.find((r) => r.name === "Native Codex");
  const openaiOC = results.find((r) => r.name === "OpenCode OpenAI");

  if (geminiNative && geminiOC && geminiNative.avgMs > 0 && geminiOC.avgMs > 0) {
    const diff = geminiOC.avgMs - geminiNative.avgMs;
    const pct = ((diff / geminiNative.avgMs) * 100).toFixed(1);
    const winner = diff < 0 ? "OpenCode" : "Native";
    console.log(`Gemini: ${winner} is ${Math.abs(diff)}ms (${Math.abs(parseFloat(pct))}%) faster`);
  }

  if (codexNative && openaiOC && codexNative.avgMs > 0 && openaiOC.avgMs > 0) {
    const diff = openaiOC.avgMs - codexNative.avgMs;
    const pct = ((diff / codexNative.avgMs) * 100).toFixed(1);
    const winner = diff < 0 ? "OpenCode" : "Native";
    console.log(`OpenAI: ${winner} is ${Math.abs(diff)}ms (${Math.abs(parseFloat(pct))}%) faster`);
  }

  console.log("");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
