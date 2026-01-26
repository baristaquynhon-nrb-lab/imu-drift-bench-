#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================"
echo " NRBPL Execution Pack v0.1"
echo "============================================"
echo ""

echo "[1/7] Checking Node.js..."
NODE_VER=$(node -v 2>/dev/null || echo "NONE")
echo "Node version: $NODE_VER"
if [ "$NODE_VER" = "NONE" ]; then
  echo "[FAIL] Node.js not found (>=18 required)"
  exit 2
fi
echo ""

echo "--------------------------------------------"
echo "[2/7] Validate ASE events"
echo "--------------------------------------------"
node ASE_VALIDATOR.js ase_events.json ASE_SCHEMA_REGISTRY_v1_0.json
echo ""

echo "--------------------------------------------"
echo "[3/7] Compile ASE -> NRBPL opcode stream"
echo "--------------------------------------------"
node ASE_EVENT_COMPILER.js ase_events.json compiled_stream.json ASE_SCHEMA_REGISTRY_v1_0.json
echo ""

echo "--------------------------------------------"
echo "[4/7] Validate opcode stream"
echo "--------------------------------------------"
node NRBPL_STREAM_VALIDATOR.js compiled_stream.json NRBPL_OPCODE_REGISTRY_v0_1.json
echo ""

echo "--------------------------------------------"
echo "[5/7] Execute runtime"
echo "--------------------------------------------"
node NRBPL_RUNTIME_v0_1.js compiled_stream.json final_state.json NRBPL_OPCODE_REGISTRY_v0_1.json
echo ""

echo "--------------------------------------------"
echo "[6/7] Canonicalize state"
echo "--------------------------------------------"
node NRBPL_CANONICALIZER_v0_1.js final_state.json canonical_state.json
echo ""

echo "--------------------------------------------"
echo "[7/7] Hash gate verification"
echo "--------------------------------------------"
node NRBPL_HASH_GATE_v0_1.js canonical_state.json expected_hashes.json
echo ""

echo "============================================"
echo " NRBPL Pipeline COMPLETE — ALL GATES PASS"
echo "============================================"
echo ""
echo " Files produced:"
echo "   compiled_stream.json    (opcode stream from ASE)"
echo "   final_state.json        (raw runtime output)"
echo "   canonical_state.json    (byte-stable canonical output)"
echo ""
echo " Pipeline:"
echo "   ASE -> VALIDATE -> COMPILE -> VALIDATE -> RUNTIME -> CANONICALIZE -> HASH GATE"
echo ""
