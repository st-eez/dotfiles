import execa from "execa";

/**
 * Safely executes a shell command and returns the output.
 * @param command The command to execute.
 * @param args The arguments to pass to the command.
 * @returns A promise that resolves to the stdout of the command.
 */
const DEFAULT_TIMEOUT_MS = 180_000;

export async function safeExec(
  command: string,
  args: string[],
  input?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  console.log(`Executing: ${command} ${args.join(" ")}`);
  const basePath = process.env.PATH ?? "";
  const normalizedPath = basePath.includes("/opt/homebrew/bin") ? basePath : `/opt/homebrew/bin:${basePath}`;
  try {
    const { stdout } = await execa(command, args, {
      env: {
        ...process.env,
        PATH: normalizedPath, // make sure Homebrew bin is available for Raycast runtime
      },
      shell: false, // avoid shell splitting newlines from multi-line prompts
      stderr: "pipe",
      input,
      timeout: timeoutMs,
      killSignal: "SIGTERM",
    });
    console.log(`Execution success: ${command}`);
    return stdout;
  } catch (error: unknown) {
    console.error(`Execution failed: ${command}`, error);

    if (error instanceof Error) {
      const execError = error as Error & { code?: string; timedOut?: boolean; stderr?: string };

      if (execError.code === "ENOENT") {
        throw new Error(`Command '${command}' not found. Install it or add it to PATH (${normalizedPath}).`);
      }
      if (execError.timedOut) {
        throw new Error(`Command '${command}' timed out after ${(timeoutMs / 1000).toFixed(0)}s.`);
      }
      if (execError.stderr) {
        throw new Error(execError.stderr);
      }
      throw error;
    }
    throw new Error(String(error));
  }
}
