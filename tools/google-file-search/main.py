#!/usr/bin/env python3
"""
Google File Search POC CLI

Commands:
  create-store <name>                  Create a new File Search store
  upload <store-id> <file-path>        Upload a file to a store (prefer absolute paths)
  query <store-id> <query>             Query a store
  list-stores                          List all stores
  get-store <store-id>                 Get store details
  delete-store <store-id>              Delete a store
  list-files <store-id>                List all files/documents in a store
  get-file <document-id>               Get details of a specific file/document
  delete-file <document-id>            Delete a specific file/document from a store
  query-file <document-id> <query>     Search within a specific file/document
  help [command]                       Show help (general or for specific command)

Help Options:
  --help, -h                           Show this help message
  <command> --help                     Show help for a specific command
  help <command>                       Show help for a specific command

Examples:
  main.py --help                       Show this help
  main.py help upload                  Show help for upload command
  main.py upload --help                Show help for upload command

Note: For file paths, absolute paths are preferred (e.g., /workspaces/test-mvp/README.md)
      to avoid issues when using with task runners like just.
"""

import sys
import os
import logging
import requests
import time
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Import retry functionality from separate module
from retry import retry_with_exponential_backoff

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def init_client():
    """Initialize the Gemini client with API key."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not found in environment")
        sys.exit(1)
    return genai.Client(api_key=api_key)

@retry_with_exponential_backoff()
def _create_store_api_call(client, store_name):
    """Internal API call for creating a store with retry logic."""
    return client.file_search_stores.create(
        config={'display_name': store_name}
    )


def create_store(client, store_name):
    """Create a new File Search store."""
    try:
        store = _create_store_api_call(client, store_name)
        print(f"Store created successfully!")
        print(f"Store ID: {store.name}")
        print(f"Store Name: {store.display_name}")
        return store
    except Exception as e:
        print(f"Error creating store: {e}")
        sys.exit(1)

@retry_with_exponential_backoff()
def _upload_file_api_call(client, file_path, store_id, display_name):
    """Internal API call for uploading a file with retry logic."""
    return client.file_search_stores.upload_to_file_search_store(
        file=str(file_path),
        file_search_store_name=store_id,
        config={'display_name': display_name}
    )


@retry_with_exponential_backoff()
def _get_operation_status(client, operation):
    """Internal API call for getting operation status with retry logic."""
    return client.operations.get(operation)


def upload_file(client, store_id, file_path):
    """Upload a file to a File Search store."""
    file_path = Path(file_path)
    if not file_path.exists():
        print(f"Error: File not found: {file_path}")
        sys.exit(1)

    try:
        print(f"Uploading {file_path.name}...")

        # Upload and import file into the File Search store
        operation = _upload_file_api_call(client, file_path, store_id, file_path.name)

        print(f"File uploaded, waiting for import to complete...")

        # Wait until import is complete
        while not operation.done:
            time.sleep(2)
            operation = _get_operation_status(client, operation)
            print(".", end="", flush=True)

        print()  # New line after dots
        print(f"File imported successfully!")
        print(f"Operation: {operation.name}")

    except Exception as e:
        print(f"Error uploading file: {e}")
        sys.exit(1)

@retry_with_exponential_backoff()
def _query_store_api_call(client, store_id, query_text):
    """Internal API call for querying a store with retry logic."""
    return client.models.generate_content(
        model='gemini-2.5-flash',
        contents=query_text,
        config=types.GenerateContentConfig(
            tools=[
                types.Tool(
                    file_search=types.FileSearch(
                        file_search_store_names=[store_id]
                    )
                )
            ]
        )
    )


def query_store(client, store_id, query_text):
    """Query a File Search store."""
    try:
        print(f"Querying: {query_text}\n")

        response = _query_store_api_call(client, store_id, query_text)

        print("Response:")
        print("=" * 80)
        print(response.text)
        print("=" * 80)

        # Show citations if available
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                print("\nCitations/Sources:")
                print("-" * 80)
                grounding_metadata = candidate.grounding_metadata

                # Try to extract citation information
                if hasattr(grounding_metadata, 'grounding_chunks'):
                    for chunk in grounding_metadata.grounding_chunks:
                        print(f"Chunk: {chunk}")
                else:
                    print(f"Grounding metadata: {grounding_metadata}")

    except Exception as e:
        print(f"Error querying store: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

@retry_with_exponential_backoff()
def _list_stores_api_call(client):
    """Internal API call for listing stores with retry logic."""
    return list(client.file_search_stores.list())


def list_stores(client):
    """List all File Search stores."""
    try:
        stores = _list_stores_api_call(client)

        if not stores:
            print("No stores found")
            return

        print("File Search Stores:")
        print("=" * 80)
        for store in stores:
            print(f"ID: {store.name}")
            print(f"Display Name: {store.display_name if hasattr(store, 'display_name') else 'N/A'}")
            print(f"Create Time: {store.create_time if hasattr(store, 'create_time') else 'N/A'}")
            print("-" * 80)
    except Exception as e:
        print(f"Error listing stores: {e}")
        sys.exit(1)

@retry_with_exponential_backoff()
def _get_store_api_call(client, store_id):
    """Internal API call for getting a store with retry logic."""
    return client.file_search_stores.get(name=store_id)


def get_store(client, store_id):
    """Get details of a specific store."""
    try:
        store = _get_store_api_call(client, store_id)

        print("Store Details:")
        print("=" * 80)
        print(f"ID: {store.name}")
        print(f"Display Name: {store.display_name if hasattr(store, 'display_name') else 'N/A'}")
        print(f"Create Time: {store.create_time if hasattr(store, 'create_time') else 'N/A'}")
        print(f"Update Time: {store.update_time if hasattr(store, 'update_time') else 'N/A'}")

    except Exception as e:
        print(f"Error getting store: {e}")
        sys.exit(1)

@retry_with_exponential_backoff()
def _delete_store_api_call(client, store_id):
    """Internal API call for deleting a store with retry logic."""
    return client.file_search_stores.delete(name=store_id)


def delete_store(client, store_id):
    """Delete a File Search store."""
    try:
        _delete_store_api_call(client, store_id)
        print(f"Store deleted successfully: {store_id}")
    except Exception as e:
        print(f"Error deleting store: {e}")
        sys.exit(1)

@retry_with_exponential_backoff()
def _list_files_api_call(client, store_id):
    """Internal API call for listing files with retry logic."""
    return list(client.file_search_stores.documents.list(parent=store_id))


def list_files(client, store_id):
    """List all files/documents in a File Search store."""
    try:
        documents = _list_files_api_call(client, store_id)

        if not documents:
            print(f"No documents found in store: {store_id}")
            return

        print(f"Documents in {store_id}:")
        print("=" * 80)
        for doc in documents:
            print(f"ID: {doc.name}")
            print(f"Display Name: {doc.display_name if hasattr(doc, 'display_name') else 'N/A'}")
            print(f"State: {doc.state if hasattr(doc, 'state') else 'N/A'}")
            print(f"MIME Type: {doc.mime_type if hasattr(doc, 'mime_type') else 'N/A'}")
            print(f"Size: {doc.size_bytes if hasattr(doc, 'size_bytes') else 'N/A'} bytes")
            print(f"Create Time: {doc.create_time if hasattr(doc, 'create_time') else 'N/A'}")
            print("-" * 80)
    except Exception as e:
        print(f"Error listing documents: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

@retry_with_exponential_backoff()
def _get_file_api_call(client, document_id):
    """Internal API call for getting a file with retry logic."""
    return client.file_search_stores.documents.get(name=document_id)


def get_file(client, document_id):
    """Get details of a specific document."""
    try:
        doc = _get_file_api_call(client, document_id)

        print("Document Details:")
        print("=" * 80)
        print(f"ID: {doc.name}")
        print(f"Display Name: {doc.display_name if hasattr(doc, 'display_name') else 'N/A'}")
        print(f"State: {doc.state if hasattr(doc, 'state') else 'N/A'}")
        print(f"MIME Type: {doc.mime_type if hasattr(doc, 'mime_type') else 'N/A'}")
        print(f"Size: {doc.size_bytes if hasattr(doc, 'size_bytes') else 'N/A'} bytes")
        print(f"Create Time: {doc.create_time if hasattr(doc, 'create_time') else 'N/A'}")
        print(f"Update Time: {doc.update_time if hasattr(doc, 'update_time') else 'N/A'}")

        # Show metadata if available
        if hasattr(doc, 'metadata') and doc.metadata:
            print(f"Metadata: {doc.metadata}")

    except Exception as e:
        print(f"Error getting document: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

@retry_with_exponential_backoff()
def _delete_file_api_call(client, document_id):
    """Internal API call for deleting a file with retry logic."""
    return client.file_search_stores.documents.delete(name=document_id)


def delete_file(client, document_id):
    """Delete a specific document from a store."""
    try:
        _delete_file_api_call(client, document_id)
        print(f"Document deleted successfully: {document_id}")
    except Exception as e:
        print(f"Error deleting document: {e}")
        sys.exit(1)

@retry_with_exponential_backoff()
def _query_file_api_call(api_key, document_id, query_text, results_count=10):
    """Internal API call for querying a document with retry logic using REST API."""
    url = f"https://generativelanguage.googleapis.com/v1beta/{document_id}:query"
    headers = {
        "Content-Type": "application/json"
    }
    params = {
        "key": api_key
    }
    body = {
        "query": query_text,
        "resultsCount": results_count
    }

    response = requests.post(url, headers=headers, params=params, json=body)
    response.raise_for_status()
    return response.json()


def query_file(client, document_id, query_text):
    """Query/search within a specific document."""
    try:
        print(f"Querying document: {query_text}\n")

        # Get API key from environment
        api_key = os.getenv("GEMINI_API_KEY")

        # Query the specific document using REST API
        response = _query_file_api_call(api_key, document_id, query_text)

        print("Search Results:")
        print("=" * 80)

        # Display relevant chunks/results
        if 'relevantChunks' in response and response['relevantChunks']:
            for i, chunk in enumerate(response['relevantChunks'], 1):
                print(f"\n[Result {i}]")
                print(f"Relevance: {chunk.get('chunkRelevanceScore', 'N/A')}")
                if 'chunk' in chunk and 'data' in chunk['chunk']:
                    chunk_data = chunk['chunk']['data']
                    print(f"Content: {chunk_data.get('stringValue', chunk_data)}")
                print("-" * 80)
        else:
            print("No results found or response format not as expected")
            print(f"Response: {response}")

    except Exception as e:
        print(f"Error querying document: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

def print_usage():
    """Print usage information."""
    print(__doc__)
    sys.exit(0)

def print_command_help(command):
    """Print help for a specific command."""
    help_text = {
        'create-store': """
Create a new File Search store

Usage: main.py create-store <name>

Arguments:
  <name>    Display name for the store

Examples:
  main.py create-store "My Documents"
  main.py create-store project-files
""",
        'upload': """
Upload a file to a File Search store

Usage: main.py upload <store-id> <file-path>

Arguments:
  <store-id>    ID of the File Search store
  <file-path>   Path to the file to upload (prefer absolute paths)

Note: Absolute paths are recommended (e.g., /workspaces/test-mvp/README.md)
      to avoid issues when using with task runners like just.

Examples:
  main.py upload fileSearchStores/abc123 /workspaces/test-mvp/README.md
  main.py upload fileSearchStores/abc123 ./document.pdf
""",
        'query': """
Query a File Search store

Usage: main.py query <store-id> <query>

Arguments:
  <store-id>    ID of the File Search store
  <query>       Search query (can be multiple words)

Examples:
  main.py query fileSearchStores/abc123 "What is the main purpose?"
  main.py query fileSearchStores/abc123 summarize the key points
""",
        'list-stores': """
List all File Search stores

Usage: main.py list-stores

Examples:
  main.py list-stores
""",
        'get-store': """
Get details of a specific store

Usage: main.py get-store <store-id>

Arguments:
  <store-id>    ID of the File Search store

Examples:
  main.py get-store fileSearchStores/abc123
""",
        'delete-store': """
Delete a File Search store

Usage: main.py delete-store <store-id>

Arguments:
  <store-id>    ID of the File Search store to delete

Examples:
  main.py delete-store fileSearchStores/abc123
""",
        'list-files': """
List all files/documents in a File Search store

Usage: main.py list-files <store-id>

Arguments:
  <store-id>    ID of the File Search store

Examples:
  main.py list-files fileSearchStores/abc123
""",
        'get-file': """
Get details of a specific file/document

Usage: main.py get-file <document-id>

Arguments:
  <document-id>    ID of the document (format: fileSearchStores/{store}/documents/{doc})

Examples:
  main.py get-file fileSearchStores/abc123/documents/xyz789
""",
        'delete-file': """
Delete a specific file/document from a store

Usage: main.py delete-file <document-id>

Arguments:
  <document-id>    ID of the document to delete

Examples:
  main.py delete-file fileSearchStores/abc123/documents/xyz789
""",
        'query-file': """
Search within a specific file/document

Usage: main.py query-file <document-id> <query>

Arguments:
  <document-id>    ID of the document to query
  <query>          Search query (can be multiple words)

Examples:
  main.py query-file fileSearchStores/abc123/documents/xyz789 "find section about API"
  main.py query-file fileSearchStores/abc123/documents/xyz789 summarize key points
"""
    }

    if command in help_text:
        print(help_text[command])
    else:
        print(f"No help available for command: {command}")
        print_usage()
    sys.exit(0)

def main():
    if len(sys.argv) < 2:
        print_usage()

    command = sys.argv[1]

    # Handle help command and flags
    if command in ["help", "--help", "-h"]:
        if len(sys.argv) >= 3:
            # Help for specific command
            print_command_help(sys.argv[2])
        else:
            print_usage()

    # Check for help flag in any subcommand
    if len(sys.argv) >= 3 and sys.argv[2] in ["--help", "-h"]:
        print_command_help(command)

    client = init_client()

    if command == "create-store":
        if len(sys.argv) < 3:
            print("Usage: main.py create-store <name>")
            print("Try 'main.py create-store --help' for more information")
            sys.exit(1)
        create_store(client, sys.argv[2])

    elif command == "upload":
        if len(sys.argv) < 4:
            print("Usage: main.py upload <store-id> <file-path>")
            print("Try 'main.py upload --help' for more information")
            sys.exit(1)
        upload_file(client, sys.argv[2], sys.argv[3])

    elif command == "query":
        if len(sys.argv) < 4:
            print("Usage: main.py query <store-id> <query>")
            print("Try 'main.py query --help' for more information")
            sys.exit(1)
        query_text = " ".join(sys.argv[3:])
        query_store(client, sys.argv[2], query_text)

    elif command == "list-stores":
        list_stores(client)

    elif command == "get-store":
        if len(sys.argv) < 3:
            print("Usage: main.py get-store <store-id>")
            print("Try 'main.py get-store --help' for more information")
            sys.exit(1)
        get_store(client, sys.argv[2])

    elif command == "delete-store":
        if len(sys.argv) < 3:
            print("Usage: main.py delete-store <store-id>")
            print("Try 'main.py delete-store --help' for more information")
            sys.exit(1)
        delete_store(client, sys.argv[2])

    elif command == "list-files":
        if len(sys.argv) < 3:
            print("Usage: main.py list-files <store-id>")
            print("Try 'main.py list-files --help' for more information")
            sys.exit(1)
        list_files(client, sys.argv[2])

    elif command == "get-file":
        if len(sys.argv) < 3:
            print("Usage: main.py get-file <document-id>")
            print("Try 'main.py get-file --help' for more information")
            sys.exit(1)
        get_file(client, sys.argv[2])

    elif command == "delete-file":
        if len(sys.argv) < 3:
            print("Usage: main.py delete-file <document-id>")
            print("Try 'main.py delete-file --help' for more information")
            sys.exit(1)
        delete_file(client, sys.argv[2])

    elif command == "query-file":
        if len(sys.argv) < 4:
            print("Usage: main.py query-file <document-id> <query>")
            print("Try 'main.py query-file --help' for more information")
            sys.exit(1)
        query_text = " ".join(sys.argv[3:])
        query_file(client, sys.argv[2], query_text)

    else:
        print(f"Unknown command: {command}")
        print_usage()

if __name__ == "__main__":
    main()
