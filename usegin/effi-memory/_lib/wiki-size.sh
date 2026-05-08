#!/usr/bin/env bash
# Measure the size of an effi-memory wiki — files, lines, bytes, words, rough tokens.
# Usage: wiki-size.sh <wiki-root>
# Default: usegin/effi-memory/askeffi-app-really
set -euo pipefail

root="${1:-$(dirname "$0")/../askeffi-app-really}"
root="$(cd "$root" && pwd)"

echo "wiki root: $root"
echo

# Counts per file kind
mapfile -t files < <(find "$root" -name '*.md' -not -path '*/_archive/*' | sort)
total_lines=0
total_bytes=0
total_words=0

printf "%-50s %8s %8s %8s\n" "file" "lines" "bytes" "words"
printf "%-50s %8s %8s %8s\n" "----" "-----" "-----" "-----"

for f in "${files[@]}"; do
  rel="${f#$root/}"
  lines=$(wc -l < "$f")
  bytes=$(wc -c < "$f")
  words=$(wc -w < "$f")
  total_lines=$((total_lines + lines))
  total_bytes=$((total_bytes + bytes))
  total_words=$((total_words + words))
  printf "%-50s %8d %8d %8d\n" "$rel" "$lines" "$bytes" "$words"
done

echo
printf "%-50s %8d %8d %8d\n" "TOTAL (${#files[@]} files)" "$total_lines" "$total_bytes" "$total_words"

# Rough token estimate: ~0.75 tokens per word (English prose), or bytes / 4 (rough)
tokens_words=$((total_words * 4 / 3))
tokens_bytes=$((total_bytes / 4))

echo
echo "rough token estimate (words × 4/3): ~$tokens_words"
echo "rough token estimate (bytes ÷ 4):   ~$tokens_bytes"

# What would be in the system-prompt prefix under architecture B
echo
echo "--- Architecture-B preload candidates (system-prompt prefix) ---"
prefix_files=()
for f in "${files[@]}"; do
  case "$(basename "$f")" in
    MEMORY.md|_conventions.md|_architecture.md) prefix_files+=("$f");;
    *) [[ "$f" == */moc/* ]] && prefix_files+=("$f");;
  esac
done

prefix_lines=0; prefix_bytes=0; prefix_words=0
for f in "${prefix_files[@]}"; do
  prefix_lines=$((prefix_lines + $(wc -l < "$f")))
  prefix_bytes=$((prefix_bytes + $(wc -c < "$f")))
  prefix_words=$((prefix_words + $(wc -w < "$f")))
done

echo "files in prefix: ${#prefix_files[@]}"
echo "prefix bytes:    $prefix_bytes"
echo "prefix words:    $prefix_words"
echo "prefix tokens (words × 4/3): ~$((prefix_words * 4 / 3))"
