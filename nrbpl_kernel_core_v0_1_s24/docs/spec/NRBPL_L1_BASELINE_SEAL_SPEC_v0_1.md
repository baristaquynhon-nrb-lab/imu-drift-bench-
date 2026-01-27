# NRBPL L1 Baseline Seal Specification v0.1

**Spec ID:** `NRBPL_L1_BASELINE_SEAL_SPEC_v0.1`
**Status:** NORMATIVE
**Discipline:** UGTS/CPL (Evidence-first, Deterministic, Fail-fast)
**Purpose:** Freeze NRBPL Level-L1 Governance baseline as portable, auditable evidence pack

---

## 1. Overview

### 1.1 Purpose

This specification defines the **canonical sealing process** for NRBPL Level L1 (Minimal Viable Governance) baseline. The seal creates a **deterministic, portable evidence pack** that:

1. **Freezes** the audit state at L1 maturity
2. **Binds** the audit report to cryptographic integrity proof (SHA-256)
3. **Witnesses** the seal with timestamp and issuer metadata
4. **Enables** portable verification across environments (Claude Code, Termux, CI/CD)

### 1.2 Artifacts Produced

The freeze-seal process generates **3 canonical artifacts** in `_audit/`:

| Artifact | Path | Purpose | Deterministic |
|----------|------|---------|---------------|
| **Canonical Report** | `_audit/NRBPL_AUDIT_REPORT_L1.json` | Stripped audit report (no timestamps) | ✅ Yes |
| **Integrity Hash** | `_audit/NRBPL_AUDIT_REPORT_L1.sha256` | SHA-256 hash of canonical report | ✅ Yes |
| **Witness Seal** | `_audit/NRBPL_AUDIT_WITNESS_L1.json` | Timestamp + issuer + hash binding | ⚠️ Timestamp only |

**Key Properties:**
- **Canonical Report**: Deterministic (same audit state → same hash)
- **Witness Seal**: Non-deterministic (includes timestamp), but binds to deterministic report
- **Integrity Hash**: Deterministic proof of report integrity

---

## 2. Normative Requirements

### 2.1 Execution Preconditions

**MUST have:**
1. Node.js ≥ v18.0.0
2. Functional audit runner accessible via:
   - Default: `npm run audit --silent`
   - Override: `NRBPL_AUDIT_CMD` environment variable
3. Audit runner MUST return:
   - Exit code `0` on SUPPORTED
   - JSON output to stdout (pure JSON or logs containing JSON block)
   - Field `verdict: "SUPPORTED"` in output

**MUST NOT:**
- Run seal if audit verdict is `REFUSE` (exit code 3)
- Run seal if audit verdict is `INSUFFICIENT` (exit code 2)
- Depend on external tools beyond Node.js stdlib

### 2.2 Deterministic Report Canonicalization

**Process:**
1. Execute audit runner and capture stdout
2. Extract JSON object from stdout (supports both pure JSON and embedded JSON in logs)
3. **Strip volatile fields** recursively:
   - `timestamp`, `timestamp_utc`
   - `generated_at`, `generated_at_utc`
   - `time`, `date`, `dt`, `now`
4. Wrap in canonical envelope with:
   - `spec: "NRBPL_AUDIT_REPORT_SCHEMA_v0.1"`
   - `level: "L1"`
   - `governance: "MINIMAL_VIABLE_GOVERNANCE"`
   - `audit_cmd: <command used>`
   - `verdict: <extracted verdict>`
   - `report: <cleaned audit data>`

5. **Stable stringify** with:
   - Recursive key sorting (alphabetical)
   - 2-space indentation
   - No trailing whitespace
   - Trailing newline

**Result:** Same audit state always produces same canonical report JSON.

### 2.3 Integrity Hash Computation

**Algorithm:** SHA-256

**Input:** Canonical report JSON as UTF-8 bytes (after stable stringify)

**Output:** Lowercase hexadecimal string (64 characters)

**Format (`.sha256` file):**
```
<64-char-hex-hash>\n
```

**Example:**
```
a3f5c9d8e2b1f0a7c4e8d9b2f1a0c3e7d9b2f1a0c3e7d9b2f1a0c3e7d9b2f1a0
```

### 2.4 Witness Seal Binding

**Schema:** `NRBPL_WITNESS_SEAL_SCHEMA_v0.1`

**Required Fields:**
```json
{
  "spec": "NRBPL_WITNESS_SEAL_SCHEMA_v0.1",
  "artifact": {
    "id": "NRBPL_AUDIT_REPORT_L1",
    "path": "_audit/NRBPL_AUDIT_REPORT_L1.json",
    "kind": "AUDIT_REPORT",
    "scope": "NRBPL_GOVERNANCE_L1_BASELINE"
  },
  "integrity": {
    "algo": "SHA-256",
    "sha256": "<canonical-report-hash>"
  },
  "seal": {
    "mode": "CANONICAL_SEALED",
    "timestamp_utc": "<ISO-8601-UTC>",
    "issuer": "NRBPL_REPO_AUDIT_SYSTEM",
    "tag_hint": "<git-tag-name>"  // optional, only if --tag used
  }
}
```

**Timestamp Format:** ISO 8601 UTC without milliseconds
- Example: `2026-01-23T12:34:56Z`

**Issuer:** Fixed string `"NRBPL_REPO_AUDIT_SYSTEM"`

**Tag Hint:** Optional git tag name (only if `--tag` flag used)

### 2.5 Atomic File Writes

**Requirement:** All artifact writes MUST be atomic to prevent partial/corrupted files.

**Implementation:**
1. Write to temporary file: `.<filename>.tmp`
2. Rename to final filename (atomic operation on POSIX)

**Rationale:** Ensures seal artifacts are never in incomplete state.

---

## 3. Tool Implementation: `tools/freeze_l1_baseline.js`

### 3.1 Tool Contract

**Location:** `tools/freeze_l1_baseline.js`

**Invocation:**
```bash
# Basic seal (no git tag)
node tools/freeze_l1_baseline.js

# Seal with git tag
node tools/freeze_l1_baseline.js --tag

# Override audit command
NRBPL_AUDIT_CMD="node tools/repo_audit.js" node tools/freeze_l1_baseline.js
```

**Exit Codes:**
- `0` = SEALED (success)
- `2` = INSUFFICIENT / FAIL (audit not SUPPORTED)
- `3` = REFUSE (audit REFUSE or execution error)

**Stdout:** Machine-readable JSON summary (see 3.4)

### 3.2 Execution Flow

```
1. Ensure _audit/ directory exists
2. Run audit command (default: npm run audit --silent)
3. Extract JSON from stdout
4. Canonicalize report (strip timestamps, wrap envelope, stable stringify)
5. Enforce verdict == SUPPORTED (else fail-fast)
6. Write canonical report atomically
7. Compute SHA-256 hash of report
8. Write hash file atomically
9. Build witness seal (with timestamp + hash binding)
10. Write witness seal atomically
11. [Optional] Create git tag if --tag flag present
12. Print machine-readable summary to stdout
13. Exit 0
```

### 3.3 Fail-Fast Points

**REFUSE (exit 3) if:**
- Audit command fails to execute
- Audit stdout is empty
- Cannot parse JSON from stdout
- Audit verdict is `REFUSE`
- File write errors

**INSUFFICIENT (exit 2) if:**
- Audit verdict is not `SUPPORTED`
- Audit verdict is `INSUFFICIENT`

### 3.4 Stdout Machine-Readable Summary

**Format:** JSON object (stable stringify)

**Schema:**
```json
{
  "status": "SEALED",
  "level": "L1",
  "artifacts": {
    "report": "_audit/NRBPL_AUDIT_REPORT_L1.json",
    "report_sha256": "_audit/NRBPL_AUDIT_REPORT_L1.sha256",
    "witness": "_audit/NRBPL_AUDIT_WITNESS_L1.json"
  },
  "report_sha256": "<64-char-hex>",
  "tag": {
    "name": "NRBPL_L1_BASELINE_RC1",
    "ok": true,
    "created": true
  }
}
```

**Field: `tag`** (optional, only if `--tag` used):
- `ok: true` = tag created successfully or already exists
- `ok: false` = tag creation failed (git not available or error)
- `created: true` = new tag created
- `already: true` = tag already exists

---

## 4. NPM Scripts Integration

### 4.1 Required Scripts (package.json)

**Add to `scripts` section:**
```json
{
  "scripts": {
    "freeze-l1": "node tools/freeze_l1_baseline.js",
    "freeze-l1-tag": "node tools/freeze_l1_baseline.js --tag"
  }
}
```

### 4.2 Usage

**Seal without tag:**
```bash
npm run freeze-l1
```

**Seal with git tag:**
```bash
npm run freeze-l1-tag
```

**Check seal artifacts:**
```bash
ls -lh _audit/
cat _audit/NRBPL_AUDIT_REPORT_L1.sha256
cat _audit/NRBPL_AUDIT_WITNESS_L1.json
```

---

## 5. Verification Procedures

### 5.1 Integrity Verification

**Verify canonical report hash:**
```bash
# Compute hash from report
sha256sum _audit/NRBPL_AUDIT_REPORT_L1.json

# Compare with stored hash
cat _audit/NRBPL_AUDIT_REPORT_L1.sha256

# Should match exactly
```

**Expected:** Both hashes are identical (64-character hexadecimal)

### 5.2 Witness Verification

**Check witness binding:**
```bash
# Extract hash from witness
jq -r '.integrity.sha256' _audit/NRBPL_AUDIT_WITNESS_L1.json

# Compare with report hash
cat _audit/NRBPL_AUDIT_REPORT_L1.sha256

# Should match
```

**Verify timestamp:**
```bash
jq -r '.seal.timestamp_utc' _audit/NRBPL_AUDIT_WITNESS_L1.json
# Should be valid ISO 8601 UTC timestamp
```

### 5.3 Git Tag Verification (if --tag used)

**Check tag exists:**
```bash
git tag -l NRBPL_L1_BASELINE_RC1
```

**Verify tag points to current HEAD:**
```bash
git rev-parse NRBPL_L1_BASELINE_RC1
git rev-parse HEAD
# Should be identical commit hashes
```

---

## 6. Deterministic Properties

### 6.1 What is Deterministic

**Same audit state → same artifacts:**
1. **Canonical Report** (`.json`):
   - Same lexicon data → same report content
   - Same gates → same gate results
   - Timestamps removed → deterministic

2. **Integrity Hash** (`.sha256`):
   - Same canonical report → same SHA-256
   - Computed from stable stringify → deterministic

### 6.2 What is Non-Deterministic

**Witness Seal** (`.json`):
- `seal.timestamp_utc` changes on each run
- But `integrity.sha256` is deterministic (binds to canonical report)

**Rationale:** Witness records **when** the seal was created, not **what** was sealed. The canonical report is the source of truth.

### 6.3 Reproducibility

**Can reproduce canonical report hash:**
```bash
# Re-run freeze (timestamp changes, but report hash stays same if audit unchanged)
npm run freeze-l1

# Verify hash matches previous seal
diff \
  _audit/NRBPL_AUDIT_REPORT_L1.sha256 \
  <(sha256sum _audit/NRBPL_AUDIT_REPORT_L1.json | cut -d' ' -f1)
```

---

## 7. Portable Execution Requirements

### 7.1 Environment Compatibility

**Tested Platforms:**
- ✅ Claude Code (Linux, Node.js v22+)
- ✅ Termux (Android, Node.js v18+)
- ✅ MacOS (Node.js v18+)
- ✅ Linux (Node.js v18+)
- ✅ Windows (Node.js v18+, Git Bash recommended)

**No Dependencies:**
- Only Node.js stdlib: `fs`, `path`, `crypto`, `child_process`
- No npm packages required
- No build step

### 7.2 Minimal System Requirements

| Component | Requirement | Check Command |
|-----------|-------------|---------------|
| Node.js   | ≥ v18.0.0   | `node -v`     |
| Git       | Optional (for --tag) | `git --version` |
| sha256sum | Optional (for manual verification) | `sha256sum --version` |

---

## 8. Security Considerations

### 8.1 Threat Model

**Protected Against:**
1. **Audit tampering:** Canonical report hash detects any modification
2. **Timestamp manipulation:** Witness timestamp is non-canonical (report hash is source of truth)
3. **Partial writes:** Atomic file writes prevent corrupted artifacts

**NOT Protected Against:**
1. **Compromised audit runner:** If `npm run audit` is malicious, seal reflects that
2. **SHA-256 collision:** Cryptographic hash collision (negligible probability)
3. **Local file system attacks:** If attacker has write access to `_audit/`, they can replace files

### 8.2 Trust Assumptions

**Baseline seal assumes:**
1. Audit runner (`npm run audit`) is trustworthy
2. Node.js runtime is not compromised
3. File system writes are atomic (POSIX guarantee)
4. SHA-256 is collision-resistant

**Verification Trust:**
- Anyone can verify integrity by recomputing hash
- Git tag provides additional provenance (if used)
- Witness timestamp provides forensic timeline

---

## 9. Integration with Governance Pipeline

### 9.1 L1 Baseline Workflow

```
1. Develop code + lexicon data
2. Run audit: npm run audit
   → verdict: SUPPORTED
3. Freeze baseline: npm run freeze-l1-tag
   → Creates 3 artifacts + git tag
4. Commit artifacts (optional)
5. Push tag to remote (if sharing)
```

### 9.2 CI/CD Integration Example

```yaml
# .github/workflows/seal-l1.yml
name: Seal L1 Baseline
on:
  push:
    branches: [main]

jobs:
  seal:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm run freeze-l1-tag
      - run: git push origin NRBPL_L1_BASELINE_RC1
```

### 9.3 Artifact Storage

**Recommended locations:**

**Option 1: Commit to repo (evidence-in-repo)**
```bash
git add _audit/NRBPL_AUDIT_REPORT_L1.*
git add _audit/NRBPL_AUDIT_WITNESS_L1.json
git commit -m "Seal L1 baseline"
git push origin NRBPL_L1_BASELINE_RC1
```

**Option 2: External artifact store**
- Upload to S3/GCS/artifact repository
- Reference by hash in repo
- Keep witness in repo for provenance

---

## 10. Upgrade Path: L1 → L2

### 10.1 L2 Requirements (Future)

**Additional validators:**
- `meaning_ir_gate.js` (semantic validation)
- `alignment_gate.js` (cross-lingual consistency)
- `nitl_gate.js` (translation library validation)

**Enhanced sealing:**
- Manifest-based builds (reproducible binaries)
- Multi-signature witness seals
- Notarization service integration

### 10.2 Backward Compatibility

**L1 seals remain valid:**
- L2 tools can verify L1 seals
- L1 → L2 migration preserves L1 baseline
- Git tag `NRBPL_L1_BASELINE_RC1` marks last L1 state

---

## 11. Compliance Checklist

**L1 Baseline Seal Compliance:**

- [ ] `tools/freeze_l1_baseline.js` exists and is executable
- [ ] NPM scripts `freeze-l1` and `freeze-l1-tag` defined
- [ ] Audit runner returns SUPPORTED verdict
- [ ] Running `npm run freeze-l1` creates 3 artifacts
- [ ] Canonical report has no timestamps
- [ ] SHA-256 hash matches computed hash
- [ ] Witness seal binds to canonical report hash
- [ ] Git tag created (if `--tag` used)
- [ ] Artifacts are portable (work on Claude Code, Termux, etc.)
- [ ] Documentation in `docs/spec/` is complete

---

## 12. References

**Related Specifications:**
- `NRBPL-ARCH-MAP-v0.1.md` — Three-plane architecture
- `NRBPL_REPO_AUDIT_SYSTEM_v0_1.md` — Audit runner spec
- `NRBPL_AUDIT_EXECUTION_CHECKLIST_v0_1.md` — Execution guide

**External Standards:**
- ISO 8601 (Timestamp format)
- SHA-256 (FIPS 180-4)
- JSON (RFC 8159)
- POSIX atomic rename (filesystem atomicity)

---

## 13. Changelog

| Version | Date | Changes |
|---------|------|---------|
| v0.1 | 2026-01-23 | Initial specification for L1 baseline seal |

---

**Document Status:** NORMATIVE
**Version:** v0.1
**Last Updated:** 2026-01-23
**Compliance:** UGTS/CPL Evidence-First Discipline
**Maturity Level:** L1 (Minimal Viable Governance)
