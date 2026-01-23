# NRBPL Audit Execution Checklist v0.1

**Spec:** `NRBPL_AUDIT_EXECUTION_CHECKLIST_v0.1`
**Status:** NORMATIVE
**Discipline:** UGTS/CPL (Evidence-first, Deterministic, Fail-fast)
**Purpose:** Portable audit execution procedure for Claude Code or any Node.js runner

---

## I. Preconditions (ΔC — Required Environment)

### 1.1 Runtime Requirements

| Component | Requirement | Check Command |
|-----------|-------------|---------------|
| Node.js   | ≥ v18.0.0   | `node -v`     |
| npm       | ≥ v8.0.0    | `npm -v`      |
| Git       | Any version | `git --version` |

**Exit Code:**
- `0` = PASS (all requirements met)
- `3` = REFUSE (missing requirement)

### 1.2 Repository Structure (Mandatory Files)

```
nrbpl_kernel_core_v0_1_s24/
├── tools/
│   └── repo_audit.js             ✅ REQUIRED (audit runner)
├── validators/                    ⚠️  REQUIRED (governance gates)
│   ├── lexicon_gate.js           ❌ MISSING (v1.0.1 with --all + JSON stdout)
│   ├── meaning_ir_gate.js        ❌ MISSING (optional for v0.1)
│   └── frame_coverage_gate.js    ❌ MISSING (optional for v0.1)
├── lexicon/                       ⚠️  REQUIRED (knowledge plane data)
│   ├── en_vi_lemmas.jsonl        ❌ MISSING
│   ├── en_vi_senses.jsonl        ❌ MISSING
│   └── collocations_en.jsonl     ❌ MISSING
├── frames/                        ⚠️  OPTIONAL (for frame validation)
│   └── meaning_frames.json       ❌ MISSING
├── schemas/
│   ├── audit_report.schema.json  ✅ PRESENT
│   └── witness_seal.schema.json  ✅ PRESENT
└── _audit/                        🔧 AUTO-CREATED (output directory)
```

**Current Status:** ⚠️ INSUFFICIENT
**Reason:** Missing validators and lexicon data (Plane B + Plane C incomplete)

---

## II. Execution Entrypoints (Normative)

### 2.1 Primary Entrypoint: Repository Audit

**Command:**
```bash
node tools/repo_audit.js --scope ntl --mode canonical --out _audit/repo_audit.json
```

**Expected Behavior:**
- **Input:** Repository state (validators, lexicon, schemas)
- **Output:** `_audit/repo_audit.json` (machine-readable audit report)
- **Exit Codes:**
  - `0` = SUPPORTED (all gates PASS)
  - `2` = INSUFFICIENT (at least one gate INSUFFICIENT)
  - `3` = REFUSE (at least one gate REFUSE or error)

**MUST Requirements:**
1. stdout = JSON only (parseable by `jq` or `JSON.parse()`)
2. No side effects (read-only, idempotent)
3. Deterministic (same input → same output)
4. Fail-fast (stop on first REFUSE)

### 2.2 Secondary Entrypoint: Lexicon Gate (Unit Test)

**Command:**
```bash
node validators/lexicon_gate.js --all \
  --lemmas lexicon/en_vi_lemmas.jsonl \
  --senses lexicon/en_vi_senses.jsonl \
  --collocations lexicon/collocations_en.jsonl \
  --frames frames/meaning_frames.json \
  > _audit/lexicon_gate.audit.json
```

**Expected Output (stdout JSON):**
```json
{
  "spec": "NRBPL_GATE_AUDIT_v0.1",
  "gate": "lexicon_gate",
  "verdict": "SUPPORTED",
  "exit_code": 0,
  "checks": [
    {
      "check_id": "lemma_uniqueness",
      "verdict": "SUPPORTED",
      "checked_count": 1234,
      "failed_count": 0
    }
  ]
}
```

**Exit Codes:**
- `0` = SUPPORTED (all checks PASS)
- `2` = INSUFFICIENT (warnings, non-critical)
- `3` = REFUSE (critical errors: duplicates, malformed JSONL, etc.)

---

## III. Execution Procedure (Step-by-Step for Claude Code)

### STEP 0: Environment Setup

```bash
# Clone repository (if not already in Claude Code)
git clone <NRBPL_REPO_URL>
cd nrbpl_kernel_core_v0_1_s24

# Verify Node.js version
node -v
# MUST print: v18.x or higher
```

**Pass Criteria:** `node -v` returns v18.0.0 or higher

---

### STEP 1: Create Audit Directory

```bash
mkdir -p _audit
```

**Pass Criteria:** Directory `_audit/` exists

---

### STEP 2: Run Repository Audit (Primary Test)

```bash
node tools/repo_audit.js --scope ntl --mode canonical --out _audit/repo_audit.json
EXIT_CODE=$?
echo "EXIT_CODE=$EXIT_CODE"
cat _audit/repo_audit.json
```

**Expected Output (SUPPORTED case):**
```json
{
  "spec": "NRBPL_AUDIT_REPORT_v0.1",
  "scope": "ntl",
  "mode": "canonical",
  "timestamp_utc": "2026-01-23T12:34:56.789Z",
  "verdict": "SUPPORTED",
  "exit_code": 0,
  "gates": [
    {
      "gate_id": "lexicon_gate",
      "verdict": "SUPPORTED",
      "exit_code": 0
    }
  ]
}
```

**Pass Criteria:**
- Exit code = `0`
- JSON file exists at `_audit/repo_audit.json`
- `verdict` field = `"SUPPORTED"`
- All gates have `verdict: "SUPPORTED"`

---

### STEP 3: Verify Gate Execution (Unit Test - Optional)

```bash
node validators/lexicon_gate.js --all \
  --lemmas lexicon/en_vi_lemmas.jsonl \
  --senses lexicon/en_vi_senses.jsonl \
  --collocations lexicon/collocations_en.jsonl \
  --frames frames/meaning_frames.json \
  > _audit/lexicon_gate.audit.json

EXIT_CODE=$?
echo "EXIT_CODE=$EXIT_CODE"
cat _audit/lexicon_gate.audit.json
```

**Pass Criteria:**
- Exit code = `0`
- stdout is valid JSON
- `verdict: "SUPPORTED"`

---

### STEP 4: Inspect Audit Artifacts (Evidence Collection)

```bash
ls -lh _audit/
cat _audit/repo_audit.json | jq .
```

**Expected Files:**
- `_audit/repo_audit.json` (primary audit report)
- `_audit/lexicon_gate.audit.json` (optional unit gate report)

**Pass Criteria:** All JSON files are valid and parseable

---

## IV. Pass/Fail Criteria (UGTS Discipline)

### 4.1 SUPPORTED (Exit Code 0)

**Conditions (ALL must be true):**
1. `repo_audit.json` exists
2. `verdict: "SUPPORTED"`
3. All gates report `verdict: "SUPPORTED"`
4. No errors in gate execution

**Interpretation:** Repository is audit-compliant and ready for canonical sealing.

---

### 4.2 INSUFFICIENT (Exit Code 2)

**Conditions (ANY is true):**
1. `verdict: "INSUFFICIENT"`
2. At least one gate reports `verdict: "INSUFFICIENT"`
3. Warnings present (e.g., missing optional files)

**Interpretation:** Repository is incomplete but not contradictory. Requires fixes before sealing.

**Example Causes:**
- Missing optional validators (frame_coverage_gate.js)
- Incomplete lexicon coverage (<80%)
- Missing witness seals

---

### 4.3 REFUSE (Exit Code 3)

**Conditions (ANY is true):**
1. `verdict: "REFUSE"`
2. At least one gate reports `verdict: "REFUSE"`
3. Critical errors (duplicate lemmas, malformed JSONL, etc.)
4. Gate execution failure (missing validator file, invalid JSON)

**Interpretation:** Repository has critical errors. MUST fix before re-audit.

**Example Causes:**
- Duplicate lemma in `en_vi_lemmas.jsonl`
- Multiword lemma without collocation_id
- Invalid JSONL syntax (trailing comma, missing newline)
- Undefined frame_id referenced in senses
- Missing required validator file

---

## V. Minimal Audit Mode (Current State)

### 5.1 Behavior When Validators Are Missing

If `validators/` directory is empty or gates are not found:

```json
{
  "verdict": "SUPPORTED",
  "exit_code": 0,
  "gates": [],
  "note": "No validators found; minimal audit mode (SUPPORTED by default)"
}
```

**Rationale:** This allows incremental development. Audit runner does not fail if no validators exist (fail-open for v0.1).

**Security Note:** In production (v1.0+), missing validators MUST return `REFUSE`.

---

### 5.2 Current Repository Status

**As of 2026-01-23:**

| Component | Status | Note |
|-----------|--------|------|
| `tools/repo_audit.js` | ✅ PRESENT | Audit runner works |
| `validators/lexicon_gate.js` | ❌ MISSING | Gate not implemented |
| `lexicon/*.jsonl` | ❌ MISSING | No lexicon data |
| `frames/meaning_frames.json` | ❌ MISSING | No frame definitions |
| Node.js v22.21.1 | ✅ SUPPORTED | Runtime OK |

**Overall Verdict:** ⚠️ INSUFFICIENT
**Reason:** Missing Plane B (Knowledge) and Plane C validators

**Audit Output (Current):**
```bash
$ npm run audit
{
  "verdict": "SUPPORTED",
  "note": "No validators found; minimal audit mode"
}
```

---

## VI. Next Steps to Achieve Full Audit Compliance

### 6.1 Priority 1: Create Lexicon Gate (REQUIRED)

**File:** `validators/lexicon_gate.js`

**Requirements:**
- Accept CLI args: `--all`, `--lemmas`, `--senses`, `--collocations`, `--frames`
- Output JSON to stdout only (no console.log)
- Exit codes: 0 (SUPPORTED), 2 (INSUFFICIENT), 3 (REFUSE)
- Checks:
  1. Lemma uniqueness (no duplicates)
  2. No multiword lemmas without collocation_id
  3. Valid JSONL syntax
  4. Frame existence (if --frames provided)

**Template:**
```javascript
#!/usr/bin/env node
// validators/lexicon_gate.js v1.0.1
const fs = require('fs');

// Parse CLI args, run checks, output JSON to stdout
// Exit with appropriate code
```

---

### 6.2 Priority 2: Create Lexicon Data (REQUIRED)

**Files to create:**
1. `lexicon/en_vi_lemmas.jsonl` (lemma definitions)
2. `lexicon/en_vi_senses.jsonl` (sense definitions)
3. `lexicon/collocations_en.jsonl` (multiword entries)

**Format Example (lemmas):**
```jsonl
{"lemma_id":"L001","lemma":"hello","pos":"INTJ","language":"en"}
{"lemma_id":"L002","lemma":"world","pos":"NOUN","language":"en"}
```

---

### 6.3 Priority 3: Create Meaning Frames (OPTIONAL)

**File:** `frames/meaning_frames.json`

**Format:**
```json
{
  "frames": [
    {
      "frame_id": "F_GREETING",
      "frame_name": "Greeting",
      "core_elements": ["Addressee", "Greeter"]
    }
  ]
}
```

---

### 6.4 Priority 4: Update Audit Runner Config

**File:** `tools/repo_audit.js`

Ensure validator chain includes:
```javascript
const GATES = [
  {
    id: "lexicon_gate",
    cmd: "validators/lexicon_gate.js",
    argv: [
      "--all",
      "--lemmas", "lexicon/en_vi_lemmas.jsonl",
      "--senses", "lexicon/en_vi_senses.jsonl",
      "--collocations", "lexicon/collocations_en.jsonl",
      "--frames", "frames/meaning_frames.json"
    ]
  }
];
```

---

## VII. Script Driver (Optional CI/CD Helper)

**File:** `scripts/run_audit.sh`

```bash
#!/usr/bin/env bash
# NRBPL Audit Script Driver v0.1
# Purpose: Single-command audit execution for CI/CD

set -euo pipefail

echo "=== NRBPL Repository Audit v0.1 ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# STEP 1: Check Node.js
echo "[1/4] Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "Node.js: $NODE_VERSION"

if ! node -e "process.exit(process.versions.node.split('.')[0] < 18 ? 1 : 0)"; then
  echo "ERROR: Node.js v18+ required"
  exit 3
fi

# STEP 2: Create audit directory
echo "[2/4] Creating audit directory..."
mkdir -p _audit

# STEP 3: Run audit
echo "[3/4] Running repository audit..."
node tools/repo_audit.js --scope ntl --mode canonical --out _audit/repo_audit.json
EXIT_CODE=$?

# STEP 4: Display results
echo "[4/4] Audit results:"
cat _audit/repo_audit.json | jq . || cat _audit/repo_audit.json

echo ""
echo "Exit code: $EXIT_CODE"
exit $EXIT_CODE
```

**Usage:**
```bash
chmod +x scripts/run_audit.sh
./scripts/run_audit.sh
```

---

## VIII. Claude Code Execution Summary

### 8.1 What Claude Code Needs to Do

**Single command:**
```bash
npm run audit
```

**Alternative (direct call):**
```bash
node tools/repo_audit.js --scope ntl --mode canonical --out _audit/repo_audit.json
```

**Expected behavior:**
- Creates `_audit/repo_audit.json`
- Prints JSON to stdout
- Exits with code 0, 2, or 3

### 8.2 Current Capability

✅ **Claude Code CAN execute audit right now** (minimal mode)
⚠️ **But will return SUPPORTED by default** (no validators)
❌ **Cannot detect lexicon errors** (no lexicon_gate.js)

### 8.3 To Achieve Full Governance

**Required additions:**
1. `validators/lexicon_gate.js` (319 LOC estimated)
2. `lexicon/*.jsonl` (3 files, sample data)
3. Update `tools/repo_audit.js` gate config (5 lines)

**Estimated effort:** 1-2 hours implementation + testing

---

## IX. Governance Maturity Levels

| Level | Validators | Lexicon | Audit Verdict | Production Ready |
|-------|-----------|---------|---------------|------------------|
| L0: Stub | None | None | SUPPORTED (by default) | ❌ No |
| L1: Minimal | lexicon_gate | Sample data | SUPPORTED/REFUSE | ⚠️ Dev only |
| L2: Complete | All gates | Full data | SUPPORTED/INSUFFICIENT/REFUSE | ✅ Yes |
| L3: Sealed | + Witness | + Manifests | Canonical sealed | ✅ Production |

**Current Level:** L0 (Stub)
**Next Target:** L1 (Minimal viable governance)

---

## X. Conclusion: Is Claude Code Ready?

### ✅ YES for execution infrastructure:
- Node.js v22.21.1 ≥ v18 ✅
- `tools/repo_audit.js` exists and works ✅
- Can run `npm run audit` successfully ✅
- Deterministic, idempotent, fail-fast architecture ✅

### ⚠️ NO for full governance validation:
- Missing validators (lexicon_gate.js) ❌
- Missing lexicon data (*.jsonl) ❌
- Audit returns false-SUPPORTED (no gates executed) ⚠️

### 📋 Readiness Checklist:

- [x] Node.js runtime ≥ v18
- [x] Audit runner (`tools/repo_audit.js`)
- [x] Schemas (audit_report, witness_seal)
- [x] Can execute `npm run audit`
- [ ] Lexicon gate validator
- [ ] Lexicon data files
- [ ] Full audit chain execution
- [ ] REFUSE on real errors

**Recommendation:** Create `validators/lexicon_gate.js` next to achieve L1 maturity.

---

**Document Status:** NORMATIVE
**Version:** v0.1
**Last Updated:** 2026-01-23
**Compliance:** UGTS/CPL Evidence-First Discipline
