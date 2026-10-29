# github-markdown-pdf

Convert GitHub-flavoured Markdown into polished A4 PDFs using Marked, Shiki `github-light-default`, Pele for Mermaid diagrams, and Playwright Chromium.

Mermaid diagrams are rendered locally using Pele's layout and visual style. Pele targets Mermaid 12.1.0 syntax, so some diagram features may render differently from Mermaid.js. Invalid or unsupported diagrams stop conversion with an error.

Requires Node.js 26.13.0 LTS or later within Node 26, and PNPM 12.16.1.
Node.js 26 does not include Corepack, so install PNPM using its [installation guide](https://pnpm.io/installation) or install Corepack separately.

## Development

```bash
pnpm install
pnpm exec playwright install chromium
pnpm md-to-pdf -- README.md
pnpm md-to-pdf -- README.md --output build/README.pdf
```

## Global CLI

Install or link from local checkout:

```bash
pnpm install:global
```

The installer uses `pnpm add --global <checkout-path>` internally.

Use from any working directory:

```bash
github-markdown-pdf README.md
github-markdown-pdf README.md --output build/README.pdf
github-markdown-pdf README.md -o build/README.pdf
```

After registry publication, package could be installed with:

```bash
pnpm add --global github-markdown-pdf
```

No registry publication is required for local setup.

## Installing the Agent Skill

Install global CLI plus portable skill:

```bash
pnpm setup:global
```

Installation provides:

- Global `github-markdown-pdf` executable
- Portable `markdown-to-pdf` Agent Skill
- Automatic skill discovery where supported
- Explicit skill invocation where supported

Skill installs into shared `~/.agents/skills/markdown-to-pdf` and Claude Code `~/.claude/skills/markdown-to-pdf`. Restart agent or reload skills after installation when needed. Install skill alone with `pnpm skill:install`; use `pnpm skill:install -- --copy` to copy instead of link or `pnpm skill:install -- --force` to replace an existing installation.

Natural-language requests:

```text
Convert README.md into a PDF.
Can you convert this Markdown file into a PDF?
Export docs/architecture.md to build/architecture.pdf.
```

Skill activation depends primarily on canonical `name` and `description` metadata. Exact explicit invocation differs by agent product. Claude Code supports `/markdown-to-pdf`; compatible agents may expose `markdown-to-pdf` through slash commands, skill pickers, mentions, or prompt-level tool selection. Canonical `SKILL.md` stays vendor-neutral.
