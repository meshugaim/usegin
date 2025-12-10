# Google File Search POC

A command-line interface for testing Google's File Search Tool in the Gemini API. This POC demonstrates how to create file search stores, upload documents, and query them using Google's fully managed RAG system.

## Setup

1. **Install dependencies:**
   ```bash
   uv sync
   ```

2. **Configure API key:**
   The API key is already configured in `.env`. If you need to update it, edit:
   ```bash
   GEMINI_API_KEY=your-api-key-here
   ```

## Usage

Run commands using `uv run python main.py <command>` from the `google-file-search-poc/` directory.

**Important:** When specifying file paths (e.g., for the `upload` command), prefer using **absolute paths** (e.g., `/workspaces/test-mvp/README.md`) to avoid issues when using with task runners like `just`. Relative paths are supported but may behave unexpectedly depending on the current working directory.

### Get Help

You can view help information in multiple ways:

```bash
# Show general help
uv run python main.py --help
uv run python main.py -h
uv run python main.py help

# Show help for a specific command
uv run python main.py help <command>
uv run python main.py <command> --help
uv run python main.py <command> -h
```

Examples:
```bash
uv run python main.py help upload
uv run python main.py query --help
```

### Create a File Search Store

```bash
uv run python main.py create-store "my-store-name"
```

This creates a new File Search store and returns its ID (e.g., `fileSearchStores/mystorename-abc123`).

### Upload Files to a Store

```bash
uv run python main.py upload <store-id> <file-path>
```

Example (with absolute path - recommended):
```bash
uv run python main.py upload fileSearchStores/testmvpdocs-h1qk9gkwbt6p /workspaces/test-mvp/README.md
```

Example (with relative path - works but less reliable):
```bash
uv run python main.py upload fileSearchStores/testmvpdocs-h1qk9gkwbt6p ../README.md
```

The upload process automatically waits for the file to be indexed.

### Query a Store

```bash
uv run python main.py query <store-id> "your question here"
```

Example:
```bash
uv run python main.py query fileSearchStores/testmvpdocs-h1qk9gkwbt6p "What package manager is used for Python?"
```

The response includes:
- The AI-generated answer
- Citations showing which documents and sections were used

### List All Stores

```bash
uv run python main.py list-stores
```

Shows all File Search stores with their IDs, names, and creation times.

### Get Store Details

```bash
uv run python main.py get-store <store-id>
```

### Delete a Store

```bash
uv run python main.py delete-store <store-id>
```

### List Files in a Store

```bash
uv run python main.py list-files <store-id>
```

Shows all documents/files in a specific store with their metadata including:
- Document ID
- Display name
- Processing state (PENDING, ACTIVE, FAILED)
- MIME type
- File size
- Creation time

Example:
```bash
uv run python main.py list-files fileSearchStores/testmvpdocs-h1qk9gkwbt6p
```

### Get File Details

```bash
uv run python main.py get-file <document-id>
```

Example:
```bash
uv run python main.py get-file fileSearchStores/testdocs-xyz789/documents/abc123
```

Returns detailed metadata about a specific document including state, MIME type, size, timestamps, and custom metadata.

### Delete a File

```bash
uv run python main.py delete-file <document-id>
```

Example:
```bash
uv run python main.py delete-file fileSearchStores/testdocs-xyz789/documents/abc123
```

Removes a specific document from a store without deleting the entire store.

### Query a Specific File

```bash
uv run python main.py query-file <document-id> "your query here"
```

Example:
```bash
uv run python main.py query-file fileSearchStores/testdocs-xyz789/documents/abc123 "What are the main topics?"
```

Performs semantic search within a single document (as opposed to searching across all documents in a store). Returns relevant chunks with relevance scores.

## Example Workflow

```bash
# 1. Create a store
uv run python main.py create-store "test-docs"
# Output: Store ID: fileSearchStores/testdocs-xyz789

# 2. Upload some documentation (using absolute paths)
uv run python main.py upload fileSearchStores/testdocs-xyz789 /workspaces/test-mvp/README.md
uv run python main.py upload fileSearchStores/testdocs-xyz789 /workspaces/test-mvp/CLAUDE.md

# 3. List all files in the store
uv run python main.py list-files fileSearchStores/testdocs-xyz789
# Output shows document IDs like: fileSearchStores/testdocs-xyz789/documents/abc123

# 4. Query the entire store
uv run python main.py query fileSearchStores/testdocs-xyz789 "How do I deploy to Railway?"

# 5. Query a specific document
uv run python main.py query-file fileSearchStores/testdocs-xyz789/documents/abc123 "What are the key points?"

# 6. Get details of a specific file
uv run python main.py get-file fileSearchStores/testdocs-xyz789/documents/abc123

# 7. Delete a specific file (optional)
uv run python main.py delete-file fileSearchStores/testdocs-xyz789/documents/abc123

# 8. List stores to verify
uv run python main.py list-stores

# 9. Clean up entire store (optional)
uv run python main.py delete-store fileSearchStores/testdocs-xyz789
```

## Technical Details

- **SDK**: `google-genai` (Python >=3.10)
- **Models**: `gemini-2.5-flash` and `gemini-2.5-pro`
- **File Support**: PDF, DOCX, XLSX, PPTX, TXT, MD, HTML, JSON, CSV, YAML, and code files
- **Max File Size**: 100 MB per file
- **Storage**: Free tier includes 1 GB

### Error Handling and Retry Mechanism

The CLI includes robust error handling with exponential backoff retry logic to handle API overload situations:

- **Automatic Retries**: API calls automatically retry on transient errors (rate limits, service unavailable, server errors)
- **Exponential Backoff**: Retry delays increase exponentially (1s, 2s, 4s, 8s, 16s, up to 32s max)
- **Jitter**: Random jitter is added to prevent thundering herd problems
- **Max Retries**: Defaults to 5 retries (configurable)
- **Smart Error Detection**: Only retries on transient errors (429, 500, 503), not on client errors (400, 401, 403, 404)
- **User Feedback**: Clear console messages inform users when retries are happening

#### Retryable Errors
- 429: Rate limit exceeded
- 500: Internal server error
- 503: Service unavailable
- Connection errors and timeouts
- "Overload" errors from Gemini

#### Non-Retryable Errors
- 400: Bad request (client error)
- 401: Unauthorized (authentication issue)
- 403: Forbidden (permission issue)
- 404: Not found

When API overload occurs, you'll see messages like:
```
Retrying due to API overload... (Attempt 1/5, waiting 1.0s)
```

The retry mechanism is applied to all Gemini API calls including:
- Creating, listing, getting, and deleting stores
- Uploading, listing, getting, and deleting files
- Querying stores and documents
- Checking operation status during file uploads

#### Testing the Retry Mechanism

You can test the retry mechanism using the included test suite:

```bash
uv run python test_retry.py
```

This will run a series of tests demonstrating:
- Error classification (retryable vs non-retryable)
- Exponential backoff calculation
- Successful retries after transient failures
- Max retries exceeded behavior
- Non-retryable error handling

## Key Findings

1. **Easy Integration**: The API is straightforward and well-documented
2. **Automatic Citations**: Responses include source attribution showing which documents and sections were referenced
3. **Fast Indexing**: Files are processed and indexed within a few seconds
4. **Good Accuracy**: Responses accurately reflect the content of uploaded documents
5. **Context Awareness**: The system correctly understands technical terminology and project structure

## Next Steps

This POC validates that Google File Search works well for our use case. To integrate into the main application:

1. Consider creating a Python service wrapper for file search operations
2. ~~Implement proper error handling and retry logic~~ (COMPLETED)
3. Add metadata support for more sophisticated filtering
4. Set up monitoring for indexing operations
5. Determine appropriate chunking parameters for our document types
6. Consider making retry configuration tunable via environment variables

## References

- [File Search Documentation](https://ai.google.dev/gemini-api/docs/file-search)
- [Google GenAI SDK](https://googleapis.github.io/python-genai/)
