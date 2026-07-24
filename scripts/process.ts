import { spawn } from "node:child_process";

export async function run(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; capture?: boolean } = {},
): Promise<string> {
  return await new Promise((resolve, reject) => {
    const output: Buffer[] = [];
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: process.platform === "win32",
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    child.stdout?.on("data", (chunk: Buffer) => output.push(chunk));
    child.stderr?.on("data", (chunk: Buffer) => output.push(chunk));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(Buffer.concat(output).toString())
        : reject(
            new Error(
              `${command} ${args.join(" ")} exited with code ${code}${output.length ? `\n${Buffer.concat(output).toString()}` : ""}`,
            ),
          ),
    );
  });
}

export async function executableAvailable(
  command = "github-markdown-pdf",
  env = process.env,
): Promise<boolean> {
  try {
    await run(command, ["--help"], { env, capture: true });
    return true;
  } catch {
    return false;
  }
}
