# NRBPL Test Pack v0.1

Deterministic, LLM-independent test harness for the
Natural-Reflex-Based Programming Language (NRBPL) runtime.

## Requirements

- Node.js >= 18
- bash (or any POSIX shell)

## Files

| File | Purpose |
|------|---------|
| `NRBPL_OPCODE_REGISTRY_v0_1.json` | Canonical opcode definitions and syntax rules |
| `NRBPL_STREAM_VALIDATOR.js` | Validates opcode streams against the registry |
| `NRBPL_RUNTIME_v0_1.js` | Executes streams, builds world state |
| `sample_stream.json` | Example 11-opcode narrative stream |
| `run_test.sh` | End-to-end pipeline runner |

## Quick Start

```bash
chmod +x run_test.sh
./run_test.sh
```

Or run each step manually:

```bash
# Validate
node NRBPL_STREAM_VALIDATOR.js sample_stream.json NRBPL_OPCODE_REGISTRY_v0_1.json

# Execute
node NRBPL_RUNTIME_v0_1.js sample_stream.json final_state.json NRBPL_OPCODE_REGISTRY_v0_1.json

# Verify
sha256sum final_state.json
```

## Expected Output

- Validator: PASS (0 errors)
- Runtime: PASS (11 opcodes, 5+ entities, 11 assertions)
- `final_state.json` created with deterministic state hash
- SHA-256 of output file printed

## Pipeline

```
ASE (narrative) --> Opcode Stream --> Validator --> Runtime --> Canonical State
                                        |                        |
                                   registry.json           final_state.json
```

## Guarantees

- **LLM-independent**: Pure Node.js, no AI calls
- **Deterministic**: Same input always produces same entity graph
- **Hash-auditable**: `state_hash` in output = SHA-256 of canonical state
- **Replayable**: Feed any valid stream, get reproducible state
