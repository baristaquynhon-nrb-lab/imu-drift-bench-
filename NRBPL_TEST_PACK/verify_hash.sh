#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================"
echo " SHA-256 Hash Verification"
echo "============================================"
echo ""

for FILE in canonical_state.json final_state.json compiled_stream.json; do
  if [ -f "$FILE" ]; then
    if command -v sha256sum &> /dev/null; then
      sha256sum "$FILE"
    elif command -v shasum &> /dev/null; then
      shasum -a 256 "$FILE"
    else
      echo "[WARN] No SHA tool available for $FILE"
    fi
  else
    echo "[SKIP] $FILE not found"
  fi
done

echo ""
echo "============================================"
