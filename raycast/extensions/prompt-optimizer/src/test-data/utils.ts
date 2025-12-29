export function generateLongContext(targetLength: number = 8000): string {
  const logEntry = (i: number) =>
    `2025-12-26 ${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00 INFO [service-${i % 10}] Processing request id=${i * 1000} user=user_${i % 100} action=UPDATE latency=${50 + (i % 200)}ms status=OK\n`;

  let context = "";
  let i = 0;
  while (context.length < targetLength) {
    context += logEntry(i++);
  }
  return context;
}
