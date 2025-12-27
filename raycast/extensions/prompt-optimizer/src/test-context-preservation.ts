#!/usr/bin/env npx ts-node
/**
 * Context Preservation Test Suite
 *
 * Tests that the prompt optimizer preserves verbatim terms from context.
 *
 * Usage:
 *   npx ts-node src/test-context-preservation.ts              # Test production strategy
 *   npx ts-node src/test-context-preservation.ts <path>       # Test specific strategy file
 *
 * Exit codes:
 *   0 = Pass (≥80% preservation)
 *   1 = Fail (<80% preservation)
 */

import "./setup-test";
import * as path from "path";
import { buildOptimizationPrompt } from "./utils/engines";
import { safeExec } from "./utils/exec";
import { PromptStrategy } from "./prompts/types";

// --- Types ---

interface TestCase {
  name: string;
  prompt: string;
  context: string;
  expectedKeywords: string[];
}

interface TestResult {
  testName: string;
  keywords: { keyword: string; found: boolean }[];
  preservationRate: number;
}

// --- Build Prompt Function Type ---

type BuildPromptFn = (userRequest: string, context?: string, personaId?: string) => string;

// --- Test Cases ---

const TEST_CASES: TestCase[] = [
  {
    name: "Raycast extension audit with specific tools",
    prompt: "audit the persona logic in my Prompt Optimizer",
    context:
      "my raycast extension i built to optimize prompts using gemini-cli and openai codex in non-interactive mode",
    expectedKeywords: ["gemini-cli", "codex", "non-interactive", "Raycast"],
  },
  {
    name: "Negative constraint (anti-AI slop)",
    prompt: "make a 1 page html website for my portolio website. dont make it generi ai -slop ish.",
    context: "",
    expectedKeywords: ["generic", "AI", "slop"],
  },
  {
    name: "Massive dotfiles audit with file structure",
    prompt: "Full audit of dotfiles installer codebase.",
    context: `Multi-platform dotfiles installer supporting macOS, Arch Linux (including Omarchy), and Debian/Ubuntu. Uses GNU Stow for symlink management, gum for TUI, and modular shell scripts.

Codebase structure:
install.sh                    # Main entry point
installer/bootstrap.sh        # OS detection, gum install
installer/config.sh           # Package lists, mappings
installer/install.sh          # Package installation, stow logic

Core flows to audit:
- OS/distro detection (macos, arch, debian)
- Package manager abstraction (brew, pacman, yay/paru, apt)
- Stow conflict detection (check_stow_conflicts)
- Nerd font installation (per-platform)

Key functions: detect_omarchy(), merge_nvim_plugins(), setup_ghostty_steez_config()`,
    expectedKeywords: [
      "GNU Stow",
      "gum",
      "Omarchy",
      "bootstrap.sh",
      "detect_omarchy",
      "pacman",
      "brew",
      "apt",
      "check_stow_conflicts",
    ],
  },
  {
    name: "Codex phase docs with specific paths",
    prompt:
      "your goal is to implement the fixes outlined in the /codex phase docs. analyze the current plan for the solana sniper bot at /codex/phase1-phase4.",
    context:
      "use think harder and context7 mcp with web search to validate findings. be sure we are fixing root issues, not bandaid fixes. implement all fixes in order. keep all 4 plans up to date.",
    expectedKeywords: ["/codex", "phase1", "phase4", "context7", "root issues", "bandaid"],
  },
  {
    name: "WindowServer memory leak audit",
    prompt:
      "perform an audit on my aerospace and sketchybar lua setups to ensure everything is working as expected and efficiently.",
    context:
      "We need to make sure that the changes we recently did to aerospace / sketchybar will resolve the issue were having where windowserver is eating up 4gb+ of ram after running for multiple hours",
    expectedKeywords: ["aerospace", "sketchybar", "windowserver", "4gb", "Lua"],
  },
  {
    name: "NetSuite PR audit with branch name",
    prompt: "use ultrathink mode. perform an in-depth audit of this feature / PR that was done by my employee.",
    context:
      "use multiple sub agents to read the codebase. the branch name is feature/stel-primary-contact-sourcing. inspect what was changed in the netsuite project, ensure we are using suitescript best practices. use context7 mcp to validate.",
    expectedKeywords: ["feature/stel-primary-contact-sourcing", "NetSuite", "SuiteScript", "context7", "sub agents"],
  },
];

// --- Strategy Loading ---

async function loadStrategyBuildPrompt(strategyPath: string | undefined): Promise<BuildPromptFn> {
  if (!strategyPath) {
    // Use production strategy (from engines.ts)
    return (userRequest: string, context?: string, personaId?: string) =>
      buildOptimizationPrompt(userRequest, "quick", context, personaId || "prompt_engineer");
  }

  // Load custom strategy
  const absolutePath = path.resolve(process.cwd(), strategyPath);
  const module = await import(absolutePath);

  const strategy: PromptStrategy =
    module.default || module.v1Baseline || module.v2Candidate || module.strategy || module;

  if (typeof strategy.buildQuickPrompt !== "function") {
    throw new Error(`Invalid strategy file: ${strategyPath}. Must export buildQuickPrompt function.`);
  }

  return strategy.buildQuickPrompt;
}

// --- Test Runner ---

async function runTest(testCase: TestCase, buildPrompt: BuildPromptFn): Promise<TestResult> {
  const systemPrompt = buildPrompt(testCase.prompt, testCase.context, "prompt_engineer");

  // Run via gemini CLI
  const output = await safeExec("gemini", [
    "--allowed-mcp-server-names",
    "none",
    "-e",
    "none",
    "--model",
    "gemini-3-flash-preview",
    systemPrompt,
  ]);

  // Check for keywords (case-insensitive)
  const keywords = testCase.expectedKeywords.map((kw) => ({
    keyword: kw,
    found: output.toLowerCase().includes(kw.toLowerCase()),
  }));

  const foundCount = keywords.filter((k) => k.found).length;
  const preservationRate = (foundCount / keywords.length) * 100;

  return {
    testName: testCase.name,
    keywords,
    preservationRate,
  };
}

// --- Main ---

async function main(): Promise<void> {
  const strategyPath = process.argv[2];
  const strategyLabel = strategyPath ? path.basename(strategyPath) : "production (engines.ts)";

  console.log("🧪 Context Preservation Test Suite\n");
  console.log("=".repeat(70));
  console.log(`Strategy: ${strategyLabel}\n`);

  let buildPrompt: BuildPromptFn;
  try {
    buildPrompt = await loadStrategyBuildPrompt(strategyPath);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to load strategy: ${msg}`);
    process.exit(1);
  }

  const results: TestResult[] = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const testCase = TEST_CASES[i];
    console.log(`Test ${i + 1}: ${testCase.name}`);
    console.log(`  Prompt: "${testCase.prompt.slice(0, 60)}${testCase.prompt.length > 60 ? "..." : ""}"`);
    if (testCase.context) {
      console.log(`  Context: "${testCase.context.slice(0, 60)}${testCase.context.length > 60 ? "..." : ""}"`);
    } else {
      console.log("  Context: (none)");
    }

    try {
      const result = await runTest(testCase, buildPrompt);
      results.push(result);

      for (const kw of result.keywords) {
        const icon = kw.found ? "✅" : "❌";
        console.log(`  ${icon} "${kw.keyword}" ${kw.found ? "(found)" : "(NOT FOUND)"}`);
      }
      console.log(`  → ${result.preservationRate.toFixed(0)}% preserved\n`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Test failed: ${msg}\n`);
      results.push({
        testName: testCase.name,
        keywords: testCase.expectedKeywords.map((kw) => ({ keyword: kw, found: false })),
        preservationRate: 0,
      });
    }
  }

  // Summary
  console.log("=".repeat(70));
  console.log("SUMMARY\n");

  const totalKeywords = results.reduce((acc, r) => acc + r.keywords.length, 0);
  const foundKeywords = results.reduce((acc, r) => acc + r.keywords.filter((k) => k.found).length, 0);
  const overallRate = (foundKeywords / totalKeywords) * 100;

  const passingTests = results.filter((r) => r.preservationRate >= 80).length;

  console.log(`Tests ≥80%: ${passingTests}/${results.length}`);
  console.log(`Keywords found: ${foundKeywords}/${totalKeywords}`);
  console.log(`Overall preservation rate: ${overallRate.toFixed(1)}%\n`);

  // Per-test summary
  console.log("Per-test breakdown:");
  for (const r of results) {
    const status = r.preservationRate >= 80 ? "✅" : "❌";
    console.log(`  ${status} ${r.testName}: ${r.preservationRate.toFixed(0)}%`);
  }
  console.log("");

  if (overallRate >= 80) {
    console.log("✅ PASS: Context is being preserved adequately (≥80%)");
    process.exit(0);
  } else {
    console.log("❌ FAIL: Context is being dropped (<80%). Consider implementing hybrid approach.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
