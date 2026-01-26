#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================"
echo " NRBPL Test Pack v0.1"
echo "============================================"
echo ""

# Pre-flight: check Node version
NODE_VER=$(node -v 2>/dev/null || echo "NONE")
echo "[PRE-FLIGHT] Node version: $NODE_VER"
if [ "$NODE_VER" = "NONE" ]; then
  echo "[FAIL] Node.js not found. Requires >= 18."
  exit 2
fi

echo ""
echo "--------------------------------------------"
echo " Step 1: Validate opcode stream"
echo "--------------------------------------------"
node NRBPL_STREAM_VALIDATOR.js sample_stream.json NRBPL_OPCODE_REGISTRY_v0_1.json
echo ""

echo "--------------------------------------------"
echo " Step 2: Execute runtime"
echo "--------------------------------------------"
node NRBPL_RUNTIME_v0_1.js sample_stream.json final_state.json NRBPL_OPCODE_REGISTRY_v0_1.json
echo ""

echo "--------------------------------------------"
echo " Step 3: Hash verification"
echo "--------------------------------------------"
if command -v sha256sum &> /dev/null; then
  sha256sum final_state.json
elif command -v shasum &> /dev/null; then
  shasum -a 256 final_state.json
else
  echo "[WARN] No sha256sum/shasum found, skipping file hash."
fi
echo ""

echo "============================================"
echo " NRBPL pipeline PASS"
echo "============================================"
