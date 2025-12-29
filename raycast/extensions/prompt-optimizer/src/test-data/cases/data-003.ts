import { TestCase } from "../types";

export const testCase: TestCase = {
  id: "data-003",
  category: "data-analysis",
  description: "Anomaly detection in time series",
  userRequest: "This API latency data shows unusual patterns. Identify the anomalies and hypothesize causes.",
  additionalContext: `Hour | P50 (ms) | P99 (ms) | Error Rate
00:00 | 45 | 120 | 0.1%
06:00 | 48 | 125 | 0.1%
09:00 | 52 | 180 | 0.2%
12:00 | 55 | 450 | 0.5%
15:00 | 180 | 2500 | 3.2%
18:00 | 60 | 200 | 0.3%
21:00 | 47 | 122 | 0.1%`,
  mode: "detailed",
};
