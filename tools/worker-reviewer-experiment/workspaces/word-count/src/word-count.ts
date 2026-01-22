const args = process.argv.slice(2);

if (args.length === 0) {
  process.stderr.write("Error: No file specified\n");
  process.exit(1);
}
