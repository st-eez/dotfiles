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
  } catch (error: any) {
    console.error(`Execution failed: ${command}`, error);
    if (error.code === "ENOENT") {
      throw new Error(`Command '${command}' not found. Install it or add it to PATH (${normalizedPath}).`);
    }
    if (error.timedOut) {
      throw new Error(`Command '${command}' timed out after ${(timeoutMs / 1000).toFixed(0)}s.`);
    }
    if (error.stderr) {
      throw new Error(error.stderr);
    }
    throw error;
  }
}
