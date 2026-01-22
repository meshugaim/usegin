const args = Bun.argv.slice(2);

if (args.length === 0) {
  console.error("Error: No file specified");
  process.exit(1);
}

const filePath = args[0];
const file = Bun.file(filePath);

if (!(await file.exists())) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}
