import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { executableAvailable, run } from "./process.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function installGlobal(): Promise<void> {
  let globalBin: string;
  try {
    globalBin = (await run("pnpm", ["bin", "--global"], { cwd: root, capture: true })).trim();
  } catch {
    throw new Error(
      "PNPM global binary directory is not configured. Run `pnpm setup`, add reported PNPM_HOME to PATH, restart shell, then run `pnpm install:global` again.",
    );
  }
  await run("pnpm", ["build"], { cwd: root });
  await run("pnpm", ["--config.minimum-release-age=0", "add", "--global", root], {
    cwd: tmpdir(),
    env: { ...process.env, CI: "true" },
  });
  if (!(await executableAvailable())) {
    throw new Error(
      `github-markdown-pdf is not on PATH. Add ${globalBin} to PATH, restart shell, then run \`pnpm install:global\` again.`,
    );
  }
  const smokeDir = await mkdtemp(join(tmpdir(), "github-markdown-pdf-global-"));
  const input = join(root, "tests", "fixtures", "smoke.md");
  const output = join(smokeDir, "smoke.pdf");
  await run("github-markdown-pdf", [input, "--output", output], { cwd: smokeDir });
  if ((await stat(output)).size === 0)
    throw new Error("Global CLI smoke test created an empty PDF");
  process.stdout.write(
    `Global CLI installed: ${join(globalBin.split("\n").at(-1)!, process.platform === "win32" ? "github-markdown-pdf.cmd" : "github-markdown-pdf")}\nSmoke test passed: ${output}\n`,
  );
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  installGlobal().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
