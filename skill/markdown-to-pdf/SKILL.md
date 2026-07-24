---
name: markdown-to-pdf
description: Convert Markdown files, README files, and GitHub-flavoured Markdown documents into polished GitHub-style PDF files using the installed github-markdown-pdf command. Use whenever the user asks to convert, export, render, print, or save a Markdown or .md file as a PDF. Also use for requests such as "convert this file into a PDF" when the referenced file is Markdown. Do not use for converting Word documents, arbitrary HTML pages, images, or existing PDF files.
compatibility: Requires Node.js, the github-markdown-pdf executable, and its installed Playwright Chromium browser.
---

# Markdown to PDF

Use the installed `github-markdown-pdf` command for every Markdown-to-PDF conversion.

Do not implement another converter and do not use Pandoc, office software, browser print dialogs, online conversion services, AI document generation, or another PDF library.

## Workflow

1. Identify the Markdown input file from the user's request and available files.
2. Confirm that the source file exists and is a regular file.
3. Treat `.md`, `.markdown`, and named README Markdown files as supported inputs.
4. Determine the output path: use the requested path, or create a `.pdf` beside the source with the same base filename.
5. Run the converter.
6. Verify that the resulting PDF exists and is non-empty.
7. Return the final absolute PDF path.

## Commands

Default output:

```bash
github-markdown-pdf "<input.md>"
```

Requested output:

```bash
github-markdown-pdf "<input.md>" --output "<output.pdf>"
```

Always quote file paths.

## Source And Output Handling

- Preserve source Markdown unless the user explicitly requests changes.
- Resolve references such as "this file" from available files. Report ambiguity instead of silently choosing.
- Create output directories through the converter when needed.
- Do not silently overwrite an unrelated PDF.
- Verify output exists and has size greater than zero. Attach it when supported; otherwise report its absolute path.

## Failures

If `github-markdown-pdf` is unavailable, do not use another converter. Report missing installation or `PATH`, look for this converter repository when accessible, run its documented PNPM global setup, then retry.

Preserve conversion errors. Diagnose input, asset, Mermaid, Chromium, permission, or output-path problems. Fix environment issues where possible; never silently remove source content.

See `references/cli-reference.md` for command behavior and troubleshooting.
