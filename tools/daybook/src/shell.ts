/**
 * Run a shell command and return stdout. Throws on non-zero exit.
 */
export async function run(
  cmd: string[],
  { timeout = 30_000, allowFailure = false } = {}
): Promise<string> {
  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1" },
  });

  const timer = timeout
    ? setTimeout(() => proc.kill(), timeout)
    : undefined;

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (timer) clearTimeout(timer);

  if (exitCode !== 0 && !allowFailure) {
    throw new Error(
      `Command failed (${exitCode}): ${cmd.join(" ")}\n${stderr}`
    );
  }

  return stdout.trim();
}

/**
 * Run a command, returning stdout lines. Empty array on failure.
 */
export async function runLines(
  cmd: string[],
  opts?: { timeout?: number }
): Promise<string[]> {
  try {
    const out = await run(cmd, { ...opts, allowFailure: true });
    return out ? out.split("\n") : [];
  } catch {
    return [];
  }
}
