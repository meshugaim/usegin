#!/usr/bin/env python3
"""Inspect the SDK to see what methods are available."""

import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

# Initialize client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Inspect the file_search_stores.documents object
print("=== Inspecting client.file_search_stores.documents ===")
documents_obj = client.file_search_stores.documents
print(f"Type: {type(documents_obj)}")
print(f"\nAvailable attributes and methods:")
for attr in dir(documents_obj):
    if not attr.startswith('_'):
        print(f"  - {attr}")

# Let's also check what types are available
print("\n=== Checking genai.types for QueryDocumentConfig ===")
from google.genai import types
if hasattr(types, 'QueryDocumentConfig'):
    print("QueryDocumentConfig exists!")
else:
    print("QueryDocumentConfig does NOT exist")

# List all types that contain 'Query' or 'Document'
print("\n=== Types containing 'Query' or 'Document' ===")
for attr in dir(types):
    if 'query' in attr.lower() or 'document' in attr.lower():
        print(f"  - {attr}")
