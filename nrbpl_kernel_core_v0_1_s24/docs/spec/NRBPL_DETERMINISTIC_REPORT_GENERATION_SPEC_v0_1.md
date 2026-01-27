# NRBPL Deterministic Report Generation Specification v0.1

**Status**: NORMATIVE
**Level**: L2 (Semantic Infrastructure)
**Discipline**: UGTS (Universal Grounded Truth System)

---

## 1. Purpose

This specification defines how NRBPL generates deterministic, verifiable reports:
- **Canonical JSON**: Recursive key sorting for stable hashing
- **Two-Hash Separation**: Artifact set hash vs. self-referential report hash
- **Replay Verification**: Bit-identical output on rerun
- **Evidence Binding**: SHA-256 cryptographic proof

---

## 2. Core Principles

### 2.1. Determinism Law

**Law**: Identical inputs MUST produce identical outputs (bit-for-bit).

**Rationale**: Non-deterministic reports violate evidence integrity and make verification impossible.

**Implementation**: All report generation uses:
1. Canonical JSON serialization
2. Stable hash algorithms (SHA-256)
3. Fixed iteration order (sorted keys)
4. No timestamps (unless explicitly part of evidence chain)

### 2.2. Two-Hash Separation

**Problem**: How to hash a report that contains its own hash?

**Solution**: Separate artifact hashing from report hashing.

```
artifact_hashes.set_sha256:
  └─ Hash of all INPUT artifacts (files, locks, validators)
  └─ Does NOT include the report itself

report_hashes.canonical_sha256:
  └─ Hash of the ENTIRE report with canonical_sha256=""
  └─ Self-referential: report verifies its own structure
```

**Why?**
- Artifact hash proves inputs haven't changed
- Report hash proves report structure is deterministic
- Both are independently verifiable

---

## 3. Canonical JSON Specification

### 3.1. Canonicalization Algorithm

**Purpose**: Transform any JSON object into a deterministic form.

**Rules**:
1. Recursively sort all object keys alphabetically
2. Preserve array order (arrays are ordered by definition)
3. Preserve primitive values (null, boolean, number, string)
4. No whitespace normalization in JSON.stringify (use compact form)

**Implementation**:
```javascript
function canonicalize(obj) {
  // Base cases: primitives
  if (obj === null) return null;
  if (typeof obj !== 'object') return obj;

  // Arrays: recursively canonicalize elements (preserve order)
  if (Array.isArray(obj)) {
    return obj.map(item => canonicalize(item));
  }

  // Objects: sort keys, recursively canonicalize values
  const sorted = {};
  const keys = Object.keys(obj).sort();  // Alphabetical sort

  for (const key of keys) {
    sorted[key] = canonicalize(obj[key]);
  }

  return sorted;
}
```

**Example**:
```javascript
// Input (unsorted keys)
const input = {
  "verdict": "SUPPORTED",
  "exit_code": 0,
  "checks": {
    "pass": 10,
    "fail": 0
  }
};

// Output (sorted keys)
const canonical = canonicalize(input);
// {
//   "checks": {      // 'checks' comes before 'exit_code' alphabetically
//     "fail": 0,     // 'fail' comes before 'pass'
//     "pass": 10
//   },
//   "exit_code": 0,
//   "verdict": "SUPPORTED"
// }

// Serialization (compact, no spaces)
const json = JSON.stringify(canonical);
// {"checks":{"fail":0,"pass":10},"exit_code":0,"verdict":"SUPPORTED"}

// Hash (SHA-256)
const hash = sha256(json);
```

### 3.2. String Normalization

**Law**: Strings are NOT normalized (preserved as-is).

**Rationale**: String normalization (Unicode, case, whitespace) can destroy semantic meaning.

**Examples**:
```javascript
// These are DIFFERENT strings
"Hello World"   // Two words, one space
"Hello  World"  // Two words, two spaces
"hello world"   // Lowercase
```

**Exception**: Inference marker scanning uses `.toLowerCase()` for detection, but original strings are preserved in reports.

---

## 4. Two-Hash Separation Protocol

### 4.1. Artifact Set Hash

**Purpose**: Prove all input artifacts haven't changed.

**Algorithm**:
```javascript
function computeArtifactSetHash(fileShaMap) {
  // fileShaMap: Map<file_path, sha256_hash>

  // Step 1: Build lines in "hash  path" format (same as sha256sum)
  const lines = [];
  for (const [path, hash] of fileShaMap.entries()) {
    lines.push(`${hash}  ${path}`);
  }

  // Step 2: Sort lines alphabetically by path
  lines.sort();

  // Step 3: Hash the concatenated sorted lines
  const manifest = lines.join('\n');
  const setHash = sha256(manifest);

  return setHash;
}
```

**Example**:
```javascript
const fileShaMap = new Map([
  ['locks/SEMANTIC_LAW_LOCK_v0_1.json', '79459eaac1f2eadcc246f3ac62a5859be9d0a5b4faffc5166ce21d74ea8b9ece'],
  ['validators/semantic_gate.js', 'd89696f0408157df91f80a681854cbd0605de7808c5ec6b09ea11166bfeda2f1'],
  ['lexicon/en_vi_senses_2k.jsonl', '7b1b10c0c26095aa496fd6e2a5a1bb94959c5b43f3115f11610bea04bcad7bb5']
]);

const artifactSetHash = computeArtifactSetHash(fileShaMap);
// "2e62dc91f6c93d57853e04879b4ea1ff6315d466e1dc49dd45ccd251ed0b51ba"
```

**Verification**:
```bash
# Reconstruct manifest
cat <<EOF > /tmp/manifest.txt
79459eaac1f2eadcc246f3ac62a5859be9d0a5b4faffc5166ce21d74ea8b9ece  locks/SEMANTIC_LAW_LOCK_v0_1.json
7b1b10c0c26095aa496fd6e2a5a1bb94959c5b43f3115f11610bea04bcad7bb5  lexicon/en_vi_senses_2k.jsonl
d89696f0408157df91f80a681854cbd0605de7808c5ec6b09ea11166bfeda2f1  validators/semantic_gate.js
EOF

# Compute hash
sha256sum /tmp/manifest.txt
# 2e62dc91f6c93d57853e04879b4ea1ff6315d466e1dc49dd45ccd251ed0b51ba
```

---

### 4.2. Canonical Report Hash

**Purpose**: Prove report structure is deterministic.

**Algorithm**:
```javascript
function computeCanonicalReportHash(report) {
  // Step 1: Deep clone report
  const clone = JSON.parse(JSON.stringify(report));

  // Step 2: Set canonical_sha256 to empty string (placeholder)
  clone.report_hashes.canonical_sha256 = '';

  // Step 3: Canonicalize (sort all keys recursively)
  const canonical = canonicalize(clone);

  // Step 4: Serialize and hash
  const json = JSON.stringify(canonical);
  const hash = sha256(json);

  return hash;
}
```

**Why Empty String Placeholder?**
- Can't compute hash of object that contains its own hash (circular dependency)
- Empty string `""` is a fixed placeholder that makes hashing deterministic
- On replay, compute hash with `canonical_sha256=""` and compare

**Example**:
```javascript
const report = {
  "verdict": "SUPPORTED",
  "exit_code": 0,
  "report_hashes": {
    "canonical_sha256": ""  // Placeholder
  }
};

const hash = computeCanonicalReportHash(report);
// "c120d30b2dfde41882989a37d17c6796ed97bbd3f1ba5261412d9922ca70c4d8"

// Now set the actual hash
report.report_hashes.canonical_sha256 = hash;
```

**Verification (Replay)**:
```javascript
// Load report from file
const report = JSON.parse(fs.readFileSync('_audit/l1b_lexicon_2k/03_semantic_gate.log', 'utf8'));

// Extract claimed hash
const claimedHash = report.report_hashes.canonical_sha256;

// Recompute hash
const recomputedHash = computeCanonicalReportHash(report);

// Verify
if (claimedHash !== recomputedHash) {
  console.error("❌ Report hash mismatch!");
  console.error("   Claimed:", claimedHash);
  console.error("   Recomputed:", recomputedHash);
  process.exit(1);
}

console.log("✅ Report hash verified:", claimedHash);
```

---

## 5. Report Structure Specification

### 5.1. Semantic Gate Report Schema

**File**: `_audit/l1b_lexicon_2k/03_semantic_gate.log`

```json
{
  "spec": "NRBPL_L2_SEMANTIC_GATE_SPEC_v0_1",
  "gate": "validators/semantic_gate.js",
  "level": "L2",
  "verdict": "SUPPORTED" | "INSUFFICIENT" | "REFUSE",
  "exit_code": 0 | 2 | 3,
  "reason_code": null | "ERROR_CODE_STRING",

  "counts": {
    "senses": 2000,
    "collocations": 100,
    "frames": 20
  },

  "checks": {
    "total": 10,
    "pass": 10,
    "fail": 0,
    "items": {
      "semantic_unit_type_known": true,
      "semantic_scope_conservation": true,
      "no_implicit_inference_markers": true,
      "meaning_preservation_no_new_claims": true,
      "truth_conditions_enumerable": true,
      "truth_conditions_stable_under_replay": true,
      "trace_fields_present": true,
      "trace_hash_format_valid": true,
      "crossref_integrity": true,
      "deterministic_report_hash": true
    }
  },

  "artifact_hashes": {
    "set_sha256": "2e62dc91f6c93d57853e04879b4ea1ff6315d466e1dc49dd45ccd251ed0b51ba"
  },

  "report_hashes": {
    "canonical_sha256": "c120d30b2dfde41882989a37d17c6796ed97bbd3f1ba5261412d9922ca70c4d8"
  },

  "first_error": null | {
    "field_path": "...",
    "marker": "...",
    "value": "..."
  }
}
```

### 5.2. Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `spec` | string | ✅ | Report specification version |
| `gate` | string | ✅ | Validator tool path |
| `level` | string | ✅ | Validation level (L1, L1B, L2) |
| `verdict` | enum | ✅ | SUPPORTED \| INSUFFICIENT \| REFUSE |
| `exit_code` | int | ✅ | 0 \| 2 \| 3 |
| `reason_code` | string? | ✅ | Error code (null if SUPPORTED) |
| `counts` | object | ✅ | Unit counts (senses, collocations, frames) |
| `checks` | object | ✅ | Validation check results |
| `artifact_hashes` | object | ✅ | Input artifact set hash |
| `report_hashes` | object | ✅ | Self-referential report hash |
| `first_error` | object? | ✅ | First error details (null if no errors) |

### 5.3. Verdict-Specific Fields

**SUPPORTED** (exit 0):
```json
{
  "verdict": "SUPPORTED",
  "exit_code": 0,
  "reason_code": null,
  "first_error": null
}
```

**INSUFFICIENT** (exit 2):
```json
{
  "verdict": "INSUFFICIENT",
  "exit_code": 2,
  "reason_code": "OPTIONAL_UNIT_MISSING",
  "first_error": {
    "unit_type": "collocations"
  }
}
```

**REFUSE** (exit 3):
```json
{
  "verdict": "REFUSE",
  "exit_code": 3,
  "reason_code": "INFERENCE_MARKER_DETECTED",
  "first_error": {
    "field_path": "pattern",
    "marker": "maybe",
    "value": "maybe {HEAD}"
  }
}
```

---

## 6. Evidence File Formats

### 6.1. SHA256SUMS Format

**File**: `_audit/l1b_lexicon_2k/EVIDENCE_SHA256SUMS.txt`

**Format**: Same as `sha256sum` output
```
<64-hex-hash><two-spaces><relative-path>
```

**Example**:
```
30ba36759ce6ce278282bc773a2d7ff4f221d24601c7f0422ebd9cfcfd921b05  lexicon/en_vi_collocations_2k.jsonl
e2557b2714760603bc773fcdef1ab45bd3319a397c60791f63f72a74c16f178b  lexicon/en_vi_frames_2k.jsonl
d89696f0408157df91f80a681854cbd0605de7808c5ec6b09ea11166bfeda2f1  validators/semantic_gate.js
```

**Generation**:
```javascript
const lines = [];
for (const [path, hash] of fileShaMap.entries()) {
  lines.push(`${hash}  ${path}`);
}
lines.sort();
fs.writeFileSync('_audit/l1b_lexicon_2k/EVIDENCE_SHA256SUMS.txt', lines.join('\n') + '\n');
```

**Verification**:
```bash
cd nrbpl_kernel_core_v0_1_s24
sha256sum -c _audit/l1b_lexicon_2k/EVIDENCE_SHA256SUMS.txt
```

Expected output:
```
lexicon/en_vi_collocations_2k.jsonl: OK
lexicon/en_vi_frames_2k.jsonl: OK
validators/semantic_gate.js: OK
...
```

---

### 6.2. REPLAY_COMMANDS Format

**File**: `_audit/l1b_lexicon_2k/REPLAY_COMMANDS.txt`

**Format**: Bash script (one command per line)

**Example**:
```bash
node validators/semantic_gate.js --senses lexicon/en_vi_senses_2k.jsonl --collocations lexicon/en_vi_collocations_2k.jsonl --frames lexicon/en_vi_frames_2k.jsonl
```

**Usage**:
```bash
# Execute replay
bash _audit/l1b_lexicon_2k/REPLAY_COMMANDS.txt > /tmp/replay.log 2>&1

# Compare output
sha256sum _audit/l1b_lexicon_2k/03_semantic_gate.log /tmp/replay.log
```

**Determinism Check**:
```bash
# Run twice
bash _audit/l1b_lexicon_2k/REPLAY_COMMANDS.txt > /tmp/run1.log 2>&1
bash _audit/l1b_lexicon_2k/REPLAY_COMMANDS.txt > /tmp/run2.log 2>&1

# Compare hashes
sha256sum /tmp/run1.log /tmp/run2.log
# Both hashes MUST match
```

---

## 7. Closure Certificate Format

### 7.1. ΔC→ΔS→ΔP Structure

**File**: `docs/reports/NRBPL_L1B_COLLOC_FRAME_CLOSURE_CERTIFICATE_v0_1.md`

```markdown
# NRBPL_L1B_COLLOC_FRAME_CLOSURE_CERTIFICATE_v0_1
Status: CLOSURE-CERTIFIED (L1-B)

## ΔC — Condition (Anchors + Locks)
- HEAD: 58156b1a70c8bccf39c57eaf981b01606aecf0c8
- locks: locks/PATCH_SCOPE_LOCK_v0_1.json, locks/KERNEL_ABI_LOCK.json, locks/SEMANTIC_LAW_LOCK_v0_1.json, locks/L2_REQUIRED_UNITS_LOCK_v0_1.json, locks/L1B_SCOPE_LOCK_v0_1.json

## ΔS — Stability (Artifacts + Evidence Chain)
- lexicon/en_vi_collocations_2k.jsonl sha256: 30ba36759ce6ce278282bc773a2d7ff4f221d24601c7f0422ebd9cfcfd921b05
- lexicon/en_vi_frames_2k.jsonl sha256: e2557b2714760603bc773fcdef1ab45bd3319a397c60791f63f72a74c16f178b
- evidence: _audit/l1b_lexicon_2k/EVIDENCE_SHA256SUMS.txt

## ΔP — Phenomenon (Gate Verdict)
- semantic gate log: _audit/l1b_lexicon_2k/03_semantic_gate.log
- verdict: SUPPORTED (exit 0) iff semantic_gate.js returned exit 0
```

### 7.2. Certificate Generation

**Algorithm**:
```javascript
const HEAD = execSync('git rev-parse HEAD', {encoding: 'utf8'}).trim();

const lockFiles = [
  'locks/PATCH_SCOPE_LOCK_v0_1.json',
  'locks/KERNEL_ABI_LOCK.json',
  'locks/SEMANTIC_LAW_LOCK_v0_1.json',
  'locks/L2_REQUIRED_UNITS_LOCK_v0_1.json',
  'locks/L1B_SCOPE_LOCK_v0_1.json'
];

const outputs = [
  { path: 'lexicon/en_vi_collocations_2k.jsonl', hash: sha256File(...) },
  { path: 'lexicon/en_vi_frames_2k.jsonl', hash: sha256File(...) }
];

const certificate = `
# NRBPL_L1B_COLLOC_FRAME_CLOSURE_CERTIFICATE_v0_1
Status: CLOSURE-CERTIFIED (L1-B)

## ΔC — Condition (Anchors + Locks)
- HEAD: ${HEAD}
- locks: ${lockFiles.join(', ')}

## ΔS — Stability (Artifacts + Evidence Chain)
${outputs.map(o => `- ${o.path} sha256: ${o.hash}`).join('\n')}
- evidence: _audit/l1b_lexicon_2k/EVIDENCE_SHA256SUMS.txt

## ΔP — Phenomenon (Gate Verdict)
- semantic gate log: _audit/l1b_lexicon_2k/03_semantic_gate.log
- verdict: SUPPORTED (exit 0) iff semantic_gate.js returned exit 0
`;

fs.writeFileSync('docs/reports/NRBPL_L1B_COLLOC_FRAME_CLOSURE_CERTIFICATE_v0_1.md', certificate.trim());
```

---

## 8. Determinism Verification Protocol

### 8.1. Independent Verification Steps

```bash
# Step 1: Verify artifact hashes
cd nrbpl_kernel_core_v0_1_s24
sha256sum -c _audit/l1b_lexicon_2k/EVIDENCE_SHA256SUMS.txt
# All must be: OK

# Step 2: Replay semantic gate
node validators/semantic_gate.js \
  --senses lexicon/en_vi_senses_2k.jsonl \
  --collocations lexicon/en_vi_collocations_2k.jsonl \
  --frames lexicon/en_vi_frames_2k.jsonl \
  > /tmp/replay_gate.log

# Step 3: Compare gate log hashes
sha256sum _audit/l1b_lexicon_2k/03_semantic_gate.log /tmp/replay_gate.log
# Hashes MUST match

# Step 4: Verify report canonical hash
node -e '
const fs = require("fs");
const crypto = require("crypto");

function canonicalize(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  const sorted = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = canonicalize(obj[k]);
  }
  return sorted;
}

const report = JSON.parse(fs.readFileSync("_audit/l1b_lexicon_2k/03_semantic_gate.log", "utf8"));
const claimedHash = report.report_hashes.canonical_sha256;

const clone = JSON.parse(JSON.stringify(report));
clone.report_hashes.canonical_sha256 = "";
const canonical = canonicalize(clone);
const json = JSON.stringify(canonical);
const recomputedHash = crypto.createHash("sha256").update(json).digest("hex");

if (claimedHash === recomputedHash) {
  console.log("✅ Canonical hash verified:", claimedHash);
  process.exit(0);
} else {
  console.error("❌ Hash mismatch!");
  console.error("   Claimed:", claimedHash);
  console.error("   Recomputed:", recomputedHash);
  process.exit(1);
}
'

# Step 5: Verify certificate HEAD matches repository
CERT_HEAD=$(grep "^- HEAD:" docs/reports/NRBPL_L1B_*.md | awk '{print $3}')
REPO_HEAD=$(git rev-parse HEAD)

if [ "$CERT_HEAD" = "$REPO_HEAD" ]; then
  echo "✅ Certificate HEAD matches repository"
else
  echo "❌ HEAD mismatch!"
  echo "   Certificate: $CERT_HEAD"
  echo "   Repository:  $REPO_HEAD"
  exit 1
fi
```

### 8.2. Forensic Audit Checklist

- [ ] All artifacts in `EVIDENCE_SHA256SUMS.txt` exist and verify: `sha256sum -c`
- [ ] Semantic gate replay produces identical output (hash match)
- [ ] Canonical report hash is correct (recompute with `canonical_sha256=""`)
- [ ] Certificate HEAD matches current repository HEAD: `git rev-parse HEAD`
- [ ] No audit logs are committed to git: `git ls-files _audit/ | wc -l` = 0
- [ ] All lock files are committed and unchanged
- [ ] Verdict matches exit code (0=SUPPORTED, 2=INSUFFICIENT, 3=REFUSE)

---

## 9. Common Pitfalls and Anti-Patterns

### 9.1. ❌ Non-Deterministic Timestamps

**Anti-Pattern**:
```javascript
const report = {
  "verdict": "SUPPORTED",
  "timestamp": Date.now()  // ❌ NON-DETERMINISTIC
};
```

**Why?**: Each run produces a different timestamp, breaking hash verification.

**Solution**: Only include timestamps if they're part of evidence (e.g., git commit timestamp).

---

### 9.2. ❌ Unsorted Object Keys

**Anti-Pattern**:
```javascript
const report = {
  "verdict": "SUPPORTED",
  "exit_code": 0,
  "checks": {...}
};

// Direct serialization (key order undefined in JavaScript)
const json = JSON.stringify(report);
```

**Why?**: JavaScript object key iteration order is not guaranteed in all engines.

**Solution**: Always use `canonicalize()` before hashing.

---

### 9.3. ❌ Single Hash for Everything

**Anti-Pattern**:
```javascript
// Hash the entire report including inputs
const everything = {
  inputs: [...],
  outputs: [...],
  report: {...}
};
const hash = sha256(JSON.stringify(everything));
```

**Why?**: Circular dependency - can't hash a report that contains its own hash.

**Solution**: Use two-hash separation (artifact set hash + canonical report hash).

---

### 9.4. ❌ Relative Paths in Evidence

**Anti-Pattern**:
```
# EVIDENCE_SHA256SUMS.txt
30ba36759...  ../lexicon/en_vi_collocations_2k.jsonl  ❌
```

**Why?**: Breaks verification when run from different directories.

**Solution**: Always use paths relative to repository root.

---

## 10. Compliance

This specification implements:
- **Canonical JSON**: Recursive key sorting for deterministic serialization
- **Two-Hash Separation**: Artifact set hash + self-referential report hash
- **Replay Verification**: Bit-identical output on rerun
- **Evidence Binding**: SHA-256 cryptographic proof of integrity

All report generation is deterministic and independently verifiable.

---

**Document Hash**: (computed on commit)
**Effective Date**: 2026-01-24
**Revision**: 0.1
