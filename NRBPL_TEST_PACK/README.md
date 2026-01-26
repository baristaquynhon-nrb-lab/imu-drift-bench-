# NRBPL Test Pack v0.1

Deterministic, LLM-independent test harness for the
Natural-Reflex-Based Programming Language (NRBPL) runtime.

## Requirements

- Node.js >= 18
- bash (or any POSIX shell)

## Files

### ASE Layer (Semantic IR)

| File | Purpose |
|------|---------|
| `ASE_SPEC_v1_0.md` | Agent-Schema-Event specification (normative) |
| `ASE_SCHEMA_REGISTRY_v1_0.json` | Machine-readable ASE schema registry (21 schemas) |
| `ASE_COMPLIANCE_TEST_SUITE_v1_0.md` | PASS/REFUSE/INSUFFICIENT test cases |
| `ASE_VALIDATOR.js` | Validates ASE events against schema registry |
| `ASE_EVENT_COMPILER.js` | Compiles ASE events to NRBPL opcode stream |
| `ase_events.json` | Sample 11-event Christmas narrative (ASE format) |

### NRBPL Layer (Opcode Execution)

| File | Purpose |
|------|---------|
| `NRBPL_OPCODE_REGISTRY_v0_1.json` | Frozen opcode registry mapped from ASE v1.0 (19 opcodes) |
| `NRBPL_STREAM_VALIDATOR.js` | Validates opcode streams (UGTS exit codes: 0/2/3) |
| `NRBPL_RUNTIME_v0_1.js` | Executes streams, builds world state + SHA-256 hash |
| `NRBPL_CANONICALIZER_v0_1.js` | Byte-stable canonical state + deterministic hash |
| `sample_stream.json` | Example 11-opcode narrative stream |
| `run_test.sh` | Phase-by-phase test runner (ASE + NRBPL) |
| `run_full_pipeline.sh` | Full 6-step orchestrator (validate → canonicalize) |
| `verify_hash.sh` | SHA-256 verification of all output files |

## Quick Start

```bash
chmod +x run_full_pipeline.sh verify_hash.sh run_test.sh
./run_full_pipeline.sh
./verify_hash.sh
```

Or run the phase-by-phase test:

```bash
./run_test.sh
```

Or run each step manually:

```bash
# --- ASE Layer ---
node ASE_VALIDATOR.js ase_events.json ASE_SCHEMA_REGISTRY_v1_0.json
node ASE_EVENT_COMPILER.js ase_events.json compiled_stream.json ASE_SCHEMA_REGISTRY_v1_0.json

# --- NRBPL Layer ---
node NRBPL_STREAM_VALIDATOR.js compiled_stream.json NRBPL_OPCODE_REGISTRY_v0_1.json
node NRBPL_RUNTIME_v0_1.js compiled_stream.json final_state.json NRBPL_OPCODE_REGISTRY_v0_1.json
node NRBPL_CANONICALIZER_v0_1.js final_state.json canonical_state.json

# --- Verify ---
sha256sum canonical_state.json
```

## Pipeline

```
ASE Events -> VALIDATE -> COMPILE -> VALIDATE OPCODE -> RUNTIME -> CANONICALIZE -> HASH
    |            |           |             |                |            |            |
ase_events  ASE_VALIDATOR COMPILER  STREAM_VALIDATOR    RUNTIME   CANONICALIZER   SHA-256
                 |           |             |                |            |
            registry   compiled_stream  opcode_reg   final_state  canonical_state
```

## Exit Codes (UGTS)

| Code | Meaning |
|------|---------|
| 0 | **PASS** |
| 2 | **FAIL** (IO/format error) |
| 3 | **REFUSE** (spec/gate violation) |

## ASE Specification

The [ASE Spec v1.0](ASE_SPEC_v1_0.md) defines the canonical semantic IR upstream of NRBPL:

- 21 closed-class schemas (TEMPORAL_CONTEXT, GIFT_GIVING, EMOTIONAL_STATE, etc.)
- Language-neutral event graph (EN ↔ VI deterministic mapping)
- UGTS gate integration (fail-fast on missing agent, unknown schema, injection)
- Compliance levels: ASE-C0 (schema), ASE-C1 (+alignment), ASE-C2 (+UGTS gate)

See [Compliance Test Suite](ASE_COMPLIANCE_TEST_SUITE_v1_0.md) for PASS/REFUSE test cases.

## Outputs

| File | Description |
|------|-------------|
| `compiled_stream.json` | NRBPL opcode stream compiled from ASE events |
| `final_state.json` | Raw world state from runtime |
| `canonical_state.json` | Byte-stable canonical state (sorted keys, no timestamp) |

## Guarantees

- **LLM-independent**: Pure Node.js, no AI calls
- **Deterministic**: Same input always produces same canonical JSON
- **Hash-auditable**: `state_hash_canonical` = SHA-256 of canonical world state
- **Replayable**: Feed any valid stream, get reproducible state
- **Schema-locked**: Only registered ASE schemas and NRBPL opcodes accepted
- **UGTS-gated**: REFUSE on missing roles, unknown schemas, style contamination
- **Byte-stable**: Canonicalizer strips timestamps, sorts all keys for cross-machine reproducibility
