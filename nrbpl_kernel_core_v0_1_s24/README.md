# NRBPL Kernel-CORE v0.1

**Neuro-Reflex Barrier Programming Language — Execution Kernel**

[![Node.js](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Research-blue)](./NOTICE.txt)
[![Version](https://img.shields.io/badge/version-0.1.0-orange)](./package.json)

---

## Overview

NRBPL Kernel-CORE v0.1 is the **execution kernel** for the NRBPL programming language, implementing:

- **Section E**: ISA opcode semantics (stack-based VM)
- **Section K**: Provenance Record (PR) model with ΔC/ΔS/ΔP evidence
- **Section D**: Hash-chain ledger with append/replay/verify
- **Section V**: Verdict propagation discipline (REFUSE > FAIL > PASS)
- **Trial Protocol**: Forensic verification and deterministic replay

This implementation is based on the **Condition–Phenomenon Law (CPL)** and **Universal Grounded Truth System (UGTS)** framework.

---

## Key Features

✅ **End-to-End Verification**
- Evidence → PR → Ledger → Replay/Verify chain
- SHA-256 hash-chain integrity
- Deterministic canonical JSON serialization

✅ **Fail-Fast Discipline**
- REFUSE > FAIL > PASS verdict ordering
- Verdict propagation across operations
- No ungrounded assertions allowed

✅ **Dictionary Integration**
- JSON-pack dictionary format (Kernel-CORE v0.1)
- Fast lemma lookup with evidence generation
- Dictionary hash binding to PR

✅ **Forensic Ready**
- Complete audit trail in ledger
- Tamper-evident hash chain
- Deterministic replay from ledger

---

## Architecture

```
nrbpl_kernel_core_v0_1_s24/
├── src/
│   ├── runtime/          # Core runtime (PR, ledger, verdict, hash)
│   ├── pack/             # Dictionary pack format
│   ├── lexicon/          # Dictionary index and lookup
│   ├── vm/               # Virtual machine execution engine
│   └── nl/               # NL Programming (NEW!)
│       ├── nl_parser.js      # NL → Intent/Slots
│       ├── cnl_generator.js  # Intent/Slots → CNL
│       ├── cnl_to_ir.js      # CNL → IR
│       ├── ir_to_opcodes.js  # IR → Opcodes
│       ├── nl_pipeline.js    # End-to-end pipeline
│       └── NL_LEXICON_VI_EN_v0_1.json  # NL patterns
├── docs/
│   └── spec/
│       └── NRBPL_NL_CNL_GRAMMAR_v0_1.md  # Normative grammar
├── bin/
│   └── nrbcore.js        # CLI entry point
├── test/
│   ├── run_all.js        # Core test suite
│   └── nl/
│       ├── run_nl_suite.js           # NL test runner
│       └── NL_TEST_SUITE_v0_1.json   # NL test cases
├── _audit/               # Audit logs (generated)
└── examples/
    ├── en_en_lex_min.nrbp-dict.json      # Example dictionary
    └── prog_lookup_pr_ledger.json         # Example program
```

---

## Installation

```bash
cd nrbpl_kernel_core_v0_1_s24
npm install  # (no dependencies required for Kernel-CORE v0.1)
chmod +x bin/nrbcore.js
```

---

## Usage

### Run Example Program

```bash
node bin/nrbcore.js run examples/prog_lookup_pr_ledger.json examples/en_en_lex_min.nrbp-dict.json
```

This will:
1. Load the dictionary pack
2. Execute the program (DICT_LOOKUP operations)
3. Emit PRs for each operation
4. Append PRs to ledger
5. Verify ledger integrity
6. Write `trial_ledger.json`

### Verify Ledger

```bash
node bin/nrbcore.js verify trial_ledger.json
```

### Replay Ledger

```bash
node bin/nrbcore.js replay trial_ledger.json
```

### Run Test Suite

```bash
npm test           # Core tests (25 tests)
npm run test-nl    # NL Programming tests (10 tests)
npm run test-all   # All tests
```

---

## NL Programming v0.1 (NEW!)

NRBPL now supports **Natural Language Programming** — write programs in Vietnamese or English natural language that compile to CNL, IR, and finally Kernel opcodes.

### Usage

```bash
# Vietnamese
node bin/nrbcore.js nl "Tra từ 'hello' trong từ điển examples/en_en_lex_min.nrbp-dict.json"

# English
node bin/nrbcore.js nl "lookup 'world' in dictionary examples/en_en_lex_min.nrbp-dict.json" --lang=en

# Verify ledger
node bin/nrbcore.js nl "Kiểm tra sổ cái trial_ledger.json"

# Assert found
node bin/nrbcore.js nl "Xác nhận có kết quả"
```

### Pipeline: NL → CNL → IR → Opcodes

The NL command processes input through 4 stages:

1. **NL → Intent/Slots** (via regex patterns from `NL_LEXICON_VI_EN_v0_1.json`)
2. **Intent/Slots → CNL** (Controlled Natural Language with strict grammar)
3. **CNL → IR** (Intermediate Representation)
4. **IR → Opcodes** (VM-compatible instruction format)

### Supported NL Commands (v0.1)

| Vietnamese | English | Intent |
|------------|---------|--------|
| `Tra từ '<lemma>' trong từ điển <pack>` | `lookup '<lemma>' in dictionary <pack>` | DICT_LOOKUP |
| `Xác nhận có kết quả` | `assert found` | ASSERT_FOUND |
| `Kiểm tra sổ cái <path>` | `verify ledger <path>` | LEDGER_VERIFY |
| `Chạy lại sổ cái <path>` | `replay ledger <path>` | LEDGER_REPLAY |

### Fail-Fast Discipline

NL Programming follows strict **REFUSE > FAIL > PASS** discipline:

- **REFUSE** if: intent not recognized, missing required slot, invalid characters, injection attempt
- **PASS** if: all validation passes and CNL/IR/opcodes generated successfully

### Example Output

```
=== CNL Program ===
NRBPL_CNL v0.1
TASK DICT_LOOKUP lemma='hello' using_pack='examples/en_en_lex_min.nrbp-dict.json'
HALT

=== IR (Intermediate Representation) ===
{
  "version": "0.1",
  "instructions": [
    { "type": "DICT_LOOKUP", "lemma": "hello", "using_pack": "..." },
    { "type": "HALT" }
  ]
}

=== Opcodes Program ===
{
  "program_name": "NL-Generated Program",
  "instructions": [
    { "op": "DICT_LOOKUP", "args": { "dict_id": "en_en_lex_min", "lemma": "hello" } },
    { "op": "HALT", "args": { "reason": "NL program completed" } }
  ]
}
```

### Audit Trail

All NL test runs generate audit logs in `_audit/` directory with:
- NL input
- Verdict (PASS/REFUSE/FAIL)
- Intent and slots extracted
- CNL/IR/Opcodes generated
- Timestamp and test results

### Specification Files

- `docs/spec/NRBPL_NL_CNL_GRAMMAR_v0_1.md` — Normative CNL grammar (Section N)
- `src/nl/NL_LEXICON_VI_EN_v0_1.json` — NL patterns and templates
- `test/nl/NL_TEST_SUITE_v0_1.json` — 10 normative test cases

---

## Program Format

Programs are JSON files with the following structure:

```json
{
  "program_name": "Example Program",
  "program_version": "0.1.0",
  "instructions": [
    {
      "op": "DICT_LOOKUP",
      "args": {
        "dict_id": "en_en_lex_min",
        "lemma": "hello"
      }
    },
    {
      "op": "ASSERT_FOUND",
      "args": {}
    },
    {
      "op": "HALT",
      "args": {
        "reason": "completed"
      }
    }
  ]
}
```

---

## Supported Opcodes (Section E)

| Opcode | Description | Evidence |
|--------|-------------|----------|
| `PUSH` | Push value to stack | ΔC: value, ΔS: type, ΔP: stack_depth |
| `POP` | Pop value from stack | ΔC: stack_depth, ΔS: popped_value, ΔP: success |
| `DICT_LOOKUP` | Lookup lemma in dictionary | ΔC: dict_id/hash/lemma, ΔS: results, ΔP: count |
| `ASSERT_FOUND` | Assert lookup found results | ΔC: expected/actual |
| `HALT` | Halt execution | ΔC: reason |

---

## PR Schema (Section K)

Every operation emits a Provenance Record (PR):

```json
{
  "pr_version": "0.1",
  "op": "DICT_LOOKUP",
  "ΔC": { "dict_id": "...", "dict_hash": "...", "lemma": "..." },
  "ΔS": { "results": [...] },
  "ΔP": { "lookup_time": "...", "result_count": 1 },
  "verdict": "PASS",
  "ts": "2025-01-21T12:00:00.000Z",
  "hash": "abc123..."
}
```

---

## Ledger Format (Section D)

```json
{
  "version": "0.1",
  "genesis_hash": "0000...0000",
  "entries": [
    {
      "pr": { ... },
      "chain_hash": "hash(prev_chain_hash + pr.hash)"
    }
  ]
}
```

---

## Verdict Discipline (Section V)

- **REFUSE**: Ungrounded assertion / invalid input
- **FAIL**: Valid input but operation failed
- **PASS**: Operation succeeded

Verdict propagation:
- `REFUSE > FAIL > PASS` (strict ordering)
- Any REFUSE in chain → entire chain REFUSE
- VM halts on REFUSE or FAIL (fail-fast)

---

## Roadmap Position

**Current Milestone: M1 — Kernel-CORE v0.1 + NL Programming v0.1 (COMPLETE)**

✅ Execution kernel operational
✅ PR model implemented
✅ Ledger append/verify/replay working
✅ End-to-end verification functional
✅ **NL Programming v0.1 (NEW!)** — NL → CNL → IR → Opcodes pipeline
✅ **Vietnamese + English support** with deterministic translation
✅ **10/10 NL test cases passing** with full audit trail

**Next Milestone: M2 — Platform-CORE v0.1**

⛔ Section P: Binary pack format (currently JSON-pack)
⛔ `PACK_LOAD` / `PACK_VERIFY` opcodes
⛔ Full tooling suite

See `ROADMAP_POSITION.md` for detailed roadmap.

---

## Testing

### Core Test Suite (`test/run_all.js`) — 25 tests

1. Canonical JSON serialization
2. PR schema validation
3. Verdict propagation
4. PR hashing and verification
5. Ledger append/verify/replay
6. Dictionary pack and index
7. VM execution
8. End-to-end: evidence → PR → ledger → replay

### NL Programming Test Suite (`test/nl/run_nl_suite.js`) — 10 tests

1. Vietnamese DICT_LOOKUP (NL_TC01)
2. English DICT_LOOKUP (NL_TC02)
3. Vietnamese ASSERT_FOUND (NL_TC03)
4. Vietnamese LEDGER_VERIFY (NL_TC04)
5. English LEDGER_REPLAY (NL_TC05)
6. REFUSE: No match (NL_TC06)
7. REFUSE: Missing slot (NL_TC07)
8. REFUSE: Ambiguous input (NL_TC08)
9. REFUSE: Bad slot validation (NL_TC09)
10. REFUSE: Injection attempt (NL_TC10)

All tests must pass before any modification is accepted.

---

## Contributing

This is research software. Contributions must:

1. Maintain ABI/opcode semantic compatibility
2. Pass all existing tests
3. Include new tests for new features
4. Preserve PR schema and ledger integrity
5. Follow fail-fast discipline

See `NOTICE.txt` for license terms.

---

## Research Context

NRBPL is based on:

- **CPL** (Condition–Phenomenon Law): Causality grounding framework
- **UGTS** (Universal Grounded Truth System): Truth verification discipline
- **ΔS-Field Theory**: Temporal entropy and reflex dynamics

This kernel enables **forensic verification** of program execution through
immutable provenance records and deterministic replay.

---

## Citation

If you use this software in your research:

```bibtex
@software{nrbpl_kernel_core_v01,
  author = {Nguyen Ngoc Thi},
  title = {NRBPL Kernel-CORE v0.1: Execution Kernel with Provenance Record Model},
  year = {2025},
  publisher = {SEE-R OS / NRB Laboratory},
  url = {https://github.com/baristaquynhon-nrb-lab/imu-drift-bench-}
}
```

---

## License

See `NOTICE.txt` for full license terms.

**Copyright © 2025 Nguyen Ngoc Thi — SEE-R OS / NRB Laboratory**

---

## Contact

- **Issues**: [GitHub Issues](https://github.com/baristaquynhon-nrb-lab/imu-drift-bench-/issues)
- **Project**: [Repository](https://github.com/baristaquynhon-nrb-lab/imu-drift-bench-)

---

**"No ungrounded assertion. Refuse first, verify always."** — NRBPL Design Principle
