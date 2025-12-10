# Google File Search POC module

# Run google-file-search CLI with arguments (e.g., just google-file-search list-stores)
default *args:
    uv run python main.py {{args}}

install:
    uv sync

update:
    uv lock --upgrade && uv sync
