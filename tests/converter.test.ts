import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdtemp, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";

import {
  applyAlerts,
  convertMarkdownToPdf,
  defaultOutputPath,
  sanitizeHtml,
} from "../src/converter.js";

test("default output replaces Markdown extension", () => {
  assert.equal(defaultOutputPath("docs/readme.markdown"), "docs/readme.pdf");
});

test("sanitizer preserves renderer markup and removes executable HTML", () => {
  const sanitized = sanitizeHtml(
    '<script>globalThis.compromised=true</script><style>body{display:none}</style><div class="mermaid"><svg viewBox="0 0 10 10"><path d="M0 0"></path></svg></div><pre class="shiki" style="color:#1f2328"><code><span style="color:#CF222E">const</span></code></pre><input type="checkbox" checked disabled><a href="javascript:alert(1)" onclick="alert(1)">unsafe</a>',
  );
  assert.doesNotMatch(sanitized, /script|onclick|javascript:|<style/i);
  assert.match(sanitized, /class="mermaid"/);
  assert.match(sanitized, /<svg viewBox="0 0 10 10">/);
  assert.match(sanitized, /class="shiki"/);
  assert.match(sanitized, /type="checkbox"/);
});

test("sanitizer removes executable content from malformed HTML and SVG", () => {
  const sanitized = sanitizeHtml(
    '<div><img src="x" onerror="alert(1)"><svg onload="alert(1)"><a href="javascript:alert(1)"><text>diagram</text></a><script>alert(1)</script></svg><p>Unclosed',
  );

  assert.doesNotMatch(sanitized, /onerror|onload|javascript:|<script/i);
  assert.match(sanitized, /<svg/);
  assert.match(sanitized, /diagram/);
  assert.match(sanitized, /<p>Unclosed<\/p>/);
});

test("alerts preserve lists and multiple paragraphs", () => {
  const rendered = applyAlerts(
    "<blockquote><p>[!IMPORTANT]\nFirst paragraph</p><p>Second paragraph</p><ul><li>One</li><li>Two</li></ul></blockquote>",
  );

  assert.match(rendered, /class="markdown-alert markdown-alert-important"/);
  assert.match(rendered, /class="markdown-alert-title">Important<\/p>/);
  assert.doesNotMatch(rendered, /\[!IMPORTANT\]/);
  assert.match(rendered, /<p>First paragraph<\/p><p>Second paragraph<\/p><ul>/);
  assert.match(rendered, /<li>One<\/li><li>Two<\/li>/);
});

test("comprehensive fixture converts to non-empty PDF", { timeout: 60_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "markdown-pdf-"));
  const output = join(directory, "nested", "fixture.pdf");
  await convertMarkdownToPdf(join(process.cwd(), "tests", "fixtures", "comprehensive.md"), output);
  assert.ok((await stat(output)).size > 1_000);
});

test("linked compiled CLI runs outside repository", { timeout: 60_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "global-cli-"));
  const bin = join(directory, "bin");
  const working = join(directory, "working");
  const executable = join(
    bin,
    process.platform === "win32" ? "github-markdown-pdf.cmd" : "github-markdown-pdf",
  );
  await import("node:fs/promises").then(({ mkdir }) => Promise.all([mkdir(bin), mkdir(working)]));
  if (process.platform === "win32") {
    await writeFile(executable, `@node "${join(process.cwd(), "dist", "cli.js")}" %*\r\n`);
  } else {
    await symlink(join(process.cwd(), "dist", "cli.js"), executable);
    await chmod(join(process.cwd(), "dist", "cli.js"), 0o755);
  }
  const output = join(working, "outside.pdf");
  const code = await new Promise<number | null>((resolve) => {
    const child = spawn(
      "github-markdown-pdf",
      [join(process.cwd(), "tests", "fixtures", "smoke.md"), "-o", output],
      {
        cwd: working,
        env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH ?? ""}` },
        shell: process.platform === "win32",
        stdio: "ignore",
      },
    );
    child.on("close", resolve);
  });
  assert.equal(code, 0);
  assert.ok((await stat(output)).size > 0);
});
