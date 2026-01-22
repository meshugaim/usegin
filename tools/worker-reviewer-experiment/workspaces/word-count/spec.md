# word-count CLI

Build a command-line tool that counts words in text files.

## Acceptance Criteria

1. **File input**: Takes a file path as the first argument
2. **Output format**: Outputs word count to stdout in format: `N words` (e.g., "42 words")
3. **Help flag**: `--help` shows usage information
4. **Exit codes**:
   - Exit 0 on success
   - Exit 1 on error (missing argument, file not found, etc.)

## Examples

```bash
# Basic usage
echo "hello world" > test.txt
word-count test.txt
# Output: 2 words

# Show help
word-count --help
# Output: Usage: word-count <file>

# Error cases
word-count
# stderr: Error: No file specified
# exit code: 1

word-count nonexistent.txt
# stderr: Error: File not found: nonexistent.txt
# exit code: 1
```

## Technical Notes

- Use TypeScript with Bun runtime
- A "word" is any sequence of non-whitespace characters
- Empty files should output "0 words"
