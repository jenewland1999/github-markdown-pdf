import assert from "node:assert/strict";
import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { chromium } from "playwright";

import { convertMarkdownToPdf } from "../src/converter.js";
import { renderDiagrams } from "../src/diagrams.js";

test("Pele renders multiple types of diagram as distinct, printable SVGs", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <div class="mermaid">flowchart LR\n A[Start] --&gt; B[Finish]</div>
      <div class="mermaid">sequenceDiagram\n Alice-&gt;&gt;Bob: Hello</div>
      <div class="mermaid">pie\n "First" : 3\n "Second" : 7</div>
    `);
    await renderDiagrams(page);
    const diagrams = page.locator(".mermaid svg.pele");
    assert.equal(await diagrams.count(), 3);
    assert.match((await diagrams.nth(0).getAttribute("class")) ?? "", /pele-flowchart/);
    assert.match((await diagrams.nth(1).textContent()) ?? "", /Hello/);
    assert.match((await diagrams.nth(2).textContent()) ?? "", /First/);
    const ids = await page
      .locator(".mermaid svg [id]")
      .evaluateAll((elements) => elements.map((element) => element.id));
    assert.equal(new Set(ids).size, ids.length);
    assert.ok((await page.pdf()).byteLength > 1_000);
  } finally {
    await browser.close();
  }
});

test("wide diagrams fit the print width without changing their direction", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 672, height: 900 } });
    await page.setContent(`
      <div class="mermaid">flowchart LR
        A[First long process step] --&gt; B[Second long process step]
        B --&gt; C[Third long process step] --&gt; D[Last long process step]
      </div>
    `);
    await renderDiagrams(page);
    const diagram = page.locator(".mermaid svg");
    const bounds = await diagram.boundingBox();
    assert.ok(bounds);
    assert.ok(bounds.x + bounds.width <= 672);
    const first = await diagram.locator('[data-id="A"]').boundingBox();
    const last = await diagram.locator('[data-id="D"]').boundingBox();
    assert.ok(first && last);
    assert.ok(last.x > first.x);
  } finally {
    await browser.close();
  }
});

test("diagram labels cannot inject executable HTML", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<div class="mermaid"></div>');
    await page.locator(".mermaid").evaluate((element) => {
      element.textContent = 'flowchart LR\nA["<img src=x onerror=alert(1)>"] --> B[Safe]';
    });
    await renderDiagrams(page);
    assert.equal(await page.locator(".mermaid svg").count(), 1);
    assert.equal(
      await page.locator(".mermaid img, .mermaid script, .mermaid [onerror]").count(),
      0,
    );
  } finally {
    await browser.close();
  }
});

test(
  "invalid diagrams fail conversion instead of creating a PDF",
  { timeout: 60_000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "markdown-pdf-invalid-diagram-"));
    const input = join(directory, "input.md");
    const output = join(directory, "output.pdf");
    await writeFile(input, "```mermaid\nnot a supported diagram\n```\n");
    await assert.rejects(
      convertMarkdownToPdf(input, output),
      /Mermaid diagram 1 could not be rendered/,
    );
    await assert.rejects(stat(output), { code: "ENOENT" });
  },
);
