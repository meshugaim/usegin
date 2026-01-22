const args = Bun.argv.slice(2);

if (args.length === 0) {
  console.error("Error: No file specified");
  process.exit(1);
}
