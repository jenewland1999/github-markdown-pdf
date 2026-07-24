# CLI Reference

`github-markdown-pdf` is the only conversion implementation used by this skill.

## Syntax

```text
github-markdown-pdf <input.md>
github-markdown-pdf <input.md> --output <output.pdf>
github-markdown-pdf <input.md> -o <output.pdf>
github-markdown-pdf --help
```

Supported inputs use `.md` or `.markdown`, including README files with either extension. Without `--output`, output sits beside input and replaces its extension with `.pdf`. Parent output directories are created.

Success writes `PDF written to <absolute-path>` and exits `0`. Invalid arguments, unsupported or missing input, and conversion failures exit `2`. Installation scripts exit non-zero when setup is incomplete.

## Examples

```bash
github-markdown-pdf "/Users/me/Project Notes/README.md"
github-markdown-pdf "/Users/me/Project Notes/design.md" --output "/Users/me/PDF Exports/design review.pdf"
github-markdown-pdf "docs/architecture.md" -o "build/reports/architecture.pdf"
```

Always quote paths. Converter resolves relative paths from current working directory and resolves local Markdown assets relative to source Markdown.

## Verify Output

POSIX:

```bash
test -s "/absolute/path/output.pdf"
```

PowerShell:

```powershell
if (-not ((Get-Item "C:\absolute\path\output.pdf").Length -gt 0)) { throw "PDF missing or empty" }
```

## Chromium Troubleshooting

`Executable doesn't exist` or browser download errors mean Playwright Chromium is absent. From converter checkout run `pnpm exec playwright install chromium`, then retry. On Linux, missing shared-library errors may require OS dependencies via `pnpm exec playwright install-deps chromium` with suitable admin rights.

Sandbox launch failures commonly occur in restricted containers. Use environment-supported Chromium sandbox configuration rather than changing Markdown. Permission errors require writable temp/output locations. Mermaid errors usually identify invalid diagram syntax; preserve source and report error. Missing images usually indicate broken paths relative to source file.

## PNPM Global Executable

Check setup:

```bash
pnpm bin --global
github-markdown-pdf --help
```

If PNPM reports no global bin directory, run `pnpm setup`, add `PNPM_HOME` to `PATH`, restart shell, then rerun `pnpm install:global`. If global bin exists but command is missing, ensure output from `pnpm bin --global` appears on `PATH`. Windows shells may need restart before `.cmd` shims resolve.
