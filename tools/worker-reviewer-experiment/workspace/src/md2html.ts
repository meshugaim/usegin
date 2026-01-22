#!/usr/bin/env bun

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: md2html <input.md> [-o output.html]

Convert Markdown files to HTML.

Options:
  -o <file>    Write output to file instead of stdout
  --help, -h   Show this help message`);
  process.exit(0);
}
