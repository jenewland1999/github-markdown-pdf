import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { marked, Renderer } from "marked";
import { readFile, mkdir, stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createHighlighter } from "shiki";

import { renderDiagrams } from "./diagrams.js";
import { STYLES } from "./styles.js";

const SUPPORTED_EXTENSIONS = new Set([".md", ".markdown"]);

export function sanitizeHtml(html: string): string {
  const dom = new JSDOM("");
  try {
    const purify = createDOMPurify(dom.window);
    return purify.sanitize(html, {
      USE_PROFILES: { html: true, svg: true, svgFilters: true },
      ADD_TAGS: ["input"],
      ADD_ATTR: ["class", "style", "checked", "disabled", "type"],
      FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "button"],
      FORBID_ATTR: ["srcset"],
    });
  } finally {
    dom.window.close();
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function applyAlerts(html: string): string {
  const dom = new JSDOM(`<body>${html}</body>`);
  try {
    const { document } = dom.window;
    const blockquotes = [...document.querySelectorAll("blockquote")];

    for (const blockquote of blockquotes) {
      const firstParagraph = blockquote.firstElementChild;
      if (firstParagraph?.tagName.toLowerCase() !== "p") continue;

      const match = firstParagraph.textContent?.match(
        /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i,
      );
      if (!match) continue;

      firstParagraph.innerHTML = firstParagraph.innerHTML.replace(
        /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br\s*\/?>)?/i,
        "",
      );

      const type = match[1]!.toLowerCase();
      const alert = document.createElement("div");
      alert.className = `markdown-alert markdown-alert-${type}`;

      const title = document.createElement("p");
      title.className = "markdown-alert-title";
      title.textContent = `${type[0]!.toUpperCase()}${type.slice(1)}`;
      alert.append(title, ...Array.from(blockquote.childNodes));
      blockquote.replaceWith(alert);
    }

    return document.body.innerHTML;
  } finally {
    dom.window.close();
  }
}

const IMAGE_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

async function inlineLocalImages(html: string, sourceDirectory: string): Promise<string> {
  const matches = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi)];
  let result = html;
  for (const match of matches) {
    const source = match[1]!;
    if (/^(?:[a-z]+:|\/\/|#)/i.test(source)) continue;
    const cleanSource = decodeURIComponent(source.split(/[?#]/, 1)[0]!);
    const mime = IMAGE_TYPES[extname(cleanSource).toLowerCase()];
    if (!mime) continue;
    const contents = await readFile(resolve(sourceDirectory, cleanSource)).catch(() => undefined);
    if (!contents) continue;
    const dataUri = `data:${mime};base64,${contents.toString("base64")}`;
    result = result.replace(match[0], match[0].replace(`src="${source}"`, `src="${dataUri}"`));
  }
  return result;
}

export function defaultOutputPath(input: string): string {
  return input.slice(0, -extname(input).length) + ".pdf";
}

export async function convertMarkdownToPdf(
  inputPath: string,
  outputPath?: string,
): Promise<string> {
  const input = resolve(inputPath);
  const extension = extname(input).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension))
    throw new Error("Input must use .md or .markdown extension");
  const inputStat = await stat(input).catch(() => undefined);
  if (!inputStat?.isFile()) throw new Error(`Input is not a regular file: ${input}`);
  const output = resolve(outputPath ?? defaultOutputPath(input));
  const source = await readFile(input, "utf8");
  const highlighter = await createHighlighter({
    themes: ["github-light-default"],
    langs: ["text", "bash", "css", "html", "javascript", "json", "markdown", "typescript", "yaml"],
  });
  const renderer = new Renderer();
  renderer.code = ({ text, lang }) => {
    const language = lang?.split(/\s+/)[0]?.toLowerCase() ?? "text";
    if (language === "mermaid") return `<div class="mermaid">${escapeHtml(text)}</div>`;
    const loadedLanguage = highlighter.getLoadedLanguages().includes(language) ? language : "text";
    return highlighter.codeToHtml(text, { lang: loadedLanguage, theme: "github-light-default" });
  };
  marked.use({ gfm: true, renderer });
  const renderedBody = await inlineLocalImages(
    applyAlerts(await marked.parse(source)),
    dirname(input),
  );
  const body = sanitizeHtml(renderedBody);
  highlighter.dispose();

  const base = pathToFileURL(`${dirname(input)}/`).href;
  const html = `<!doctype html><html><head><meta charset="utf-8"><base href="${base}"><style>${STYLES}</style></head><body><main class="markdown-body">${body}</main></body></html>`;

  await mkdir(dirname(output), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(async () => document.fonts.ready);
    await renderDiagrams(page);
    await page.pdf({
      path: output,
      format: "A4",
      landscape: false,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="font:9px system-ui;color:#57606a;text-align:center;width:100%"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: "18mm", right: "16mm", bottom: "18mm", left: "16mm" },
    });
  } finally {
    await browser.close();
  }
  return output;
}
