const args = process.argv.slice(2);

if (args[0] === "--help") {
  console.log("Usage: word-count <file>");
  process.exit(0);
}

const filePath = args[0];
if (!filePath) {
  console.error("Error: No file specified");
  process.exit(1);
}

const file = Bun.file(filePath);
if (!(await file.exists())) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}
const content = await file.text();
const words = content.trim() === "" ? 0 : content.trim().split(/\s+/).length;
process.stdout.write(words + " words\n");
