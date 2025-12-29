import * as fs from "fs";
import * as path from "path";
import color from "picocolors";
import { TestBenchArgs, formatTable } from "../types";

export function runCompare(args: TestBenchArgs): void {
  if (!args.runs || args.runs.length !== 2) {
    console.error("Error: --runs requires exactly two file paths");
    process.exit(1);
  }

  const [file1, file2] = args.runs;

  if (!fs.existsSync(file1)) {
    console.error(`File not found: ${file1}`);
    process.exit(1);
  }
  if (!fs.existsSync(file2)) {
    console.error(`File not found: ${file2}`);
    process.exit(1);
  }

  interface ResultFile {
    strategy?: string;
    judge?: string;
    results: Array<{ testCaseId: string; evaluation?: { totalScore: number }; totalScore?: number }>;
  }

  const data1: ResultFile = JSON.parse(fs.readFileSync(file1, "utf-8"));
  const data2: ResultFile = JSON.parse(fs.readFileSync(file2, "utf-8"));

  console.log(`\n${color.cyan("Comparing Results")}\n`);
  console.log(`File A: ${path.basename(file1)}`);
  console.log(`File B: ${path.basename(file2)}\n`);

  const scores1 = new Map<string, number>();
  const scores2 = new Map<string, number>();

  for (const r of data1.results) {
    const score = r.evaluation?.totalScore ?? r.totalScore ?? 0;
    scores1.set(r.testCaseId, score);
  }
  for (const r of data2.results) {
    const score = r.evaluation?.totalScore ?? r.totalScore ?? 0;
    scores2.set(r.testCaseId, score);
  }

  const allIds = new Set([...scores1.keys(), ...scores2.keys()]);
  const rows: string[][] = [];
  let totalA = 0;
  let totalB = 0;
  let count = 0;
  let agree = 0;

  for (const id of allIds) {
    const a = scores1.get(id) ?? 0;
    const b = scores2.get(id) ?? 0;
    const delta = b - a;
    const deltaStr = delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2);
    rows.push([id, a.toFixed(2), b.toFixed(2), deltaStr]);
    totalA += a;
    totalB += b;
    count++;
    if ((a > 0 && b > 0) || (a === 0 && b === 0)) agree++;
  }

  const avgA = count > 0 ? totalA / count : 0;
  const avgB = count > 0 ? totalB / count : 0;
  const avgDelta = avgB - avgA;
  rows.push(["Average", avgA.toFixed(2), avgB.toFixed(2), (avgDelta >= 0 ? "+" : "") + avgDelta.toFixed(2)]);

  console.log("Score Comparison:");
  console.log(formatTable(["Test Case", "File A", "File B", "Delta"], rows));

  const agreementRate = count > 0 ? (agree / count) * 100 : 0;
  console.log(`\nAgreement: ${agreementRate.toFixed(1)}% (${agree}/${count} same pass/fail)\n`);
}
