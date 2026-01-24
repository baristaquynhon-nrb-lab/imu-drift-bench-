# NRBPL Validation Pipelines Specification v0.1

**Status**: NORMATIVE
**Level**: L2 (Semantic Infrastructure)
**Discipline**: UGTS (Universal Grounded Truth System)

---

## 1. Purpose

This specification defines the validation pipeline architecture for NRBPL, implementing:
- **L2 Semantic Gate**: 10-check validation firewall
- **Closure Runners**: One-command deterministic test execution
- **Evidence Collection**: SHA-256 binding and audit trail generation
- **Verdict Discipline**: 3-state exit codes (SUPPORTED | INSUFFICIENT | REFUSE)

---

## 2. Pipeline Architecture

### 2.1. Three-Layer Validation Stack

```
┌─────────────────────────────────────────────────────┐
│ Layer 3: Closure Runners                           │
│ ├─ run_L1B_colloc_frame_closure.js                 │
│ ├─ run_ENVI_demo_closure.js                        │
│ └─ Orchestrate: preconditions → generation → gate  │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ Layer 2: Semantic Gate (L2 Firewall)               │
│ ├─ validators/semantic_gate.js                     │
│ ├─ 10 validation checks (UGTS-sealed)              │
│ └─ Verdict: SUPPORTED | INSUFFICIENT | REFUSE      │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ Layer 1: Lock-Driven Constraints                   │
│ ├─ SEMANTIC_LAW_LOCK (validation rules)            │
│ ├─ L2_REQUIRED_UNITS_LOCK (mandatory vs optional)  │
│ ├─ L1B_SCOPE_LOCK (count targets)                  │
│ └─ DEMO_CLAIM_LOCK (forbidden claims)              │
└─────────────────────────────────────────────────────┘
```

### 2.2. Data Flow

```
[Precondition Checks]
    ↓
[Lock File Loading]
    ↓
[Artifact Generation] → [Audit Logs]
    ↓
[Semantic Gate Validation]
    ↓         ↓         ↓
[SUPPORTED] [INSUFFICIENT] [REFUSE]
    ↓         ↓         ↓
[Exit 0]   [Exit 2]   [Exit 3]
    ↓
[Evidence Binding (SHA-256)]
    ↓
[Certificate Generation]
```

---

## 3. Semantic Gate Specification

### 3.1. Purpose

The semantic gate is an **L2 semantic firewall** that enforces:
- Non-inferential semantics (no guessing)
- Structural meaning preservation
- Evidence-bound truth conditions
- Deterministic report generation

### 3.2. The 10 Validation Checks

#### Check 1: `semantic_unit_type_known`
**Law**: All semantic unit types must be recognized.

**Valid Types**: `senses`, `collocations`, `frames`

**Enforcement**:
```javascript
const knownTypes = new Set(['senses', 'collocations', 'frames']);
for (const unitType of Object.keys(artifacts)) {
  if (!knownTypes.has(unitType)) {
    dieRefuse('SEMANTIC_UNIT_TYPE_UNKNOWN', { unknown_type: unitType });
  }
}
```

**Failure → Exit 3 (REFUSE)**

---

#### Check 2: `semantic_scope_conservation`
**Law**: Generated counts must not exceed declared scope targets.

**Enforcement**:
```javascript
const scopeLock = JSON.parse(fs.readFileSync('locks/L1B_SCOPE_LOCK_v0_1.json', 'utf8'));

if (counts.collocations > scopeLock.collocations_count_target) {
  dieRefuse('SEMANTIC_SCOPE_EXCEEDED', {
    declared: scopeLock.collocations_count_target,
    actual: counts.collocations
  });
}
```

**Rationale**: Prevents scope creep and enforces explicit declaration.

**Failure → Exit 3 (REFUSE)**

---

#### Check 3: `no_implicit_inference_markers`
**Law**: Scanned fields must not contain inference markers.

**Inference Markers** (from `SEMANTIC_LAW_LOCK`):
```json
{
  "inference_markers": [
    "maybe", "probably", "seems", "likely", "perhaps",
    "~", "tbd", "?",
    "có thể", "có lẽ", "hình như", "tạm", "ước chừng"
  ]
}
```

**Scanned Fields**:
- `senses[].definition`
- `senses[].usage_examples[]`
- `collocations[].pattern`
- `frames[].frame_label`

**Enforcement**:
```javascript
function enforceScan(unitType, record) {
  const scanPaths = semanticLaw.scan_fieldset[unitType] || [];

  for (const path of scanPaths) {
    const stringFields = collectStringFields(record, path.split('.'), []);

    for (const fieldValue of stringFields) {
      const lower = fieldValue.toLowerCase();
      for (const marker of semanticLaw.inference_markers) {
        if (lower.includes(marker)) {
          dieRefuse('INFERENCE_MARKER_DETECTED', {
            field_path: path,
            marker: marker,
            value: fieldValue
          });
        }
      }
    }
  }
}
```

**Failure → Exit 3 (REFUSE)**

---

#### Check 4: `meaning_preservation_no_new_claims`
**Law**: Only allowlisted string fields are permitted.

**Rationale**: Prevents freeform text injection that could introduce implicit claims.

**Allowlist** (from `SEMANTIC_LAW_LOCK`):
```json
{
  "allow_string_fields": [
    "lemma",
    "pos",
    "definition",
    "usage_examples[]",
    "pattern",
    "slots[].label",
    "frame_label",
    "roles[].label",
    "constraints[]",
    "truth_conditions[]"
  ]
}
```

**Enforcement**:
```javascript
function enforceAllowlist(unitType, record) {
  const allStrings = collectStringFields(record, [], []);
  const allowed = new Set(semanticLaw.allow_string_fields);

  for (const fieldPath of allStrings.keys()) {
    if (!allowed.has(fieldPath)) {
      dieRefuse('STRING_FIELD_NOT_ALLOWLISTED', {
        unit_type: unitType,
        field_path: fieldPath
      });
    }
  }
}
```

**Failure → Exit 3 (REFUSE)**

---

#### Check 5: `truth_conditions_enumerable`
**Law**: `truth_conditions` must be an array (enumerable).

**Rationale**: Truth conditions must be inspectable and countable.

**Enforcement**:
```javascript
if (record.truth_conditions && !Array.isArray(record.truth_conditions)) {
  dieRefuse('TRUTH_CONDITIONS_NOT_ENUMERABLE', {
    record_id: record.frame_id,
    actual_type: typeof record.truth_conditions
  });
}
```

**Failure → Exit 3 (REFUSE)**

---

#### Check 6: `truth_conditions_stable_under_replay`
**Law**: Hashing must be deterministic (canonical JSON).

**Enforcement**:
```javascript
function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);

  const sorted = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = canonicalize(obj[k]);
  }
  return sorted;
}

const hash1 = sha256(JSON.stringify(canonicalize(record)));
const hash2 = sha256(JSON.stringify(canonicalize(record)));

if (hash1 !== hash2) {
  dieRefuse('HASH_NOT_DETERMINISTIC', { record_id: record.sense_id });
}
```

**Failure → Exit 3 (REFUSE)**

---

#### Check 7: `trace_fields_present`
**Law**: All 4 trace fields must be present.

**Required Fields**:
1. `source` (enum from `SEMANTIC_LAW_LOCK.allowed_trace_sources`)
2. `source_file_sha256` (64 hex chars)
3. `record_sha256` (64 hex chars)
4. `ref` (must start with allowed prefix)

**Enforcement**:
```javascript
function validateTrace(trace, unitType) {
  const required = ['source', 'source_file_sha256', 'record_sha256', 'ref'];

  for (const field of required) {
    if (!trace || !trace[field]) {
      dieRefuse('TRACE_FIELD_MISSING', {
        unit_type: unitType,
        missing_field: field
      });
    }
  }

  // Validate source is allowed
  if (!semanticLaw.allowed_trace_sources.includes(trace.source)) {
    dieRefuse('TRACE_SOURCE_NOT_ALLOWED', {
      source: trace.source,
      allowed: semanticLaw.allowed_trace_sources
    });
  }

  // Validate ref prefix
  const validPrefix = semanticLaw.allowed_trace_ref_prefixes.some(
    prefix => trace.ref.startsWith(prefix)
  );
  if (!validPrefix) {
    dieRefuse('TRACE_REF_PREFIX_INVALID', {
      ref: trace.ref,
      allowed_prefixes: semanticLaw.allowed_trace_ref_prefixes
    });
  }
}
```

**Failure → Exit 3 (REFUSE)**

---

#### Check 8: `trace_hash_format_valid`
**Law**: Hash fields must be 64 hexadecimal characters.

**Enforcement**:
```javascript
const hashPattern = /^[a-f0-9]{64}$/;

if (!hashPattern.test(trace.source_file_sha256)) {
  dieRefuse('TRACE_HASH_FORMAT_INVALID', {
    field: 'source_file_sha256',
    value: trace.source_file_sha256
  });
}

if (!hashPattern.test(trace.record_sha256)) {
  dieRefuse('TRACE_HASH_FORMAT_INVALID', {
    field: 'record_sha256',
    value: trace.record_sha256
  });
}
```

**Failure → Exit 3 (REFUSE)**

---

#### Check 9: `crossref_integrity`
**Law**: Sense records must contain valid lemma+pos references.

**Enforcement**:
```javascript
// Build lemma index
const lemmaIndex = new Set();
for (const sense of senses) {
  lemmaIndex.add(`${sense.lemma}:${sense.pos}`);
}

// Verify all senses reference existing lemmas
for (const sense of senses) {
  const key = `${sense.lemma}:${sense.pos}`;
  if (!lemmaIndex.has(key)) {
    dieRefuse('CROSSREF_LEMMA_NOT_FOUND', {
      sense_id: sense.sense_id,
      lemma: sense.lemma,
      pos: sense.pos
    });
  }
}
```

**Failure → Exit 3 (REFUSE)**

---

#### Check 10: `deterministic_report_hash`
**Law**: Two-hash separation must be implemented.

**Two Hashes**:
1. `artifact_hashes.set_sha256`: Hash of all input artifact paths + hashes
2. `report_hashes.canonical_sha256`: Self-referential hash with `canonical_sha256=""` placeholder

**Enforcement**:
```javascript
// Compute artifact set hash
const artifactLines = [];
for (const [path, hash] of fileShaMap.entries()) {
  artifactLines.push(`${hash}  ${path}`);
}
artifactLines.sort();
const artifactSetHash = sha256(artifactLines.join('\n'));

// Compute canonical report hash
const reportCopy = JSON.parse(JSON.stringify(report));
reportCopy.report_hashes.canonical_sha256 = '';  // Placeholder
const canonicalHash = sha256(JSON.stringify(canonicalize(reportCopy)));

report.artifact_hashes.set_sha256 = artifactSetHash;
report.report_hashes.canonical_sha256 = canonicalHash;
```

**Verification**:
```javascript
// Replay: recompute both hashes
const replayArtifactHash = computeArtifactSetHash(fileShaMap);
const replayCanonicalHash = computeCanonicalHash(report);

if (replayArtifactHash !== report.artifact_hashes.set_sha256) {
  dieRefuse('ARTIFACT_HASH_MISMATCH', { expected, actual });
}

if (replayCanonicalHash !== report.report_hashes.canonical_sha256) {
  dieRefuse('CANONICAL_HASH_MISMATCH', { expected, actual });
}
```

**Failure → Exit 3 (REFUSE)**

---

### 3.3. Verdict Decision Logic

```javascript
// Step 1: Check mandatory units
const requiredUnits = JSON.parse(
  fs.readFileSync('locks/L2_REQUIRED_UNITS_LOCK_v0_1.json', 'utf8')
);

for (const [unitType, isRequired] of Object.entries(requiredUnits.required_units)) {
  if (isRequired && counts[unitType] === 0) {
    dieRefuse('REQUIRED_UNIT_MISSING', { unit_type: unitType });
  }
}

// Step 2: Check optional units
for (const [unitType, isRequired] of Object.entries(requiredUnits.required_units)) {
  if (!isRequired && counts[unitType] === 0) {
    dieInsufficient('OPTIONAL_UNIT_MISSING', { unit_type: unitType });
  }
}

// Step 3: All checks passed
report.verdict = 'SUPPORTED';
report.exit_code = 0;
console.log(JSON.stringify(report, null, 2));
process.exit(0);
```

**Exit Code Mapping**:
- `0` = SUPPORTED (all checks pass)
- `2` = INSUFFICIENT (optional units missing, but not invalid)
- `3` = REFUSE (invariant violated, validation failed)

---

## 4. Closure Runner Specification

### 4.1. L1-B Collocation+Frame Closure

**File**: `tools/run_L1B_colloc_frame_closure.js`

**Purpose**: One-command deterministic L1-B closure execution.

**Workflow**:
```
1. Precondition Checks
   ├─ Clean worktree (REFUSE if dirty)
   ├─ Required locks exist
   ├─ L1 artifacts exist (lemmas, senses)
   └─ ABI level = "L1B"

2. Load Count Targets
   ├─ Read L1B_SCOPE_LOCK
   ├─ Extract collocations_count_target (100)
   └─ Extract frames_count_target (20)

3. Generate Collocations
   ├─ Deterministic synthetic data
   ├─ Pattern: "{HEAD} + {X}"
   ├─ Populate trace fields (source, sha256, ref)
   └─ Write: lexicon/en_vi_collocations_2k.jsonl

4. Generate Frames
   ├─ Deterministic synthetic data
   ├─ Include truth_conditions[] (enumerable)
   ├─ Populate trace fields
   └─ Write: lexicon/en_vi_frames_2k.jsonl

5. Run Semantic Gate
   ├─ node validators/semantic_gate.js --senses ... --collocations ... --frames ...
   ├─ Capture stdout → _audit/l1b_lexicon_2k/03_semantic_gate.log
   └─ Check exit code (0=SUPPORTED, 2=INSUFFICIENT, 3=REFUSE)

6. SHA-256 Evidence Binding
   ├─ Compute hashes for all artifacts (outputs + locks + validators + tools)
   ├─ Write: _audit/l1b_lexicon_2k/EVIDENCE_SHA256SUMS.txt
   └─ Verify: sha256sum -c EVIDENCE_SHA256SUMS.txt

7. Generate Certificate
   ├─ Extract HEAD commit hash
   ├─ Build ΔC section (anchors + locks)
   ├─ Build ΔS section (artifacts + evidence)
   ├─ Build ΔP section (verdict)
   └─ Write: docs/reports/NRBPL_L1B_COLLOC_FRAME_CLOSURE_CERTIFICATE_v0_1.md
```

**Exit Codes**:
```javascript
// Success
process.exit(0);  // {"verdict":"SUPPORTED","exit_code":0}

// Insufficient (optional units missing)
process.exit(2);  // {"verdict":"INSUFFICIENT","exit_code":2}

// Refuse (invariant violated)
process.exit(3);  // {"verdict":"REFUSE","exit_code":3}
```

---

### 4.2. EN→VI Demo Closure

**File**: `tools/run_ENVI_demo_closure.js`

**Purpose**: Demo scope validation with claim enforcement.

**Workflow**:
```
1. Precondition Checks
   ├─ Clean worktree
   ├─ Required locks exist
   └─ L1 artifacts exist

2. Run Semantic Gate
   ├─ Required for demo scope
   └─ Exit if not SUPPORTED

3. Scan UI Strings for Forbidden Claims
   ├─ Read: demo/envi_demo_ui_strings.txt
   ├─ Load forbidden list from DEMO_CLAIM_LOCK
   └─ REFUSE if any forbidden text detected

4. Evidence Binding
   └─ SHA-256 all artifacts

5. Generate Certificate
   └─ Write: docs/reports/NRBPL_ENVI_DEMO_CLOSURE_CERTIFICATE_v0_1.md
```

**Forbidden Claims** (from `DEMO_CLAIM_LOCK`):
- "understands meaning like humans"
- "correct translation"
- "semantic equivalence"
- "AI understands"
- "truly understands"
- "real understanding"

**Enforcement**:
```javascript
const demoLock = JSON.parse(fs.readFileSync('locks/DEMO_CLAIM_LOCK_v0_1.json', 'utf8'));
const uiStrings = fs.readFileSync('demo/envi_demo_ui_strings.txt', 'utf8');

for (const forbiddenText of demoLock.forbidden_claim_texts) {
  if (uiStrings.toLowerCase().includes(forbiddenText.toLowerCase())) {
    dieRefuse('DEMO_FORBIDDEN_CLAIM_DETECTED', {
      forbidden_text: forbiddenText,
      file: 'demo/envi_demo_ui_strings.txt'
    });
  }
}
```

---

## 5. Evidence Collection

### 5.1. Audit Directory Structure

```
_audit/
└─ l1b_lexicon_2k/
   ├─ 01_gen_collocations.log          # Generation log
   ├─ 02_gen_frames.log                # Generation log
   ├─ 03_semantic_gate.log             # Gate report (JSON)
   ├─ REPLAY_COMMANDS.txt              # Commands to replay
   └─ EVIDENCE_SHA256SUMS.txt          # All artifact hashes
```

### 5.2. Evidence File Format

**File**: `_audit/l1b_lexicon_2k/EVIDENCE_SHA256SUMS.txt`

```
30ba36759ce6ce278282bc773a2d7ff4f221d24601c7f0422ebd9cfcfd921b05  lexicon/en_vi_collocations_2k.jsonl
e2557b2714760603bc773fcdef1ab45bd3319a397c60791f63f72a74c16f178b  lexicon/en_vi_frames_2k.jsonl
718c972ae7bc3f07c165511d4403081fbd0478fc59ac52156d6a1cfdf98f0398  _audit/l1b_lexicon_2k/01_gen_collocations.log
...
d89696f0408157df91f80a681854cbd0605de7808c5ec6b09ea11166bfeda2f1  validators/semantic_gate.js
122e70df9860be59ebf6ffd700bf03ddb51b88ef89fe234876d6059e265efac1  locks/KERNEL_ABI_LOCK.json
...
```

**Verification**:
```bash
cd nrbpl_kernel_core_v0_1_s24
sha256sum -c _audit/l1b_lexicon_2k/EVIDENCE_SHA256SUMS.txt
# All lines must end with: OK
```

### 5.3. Replay Commands

**File**: `_audit/l1b_lexicon_2k/REPLAY_COMMANDS.txt`

```bash
node validators/semantic_gate.js --senses lexicon/en_vi_senses_2k.jsonl --collocations lexicon/en_vi_collocations_2k.jsonl --frames lexicon/en_vi_frames_2k.jsonl
```

**Usage**:
```bash
# Independent verification
bash -x _audit/l1b_lexicon_2k/REPLAY_COMMANDS.txt > /tmp/replay.log 2>&1

# Compare output
sha256sum _audit/l1b_lexicon_2k/03_semantic_gate.log /tmp/replay.log
# Hashes must match
```

---

## 6. Pipeline Execution Examples

### 6.1. Successful L1-B Closure

```bash
$ node tools/run_L1B_colloc_frame_closure.js
{
  "verdict": "SUPPORTED",
  "exit_code": 0,
  "reason_code": null,
  "detail": {
    "level": "L1B",
    "outputs": {
      "collocations": "lexicon/en_vi_collocations_2k.jsonl",
      "frames": "lexicon/en_vi_frames_2k.jsonl"
    },
    "evidence": "_audit/l1b_lexicon_2k/EVIDENCE_SHA256SUMS.txt",
    "certificate": "docs/reports/NRBPL_L1B_COLLOC_FRAME_CLOSURE_CERTIFICATE_v0_1.md"
  }
}

$ echo $?
0
```

### 6.2. Failed Closure (Dirty Worktree)

```bash
$ echo "test" > temp.txt
$ node tools/run_L1B_colloc_frame_closure.js
{
  "verdict": "REFUSE",
  "exit_code": 3,
  "reason_code": "WORKTREE_DIRTY",
  "detail": {
    "hint": "git status --porcelain must be empty"
  }
}

$ echo $?
3
```

### 6.3. Failed Closure (Inference Marker Detected)

```bash
# Simulate inference marker in collocation
$ echo '{"pattern":"maybe {HEAD}","trace":{...}}' >> lexicon/en_vi_collocations_2k.jsonl

$ node validators/semantic_gate.js --collocations lexicon/en_vi_collocations_2k.jsonl
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

$ echo $?
3
```

---

## 7. Compliance

This specification implements:
- **UGTS Discipline**: Fail-fast, no inference, evidence-first
- **L2 Semantic Firewall**: 10-check validation with lock-driven constraints
- **ΔC→ΔS→ΔP Framework**: Anchors → Artifacts → Verdicts
- **Deterministic Verification**: Canonical hashing, replay commands, SHA-256 binding

All validation operations are inspectable and reproducible.

---

**Document Hash**: (computed on commit)
**Effective Date**: 2026-01-24
**Revision**: 0.1
