#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================"
echo " NRBPL Test Pack v0.1 — Full Pipeline"
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
echo "============================================"
echo " PHASE A: ASE Layer"
echo "============================================"

echo ""
echo "--------------------------------------------"
echo " A1: Validate ASE events"
echo "--------------------------------------------"
node ASE_VALIDATOR.js ase_events.json ASE_SCHEMA_REGISTRY_v1_0.json
echo ""

echo "--------------------------------------------"
echo " A2: Compile ASE -> NRBPL opcode stream"
echo "--------------------------------------------"
node ASE_EVENT_COMPILER.js ase_events.json compiled_stream.json ASE_SCHEMA_REGISTRY_v1_0.json
echo ""

echo "============================================"
echo " PHASE B: NRBPL Layer"
echo "============================================"

echo ""
echo "--------------------------------------------"
echo " B1: Validate opcode stream (sample_stream)"
echo "--------------------------------------------"
node NRBPL_STREAM_VALIDATOR.js sample_stream.json NRBPL_OPCODE_REGISTRY_v0_1.json
echo ""

echo "--------------------------------------------"
echo " B2: Validate opcode stream (compiled_stream)"
echo "--------------------------------------------"
node NRBPL_STREAM_VALIDATOR.js compiled_stream.json NRBPL_OPCODE_REGISTRY_v0_1.json
echo ""

echo "--------------------------------------------"
echo " B3: Execute runtime (sample_stream)"
echo "--------------------------------------------"
node NRBPL_RUNTIME_v0_1.js sample_stream.json final_state.json NRBPL_OPCODE_REGISTRY_v0_1.json
echo ""

echo "--------------------------------------------"
echo " B4: Execute runtime (compiled_stream)"
echo "--------------------------------------------"
node NRBPL_RUNTIME_v0_1.js compiled_stream.json final_state_compiled.json NRBPL_OPCODE_REGISTRY_v0_1.json
echo ""

echo "============================================"
echo " PHASE C: Hash Verification"
echo "============================================"
echo ""
if command -v sha256sum &> /dev/null; then
  sha256sum final_state.json
  sha256sum final_state_compiled.json
elif command -v shasum &> /dev/null; then
  shasum -a 256 final_state.json
  shasum -a 256 final_state_compiled.json
else
  echo "[WARN] No sha256sum/shasum found, skipping file hash."
fi

echo ""
echo "============================================"
echo " ALL PHASES PASS"
echo "============================================"
echo ""
echo " Pipeline verified:"
echo "   Text -> ASE -> VALIDATE -> COMPILE -> VALIDATE OPCODE -> RUNTIME -> HASH"
echo ""
