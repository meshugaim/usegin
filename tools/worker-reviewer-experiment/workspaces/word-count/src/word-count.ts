import { existsSync, readFileSync } from "fs";

const args = process.argv.slice(2);

if (args[0] === "--help") {
  process.stdout.write("Usage: word-count <file>\n");
  process.exit(0);
}

if (args.length === 0) {
  process.stderr.write("Error: No file specified\n");
  process.exit(1);
}

const filepath = args[0];

if (!existsSync(filepath)) {
  process.stderr.write(`Error: File not found: ${filepath}\n`);
  process.exit(1);
}

const content = readFileSync(filepath, "utf-8");
const words = content.trim().split(/\s+/).filter((w) => w.length > 0);
const count = words.length;

process.stdout.write(`${count} words\n`);
process.exit(0);
