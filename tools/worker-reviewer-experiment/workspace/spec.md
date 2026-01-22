# md2html CLI

Build a command-line tool that converts Markdown files to HTML.

## Acceptance Criteria

1. **File input**: Takes a markdown file path as the first argument
2. **Output options**:
   - Outputs HTML to stdout by default
   - With `-o <file>` flag, writes to specified file
3. **Markdown features**: Handles:
   - Headings (h1-h6)
   - Paragraphs
   - Bold (`**text**`)
   - Italic (`*text*`)
   - Links (`[text](url)`)
   - Code blocks (fenced with ```)
   - Unordered lists (`-` or `*`)
4. **Help flag**: `--help` shows usage information
5. **Exit codes**:
   - Exit 0 on success
   - Exit 1 on error (file not found, invalid input, etc.)

## Examples

```bash
# Basic usage
md2html input.md
# Output: <h1>Title</h1><p>Content...</p>

# Output to file
md2html input.md -o output.html

# Show help
md2html --help
# Output: Usage: md2html <file> [-o output]
```

## Technical Notes

- Use TypeScript with Bun runtime
- Can use a markdown parsing library or implement simple regex-based parsing
- Focus on correctness over completeness - better to handle fewer features well
