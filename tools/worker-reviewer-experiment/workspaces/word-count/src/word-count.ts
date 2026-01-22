const args = process.argv.slice(2);

if (args[0] === "--help") {
  console.log("Usage: word-count <file>");
  process.exit(0);
}
