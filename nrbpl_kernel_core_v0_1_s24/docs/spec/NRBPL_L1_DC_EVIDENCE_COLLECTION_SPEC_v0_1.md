# NRBPL L1 ΔC Evidence Collection Specification v0.1

**Spec ID:** `NRBPL_L1_DC_EVIDENCE_COLLECTION_SPEC_v0.1`
**Status:** NORMATIVE
**Discipline:** UGTS/CPL (Evidence-First, No Inference)
**Purpose:** Define deterministic ΔC evidence collection for NRBPL L1 baseline audit

---

## 1. Mission (Normative)

Generate ΔC (precondition) evidence artifacts that allow independent auditors to verify:

1. Audit runner output (repository audit)
2. Lexicon gate output (validator)
3. Baseline seal integrity (SHA-256)
4. Replay reproducibility proof

**Hard Constraint:** No narrative claims allowed. Only deterministic outputs.

---

## 2. Execution Constraints (Hard Rules)

### 2.1 Forbidden Claims

**MUST NOT** include self-claims such as:
- "VERIFIED"
- "COMPLIANT"
- "READY"
- "ACHIEVED"
- "PASS"
- "SUCCESS"

### 2.2 Output Requirements

**MUST** only show:
- ΔC outputs (command + raw stdout/stderr + produced file content)
- No timestamps inside canonical reports (unless report spec explicitly allows)
- Deterministic output order
- No JSON key reordering (unless defined by schema)

### 2.3 Fail-Fast Policy

If any check fails:
1. Stop immediately
2. Print: failing command, exit code, stderr excerpt (first 80 lines)
3. Set overall result:
   ```json
   {"verdict":"FAIL","reason":"DC_COLLECTION_FAILED","failed_step":"<step-id>"}
   ```

---

## 3. ΔC Deliverables (Mandatory)

### 3.1 Directory Structure

```
_audit/dc/
├── DC_TRANSCRIPT_v0_1.log                      (command execution log)
├── DC_AUDIT_STDOUT.json                        (audit raw output)
├── DC_AUDIT_STDERR.log                         (audit errors if any)
├── DC_AUDIT_HEAD_120.txt                       (first 120 lines excerpt)
├── DC_SHA256_CHECK.log                         (baseline integrity check)
├── DC_LEXICON_GATE_REPORT.json                 (lexicon gate output)
├── DC_LEXICON_GATE_HEAD_120.txt                (first 120 lines excerpt)
├── DC_LEXICON_GATE_REPORT.json.sha256          (gate report hash)
├── DC_ARTIFACT_SHA256_MANIFEST.txt             (all artifact hashes)
├── DC_GIT_STATUS.txt                           (git working tree state)
├── DC_GIT_LOG_ONELINE_20.txt                   (recent commits)
├── DC_GIT_REMOTE.txt                           (remote configuration)
├── NRBPL_L1_DC_EVIDENCE_PACK_v0_1.tar.gz       (bundled evidence)
└── NRBPL_L1_DC_EVIDENCE_PACK_v0_1.tar.gz.sha256 (bundle hash)
```

### 3.2 Evidence Artifacts

#### (A) Command Transcript

**File:** `_audit/dc/DC_TRANSCRIPT_v0_1.log`

**Purpose:** Append-only log of all executed commands

**Format:**
```
>>> CMD: <command>
>>> EXIT: <code>
>>> STDOUT:
<raw stdout>
>>> STDERR:
<raw stderr>

```

**Requirements:**
- Each command MUST be logged exactly as executed
- Raw stdout/stderr MUST be included verbatim
- Exit code MUST be captured

---

#### (B) Audit Replay Evidence

**Files:**
- `_audit/dc/DC_AUDIT_STDOUT.json` (raw output if tool prints JSON)
- `_audit/dc/DC_AUDIT_STDERR.log` (raw stderr if any)
- `_audit/dc/DC_AUDIT_HEAD_120.txt` (first 120 lines for human review)

**Command:**
```bash
npm run audit 1> _audit/dc/DC_AUDIT_STDOUT.json 2> _audit/dc/DC_AUDIT_STDERR.log
sed -n '1,120p' _audit/dc/DC_AUDIT_STDOUT.json > _audit/dc/DC_AUDIT_HEAD_120.txt
```

**Requirements:**
- MUST capture complete stdout/stderr
- MUST create head excerpt for quick review
- MUST preserve exact formatting

---

#### (C) Baseline Seal Verification Evidence

**File:** `_audit/dc/DC_SHA256_CHECK.log`

**Purpose:** Verify canonical report integrity

**Command:**
```bash
COMPUTED=$(sha256sum _audit/NRBPL_AUDIT_REPORT_L1.json | cut -d' ' -f1)
EXPECTED=$(cat _audit/NRBPL_AUDIT_REPORT_L1.sha256)
echo "computed: $COMPUTED" > _audit/dc/DC_SHA256_CHECK.log
echo "expected: $EXPECTED" >> _audit/dc/DC_SHA256_CHECK.log
if [ "$COMPUTED" = "$EXPECTED" ]; then
  echo "result: MATCH" >> _audit/dc/DC_SHA256_CHECK.log
else
  echo "result: MISMATCH" >> _audit/dc/DC_SHA256_CHECK.log
fi
```

**Requirements:**
- MUST compute hash from canonical report
- MUST compare with stored hash
- MUST record result (MATCH/MISMATCH)
- No interpretation - raw comparison only

---

#### (D) Lexicon Gate ΔC Evidence

**Files:**
- `_audit/dc/DC_LEXICON_GATE_REPORT.json` (verbatim JSON)
- `_audit/dc/DC_LEXICON_GATE_HEAD_120.txt` (first 120 lines)
- `_audit/dc/DC_LEXICON_GATE_REPORT.json.sha256` (gate report hash)

**Command:**
```bash
node validators/lexicon_gate.js --all \
  --lemmas lexicon/en_vi_lemmas.jsonl \
  --senses lexicon/en_vi_senses.jsonl \
  --collocations lexicon/collocations_en.jsonl \
  --frames frames/meaning_frames.json \
  > _audit/dc/DC_LEXICON_GATE_REPORT.json

sed -n '1,120p' _audit/dc/DC_LEXICON_GATE_REPORT.json > _audit/dc/DC_LEXICON_GATE_HEAD_120.txt
sha256sum _audit/dc/DC_LEXICON_GATE_REPORT.json > _audit/dc/DC_LEXICON_GATE_REPORT.json.sha256
```

**Requirements:**
- MUST run with --all mode
- MUST capture deterministic JSON output
- MUST compute hash of gate report

---

#### (E) Canonical Artifacts Snapshot

**File:** `_audit/dc/DC_ARTIFACT_SHA256_MANIFEST.txt`

**Purpose:** List exact immutable file hashes for independent replay

**Required Paths:**
- `_audit/NRBPL_AUDIT_REPORT_L1.json`
- `_audit/NRBPL_AUDIT_WITNESS_L1.json`
- `governance/subsystems/NRBPL.registry.json`
- `evidence/NRBPL_L1_BASELINE_POINTER.json`
- `validators/lexicon_gate.js`
- `tools/repo_audit.js`
- `tools/freeze_l1_baseline.js`
- `lexicon/en_vi_lemmas.jsonl`
- `lexicon/en_vi_senses.jsonl` (if exists)
- `frames/meaning_frames.json`

**Command:**
```bash
{
  sha256sum _audit/NRBPL_AUDIT_REPORT_L1.json
  sha256sum _audit/NRBPL_AUDIT_WITNESS_L1.json
  sha256sum governance/subsystems/NRBPL.registry.json
  sha256sum evidence/NRBPL_L1_BASELINE_POINTER.json
  sha256sum validators/lexicon_gate.js
  sha256sum tools/repo_audit.js
  sha256sum tools/freeze_l1_baseline.js
  sha256sum lexicon/en_vi_lemmas.jsonl
  [ -f lexicon/en_vi_senses.jsonl ] && sha256sum lexicon/en_vi_senses.jsonl
  sha256sum frames/meaning_frames.json
} > _audit/dc/DC_ARTIFACT_SHA256_MANIFEST.txt 2>&1
```

**Requirements:**
- MUST be single deterministic block
- MUST use sha256sum standard format
- MUST include all mandatory artifacts

---

#### (F) Git State ΔC Evidence

**Purpose:** Provide proof of local-only state (no push)

**Files:**
- `_audit/dc/DC_GIT_STATUS.txt`
- `_audit/dc/DC_GIT_LOG_ONELINE_20.txt`
- `_audit/dc/DC_GIT_REMOTE.txt`

**Commands:**
```bash
git status --porcelain=v1 > _audit/dc/DC_GIT_STATUS.txt
git log --oneline -n 20 > _audit/dc/DC_GIT_LOG_ONELINE_20.txt
git remote -v > _audit/dc/DC_GIT_REMOTE.txt
```

**Requirements:**
- MUST use porcelain format for git status (machine-readable)
- MUST capture last 20 commits
- MUST record remote configuration

---

#### (G) Final Evidence Pack

**Files:**
- `_audit/dc/NRBPL_L1_DC_EVIDENCE_PACK_v0_1.tar.gz`
- `_audit/dc/NRBPL_L1_DC_EVIDENCE_PACK_v0_1.tar.gz.sha256`

**Command:**
```bash
tar -czf _audit/NRBPL_L1_DC_EVIDENCE_PACK_v0_1.tar.gz _audit/dc
mv _audit/NRBPL_L1_DC_EVIDENCE_PACK_v0_1.tar.gz _audit/dc/
sha256sum _audit/dc/NRBPL_L1_DC_EVIDENCE_PACK_v0_1.tar.gz > _audit/dc/NRBPL_L1_DC_EVIDENCE_PACK_v0_1.tar.gz.sha256
```

**Requirements:**
- MUST bundle all evidence artifacts
- MUST compute hash of tarball
- MUST be reproducible (same inputs → same tarball hash, modulo timestamp in tar)

---

## 4. Output Policy (What to Return)

### 4.1 Required Output

**MUST return:**

1. **File tree** of `_audit/dc/`
2. **First 80 lines** of:
   - `_audit/dc/DC_SHA256_CHECK.log`
   - `_audit/dc/DC_LEXICON_GATE_HEAD_120.txt`
   - `_audit/dc/DC_AUDIT_HEAD_120.txt`
3. **Computed hash** of evidence pack:
   - Content of `_audit/dc/NRBPL_L1_DC_EVIDENCE_PACK_v0_1.tar.gz.sha256`

### 4.2 Forbidden Output

**MUST NOT include:**
- Conclusions
- PASS/FAIL claims
- Interpretations
- Recommendations
- Self-assessment

### 4.3 Output Format

**File tree format:**
```
_audit/dc/
  DC_TRANSCRIPT_v0_1.log (size)
  DC_AUDIT_STDOUT.json (size)
  ...
```

**Excerpt format:**
```
=== DC_SHA256_CHECK.log (first 80 lines) ===
<content>
```

**Evidence pack hash format:**
```
Evidence Pack SHA-256:
<hash>
```

---

## 5. Failure Handling (Normative)

### 5.1 Failure Detection

If any command exit code ≠ 0:

**MUST:**
1. Stop immediately
2. Print:
   - Failing command (exact command string)
   - Exit code (numeric)
   - Stderr excerpt (first 80 lines)
3. Set overall result:
   ```json
   {
     "verdict": "FAIL",
     "reason": "DC_COLLECTION_FAILED",
     "failed_step": "<step-id>",
     "exit_code": <code>,
     "stderr_excerpt": "<first 80 lines>"
   }
   ```

### 5.2 Step IDs

- `DC_AUDIT_REPLAY` - Audit runner execution
- `DC_SHA256_VERIFY` - Baseline seal verification
- `DC_LEXICON_GATE` - Lexicon gate execution
- `DC_ARTIFACT_MANIFEST` - Artifact hash collection
- `DC_GIT_STATE` - Git state capture
- `DC_TARBALL` - Evidence pack bundling

### 5.3 Error Codes

| Code | Meaning |
|------|---------|
| `DC_COLLECTION_FAILED` | At least one step failed |
| `DC_AUDIT_FAILED` | Audit runner returned non-zero |
| `DC_SHA256_MISMATCH` | Baseline hash mismatch |
| `DC_GATE_FAILED` | Lexicon gate returned non-zero |
| `DC_ARTIFACT_MISSING` | Required artifact not found |

---

## 6. Verification Procedure (Independent Auditor)

### 6.1 Extract Evidence Pack

```bash
tar -xzf _audit/dc/NRBPL_L1_DC_EVIDENCE_PACK_v0_1.tar.gz
```

### 6.2 Verify Evidence Pack Integrity

```bash
sha256sum -c _audit/dc/NRBPL_L1_DC_EVIDENCE_PACK_v0_1.tar.gz.sha256
```

### 6.3 Replay Audit

```bash
npm run audit
# Compare output with _audit/dc/DC_AUDIT_STDOUT.json
```

### 6.4 Verify Baseline Seal

```bash
sha256sum _audit/NRBPL_AUDIT_REPORT_L1.json
cat _audit/NRBPL_AUDIT_REPORT_L1.sha256
# Compare hashes
```

### 6.5 Replay Lexicon Gate

```bash
node validators/lexicon_gate.js --all \
  --lemmas lexicon/en_vi_lemmas.jsonl \
  --senses lexicon/en_vi_senses.jsonl \
  --collocations lexicon/collocations_en.jsonl \
  --frames frames/meaning_frames.json
# Compare output with _audit/dc/DC_LEXICON_GATE_REPORT.json
```

### 6.6 Verify Artifact Hashes

```bash
sha256sum -c _audit/dc/DC_ARTIFACT_SHA256_MANIFEST.txt
```

---

## 7. Compliance Checklist

- [ ] `_audit/dc/` directory created
- [ ] DC_TRANSCRIPT_v0_1.log contains all commands
- [ ] Audit replay evidence collected
- [ ] Baseline seal verification performed
- [ ] Lexicon gate evidence collected
- [ ] Artifact manifest generated
- [ ] Git state captured
- [ ] Evidence pack bundled and hashed
- [ ] No self-claims in output
- [ ] Only raw evidence presented
- [ ] Fail-fast on errors
- [ ] Exit codes captured

---

## 8. References

**Related Specifications:**
- `NRBPL_L1_BASELINE_SEAL_SPEC_v0_1.md` - Baseline seal specification
- `NRBPL_REPO_AUDIT_SYSTEM_v0_1.md` - Audit system specification
- `NRBPL_AUDIT_EXECUTION_CHECKLIST_v0_1.md` - Execution checklist

**External Standards:**
- SHA-256 (FIPS 180-4)
- Git porcelain format v1
- POSIX tar format

---

**Document Status:** NORMATIVE
**Version:** v0.1
**Last Updated:** 2026-01-23
**Compliance:** UGTS/CPL Evidence-First Discipline
