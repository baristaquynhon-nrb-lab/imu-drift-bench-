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
| `sample_stream.json` | Example 11-opcode narrative stream |
| `run_test.sh` | Full pipeline runner (ASE + NRBPL phases) |

## Quick Start

```bash
chmod +x run_test.sh
./run_test.sh
```

Or run each phase manually:

```bash
# --- Phase A: ASE Layer ---
# A1: Validate ASE events
node ASE_VALIDATOR.js ase_events.json ASE_SCHEMA_REGISTRY_v1_0.json

# A2: Compile ASE -> NRBPL opcodes
node ASE_EVENT_COMPILER.js ase_events.json compiled_stream.json ASE_SCHEMA_REGISTRY_v1_0.json

# --- Phase B: NRBPL Layer ---
# B1: Validate opcode stream
node NRBPL_STREAM_VALIDATOR.js sample_stream.json NRBPL_OPCODE_REGISTRY_v0_1.json

# B2: Execute runtime
node NRBPL_RUNTIME_v0_1.js sample_stream.json final_state.json NRBPL_OPCODE_REGISTRY_v0_1.json

# B3: Hash verify
sha256sum final_state.json
```

## Pipeline

```
Text -> ASE Event Graph -> VALIDATE -> COMPILE -> VALIDATE OPCODE -> RUNTIME -> HASH
          |                   |           |             |                |         |
     ase_events.json    ASE_VALIDATOR  COMPILER   STREAM_VALIDATOR   RUNTIME   SHA-256
                              |           |             |                |
                         registry    compiled_stream  opcode_reg    final_state
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

## Guarantees

- **LLM-independent**: Pure Node.js, no AI calls
- **Deterministic**: Same input always produces same entity graph
- **Hash-auditable**: `state_hash` in output = SHA-256 of canonical state
- **Replayable**: Feed any valid stream, get reproducible state
- **Schema-locked**: Only registered ASE schemas and NRBPL opcodes accepted
- **UGTS-gated**: REFUSE on missing roles, unknown schemas, style contamination
