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

// Find input file (first arg that doesn't start with -)
const inputFile = args.find((arg) => !arg.startsWith("-"));

if (!inputFile) {
  console.error("Error: No input file specified. Use --help for usage.");
  process.exit(1);
}
