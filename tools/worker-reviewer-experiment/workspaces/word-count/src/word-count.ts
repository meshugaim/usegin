import { existsSync } from "fs";

const args = process.argv.slice(2);

if (args.length === 0) {
  process.stderr.write("Error: No file specified\n");
  process.exit(1);
}

const filepath = args[0];

if (!existsSync(filepath)) {
  process.stderr.write(`Error: File not found: ${filepath}\n`);
  process.exit(1);
}
