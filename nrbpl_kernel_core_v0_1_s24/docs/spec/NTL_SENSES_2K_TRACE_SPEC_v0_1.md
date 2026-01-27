# NTL Senses 2K Trace Specification v0.1 (Normative)

**Specification:** NTL_SENSES_2K_TRACE_SPEC_v0_1
**Status:** NORMATIVE
**Level:** L0 (Stub/Pipeline Testing)
**Tool:** tools/gen_senses_2k.js v0.1.0
**Scope:** Evidence-first, deterministic sense generation with mandatory trace

---

## 1. Purpose

This specification defines the normative requirements for building a 2000-sense English-Vietnamese sense inventory for NRBPL/NTL.

**Core Principles:**
- **Evidence-first:** No sense without source evidence
- **Trace-mandatory:** Every sense MUST have complete trace fields
- **Deterministic:** Same inputs → same outputs
- **Fail-fast:** REFUSE on missing evidence or policy violations

---

## 2. Input Requirements

### 2.1 Required Inputs

1. **Lemmas File** (`lexicon/en_vi_lemmas_2k.jsonl`) — from lexicon builder
2. **Oxford Senses Source** (`sources/oxford3000_senses.jsonl`)
3. **WordNet Senses Source** (`sources/wordnet_senses.jsonl`)

### 2.2 Sense Source Record Schema

Each sense source record MUST conform to:

```json
{
  "lemma": "run",
  "pos": "v",
  "rank": 1,
  "en_gloss": "move fast on foot",
  "vi_gloss": "chạy",
  "ref": "oxford3000:run_v_1"
}
```

**Required Fields:**
- `lemma` (string): lowercase `[a-z]+` only
- `pos` (string): canonical POS
- `rank` (integer): sense rank (1-based)
- `en_gloss` (string): English sense definition (evidence anchor)
- `vi_gloss` (string): Vietnamese sense translation
- `ref` (string): evidence reference ID

**Hard Constraints:**
- `en_gloss` MUST NOT be empty
- `vi_gloss` MUST NOT be empty
- Both MUST NOT contain inference markers (`??`, `tbd`, `maybe`, `probably`, `approx`, `~`)
- Both MUST NOT contain multi-gloss separators (`;`, `|`, `/`, `\`, ` - `)
- `rank` MUST be integer ≥ 1

---

## 3. Sense Selection Policy

### 3.1 Source Priority

For each `lemma|pos`:
1. **Prefer Oxford 3000 senses** (if available)
2. **Else use WordNet senses** (if available)
3. **Else REFUSE** (no inference allowed)

### 3.2 Max Senses Per Lemma

Default: **MAX = 3 senses per lemma|pos**

Constraint: `MAX ≤ 9` (to prevent sense explosion at L0/L1)

Selection:
- Sort source senses by `(rank asc, ref asc)` (deterministic tie-breaking)
- Take first `MIN(MAX, available_senses)` senses

### 3.3 Mandatory Evidence

If no sense source records exist for a `lemma|pos` in the lemmas file, the builder MUST **REFUSE**.

---

## 4. Sense ID Canonical Format

### 4.1 Format

Sense ID MUST follow the canonical format:

```
${lemma}.${pos}.${NN}
```

Where:
- `lemma`: lowercase lemma string
- `pos`: canonical POS
- `NN`: 2-digit sense number (01, 02, ..., 09)

**Examples:**
- `run.v.01`
- `run.v.02`
- `run.v.03`

### 4.2 Numbering

Sense numbers MUST start at `01` and increment sequentially for each lemma|pos.

---

## 5. Trace Requirements

### 5.1 Mandatory Trace Fields

Every sense record MUST include a `trace` object with the following fields:

```json
{
  "trace": {
    "source": "oxford3000",
    "source_file_sha256": "<sha256-hex>",
    "record_sha256": "<sha256-hex>",
    "ref": "oxford3000:run_v_1"
  }
}
```

**Field Definitions:**
- `source` (string): Source name (`"oxford3000"` or `"wordnet"`)
- `source_file_sha256` (string): SHA-256 hash of the source JSONL file (entire file bytes)
- `record_sha256` (string): SHA-256 hash of the canonical JSON serialization of the source record
- `ref` (string): Evidence reference ID from source record

### 5.2 Canonical Record Hash

`record_sha256` MUST be computed as:

```
SHA256(JSON.stringify(canonicalize(source_record)))
```

Where `canonicalize()`:
1. Recursively sorts all object keys
2. Removes whitespace (no spacing in JSON.stringify)
3. Preserves array order

### 5.3 Source File Hash

`source_file_sha256` MUST be computed as:

```
SHA256(entire_file_bytes)
```

---

## 6. Output Requirements

### 6.1 Output File

**Path:** `lexicon/en_vi_senses_2k.jsonl`

**Format:** JSONL (one JSON object per line)

**Record Schema:**

```json
{
  "sense_id": "run.v.01",
  "lemma": "run",
  "pos": "v",
  "vi_gloss": "chạy",
  "en_gloss": "move fast on foot",
  "frame": "",
  "trace": {
    "source": "oxford3000",
    "source_file_sha256": "<sha256-hex>",
    "record_sha256": "<sha256-hex>",
    "ref": "oxford3000:run_v_1"
  }
}
```

**Required Fields:**
- `sense_id`: canonical format
- `lemma`, `pos`: from lemma inventory
- `vi_gloss`, `en_gloss`: from sense source
- `frame`: MUST be `""` (scope-lock v0.1)
- `trace`: complete trace object (all 4 fields required)

**Sorting:** Output MUST be sorted by `(lemma asc, pos asc, sense_id asc)`

### 6.2 Build Report

Builder MUST emit a deterministic build report to **stdout**:

```json
{
  "spec": "NTL_SENSES_2K_BUILD_REPORT_v0_1",
  "tool": "tools/gen_senses_2k.js",
  "tool_version": "0.1.0",
  "inputs": {
    "lemmas": {
      "path": "lexicon/en_vi_lemmas_2k.jsonl",
      "sha256": "<sha256-hex>"
    },
    "oxford3000_senses": {
      "path": "sources/oxford3000_senses.jsonl",
      "sha256": "<sha256-hex>"
    },
    "wordnet_senses": {
      "path": "sources/wordnet_senses.jsonl",
      "sha256": "<sha256-hex>"
    }
  },
  "policy": {
    "prefer": "oxford3000",
    "max_senses_per_lemma": 3,
    "missing_sense_source": "REFUSE"
  },
  "output": {
    "path": "lexicon/en_vi_senses_2k.jsonl",
    "senses": 4500,
    "sha256": "<sha256-hex>"
  }
}
```

---

## 7. Exit Codes

Builder MUST use UGTS-compatible exit codes:
- **0**: SUPPORTED (build succeeded)
- **3**: REFUSE (hard fail: missing evidence, validation error, policy violation)

---

## 8. Audit Trail

### 8.1 SHA-256 Binding

All input and output files MUST have SHA-256 hashes recorded in the build report.

### 8.2 Determinism Guarantee

Given identical source files (byte-for-byte), the builder MUST produce:
- Identical output file (byte-for-byte)
- Identical build report structure (excluding SHA-256 hashes if source files differ)

### 8.3 Trace Verification

Any downstream validator MUST be able to:
1. Verify `source_file_sha256` against actual source file
2. Verify `record_sha256` against canonical source record
3. Confirm `ref` exists in source file

---

## 9. Compliance Notes

- This specification is **normative** for NRBPL Level L0 (stub/pipeline testing).
- Implementations MUST NOT infer senses, glosses, or trace fields.
- Implementations MUST REFUSE if any lemma|pos has no sense source records.
- Implementations MUST emit machine-readable build reports (JSON only).
- Implementations MUST enforce `MAX ≤ 9` to prevent sense explosion.

---

## 10. Rationale

### 10.1 Why Trace Is Mandatory

Without trace:
- No way to verify sense authenticity
- No way to audit evidence chain
- Impossible to detect unsupported inference
- Cannot replay builds for forensic analysis

### 10.2 Why Two-Hash Separation

- `source_file_sha256`: Binds to entire source file (integrity)
- `record_sha256`: Binds to individual record (granularity)

This allows:
- Detecting file corruption
- Detecting record tampering
- Fine-grained audit trails

### 10.3 Why MAX ≤ 9

At L0/L1, limiting senses per lemma:
- Reduces pipeline complexity
- Ensures 2-digit sense IDs (`01`..`09`)
- Prevents "sense explosion" in early development
- Can be relaxed at higher maturity levels

---

**Version:** 0.1
**Date:** 2025-01-23
**Status:** NORMATIVE
**Related Specs:** NTL_LEXICON_2K_BUILD_SPEC_v0_1, NTL_LEXICON_GATE_REPORT_SCHEMA_v0_1
