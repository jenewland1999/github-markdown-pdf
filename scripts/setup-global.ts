import { stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { installGlobal } from "./install-global.js";
import { installSkill } from "./install-skill.js";
import { executableAvailable, run } from "./process.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function setup(): Promise<void> {
  await installGlobal();
  const locations = await installSkill();
  if (!(await executableAvailable()))
    throw new Error("github-markdown-pdf did not resolve on PATH after installation");
  for (const location of locations) await stat(join(location, "SKILL.md"));
  const output = join(root, "examples", "comprehensive.pdf");
  await run(
    "github-markdown-pdf",
    [join(root, "tests", "fixtures", "comprehensive.md"), "--output", output],
    { cwd: dirname(root) },
  );
  if ((await stat(output)).size === 0)
    throw new Error("Comprehensive smoke test created an empty PDF");
  process.stdout.write(
    `Setup complete\nCLI: github-markdown-pdf\nSkills: ${locations.join(", ")}\nExample PDF: ${output}\n`,
  );
}

setup().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
