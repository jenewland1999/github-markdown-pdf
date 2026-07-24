#!/usr/bin/env node
import { resolve } from "node:path";

import { convertMarkdownToPdf } from "./converter.js";

const HELP = `Usage: github-markdown-pdf <input.md> [options]

Convert GitHub-flavoured Markdown to an A4 PDF.

Options:
  -o, --output <path>  Write PDF to this path
  -h, --help           Show this help
`;

export function parseArgs(args: string[]): { input: string; output?: string } | undefined {
  if (args.includes("--help") || args.includes("-h")) return undefined;
  let input: string | undefined;
  let output: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--output" || arg === "-o") {
      output = args[++index];
      if (!output) throw new Error(`${arg} requires a path`);
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (input) {
      throw new Error(`Unexpected argument: ${arg}`);
    } else {
      input = arg;
    }
  }
  if (!input) throw new Error("Missing Markdown input file");
  return output === undefined ? { input } : { input, output };
}

async function main(): Promise<void> {
  try {
    const parsed = parseArgs(process.argv.slice(2));
    if (!parsed) {
      process.stdout.write(HELP);
      return;
    }
    const output = await convertMarkdownToPdf(parsed.input, parsed.output);
    process.stdout.write(`PDF written to ${resolve(output)}\n`);
  } catch (error) {
    process.stderr.write(
      `github-markdown-pdf: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
  }
}

await main();
