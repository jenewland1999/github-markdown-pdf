import assert from "node:assert/strict";
import { lstat, mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path, { join } from "node:path";
import test from "node:test";

import { installSkill, skillDestinations } from "../scripts/install-skill.js";
import { executableAvailable } from "../scripts/process.js";

const skillPath = join(process.cwd(), "skill", "markdown-to-pdf", "SKILL.md");

test("skill has valid open frontmatter and converter-only instructions", async () => {
  const content = await readFile(skillPath, "utf8");
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, "YAML frontmatter must exist");
  const fields: Record<string, string> = Object.fromEntries(
    match[1]!.split("\n").map((line) => {
      const index = line.indexOf(":");
      return [line.slice(0, index), line.slice(index + 1).trim()];
    }),
  );
  assert.equal(fields.name, "markdown-to-pdf");
  assert.match(fields["description"]!, /Markdown.*PDF/);
  assert.match(fields["description"]!, /convert|export|render|print|save/i);
  assert.ok(fields.compatibility);
  assert.equal(fields["allowed-tools"], undefined);
  assert.match(content, /github-markdown-pdf "<input\.md>"/);
  assert.doesNotMatch(
    content,
    /```(?:bash|sh)\n(?:pandoc|wkhtmltopdf|weasyprint|libreoffice|npx md-to-pdf)/i,
  );
  assert.equal(path.basename(path.dirname(skillPath)), fields["name"]);
});

test("copy installation supports simulated clean home", async () => {
  const home = await mkdtemp(join(tmpdir(), "skill-copy-"));
  const destinations = await installSkill({ home, copy: true });
  assert.deepEqual(destinations, skillDestinations(home));
  for (const destination of destinations) {
    assert.ok((await stat(join(destination, "SKILL.md"))).size > 0);
    assert.equal((await lstat(destination)).isSymbolicLink(), false);
  }
});

test("default installation links canonical skill where supported", async () => {
  const home = await mkdtemp(join(tmpdir(), "skill-link-"));
  const destinations = await installSkill({ home });
  for (const destination of destinations) {
    assert.ok((await stat(join(destination, "SKILL.md"))).size > 0);
    if (process.platform !== "win32")
      assert.equal((await lstat(destination)).isSymbolicLink(), true);
  }
});

test("unrelated installation is protected and force replaces it", async () => {
  const home = await mkdtemp(join(tmpdir(), "skill-force-"));
  const destination = skillDestinations(home)[0]!;
  await mkdir(destination, { recursive: true });
  await writeFile(join(destination, "SKILL.md"), "foreign");
  await assert.rejects(installSkill({ home, copy: true }), /Refusing to replace unrelated/);
  await installSkill({ home, copy: true, force: true });
  assert.match(await readFile(join(destination, "SKILL.md"), "utf8"), /name: markdown-to-pdf/);
});

test("destination construction supports POSIX and Windows paths", () => {
  assert.deepEqual(skillDestinations("/home/user", path.posix), [
    "/home/user/.agents/skills/markdown-to-pdf",
    "/home/user/.claude/skills/markdown-to-pdf",
  ]);
  assert.deepEqual(skillDestinations("C:\\Users\\user", path.win32), [
    "C:\\Users\\user\\.agents\\skills\\markdown-to-pdf",
    "C:\\Users\\user\\.claude\\skills\\markdown-to-pdf",
  ]);
});

test("missing global executable is detected", async () => {
  assert.equal(
    await executableAvailable("definitely-not-a-real-github-markdown-pdf-command", { PATH: "" }),
    false,
  );
});
