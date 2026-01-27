# NTL Lexicon 2K Build Specification v0.1 (Normative)

**Specification:** NTL_LEXICON_2K_BUILD_SPEC_v0_1
**Status:** NORMATIVE
**Level:** L0 (Stub/Pipeline Testing)
**Tool:** tools/gen_lexicon_2k.js v0.1.0
**Scope:** Evidence-first, deterministic, fail-fast lemma inventory construction

---

## 1. Purpose

This specification defines the normative requirements for building a 2000-lemma English-Vietnamese lexicon inventory for NRBPL/NTL (NRBPL Translation Library).

The build process MUST:
- Be **deterministic** (same inputs → same outputs)
- Be **evidence-first** (no unsupported inference)
- Enforce **fail-fast** discipline (REFUSE on policy violations)
- Produce **auditable** build reports with SHA-256 binding

---

## 2. Input Requirements

### 2.1 Source Files

Two JSONL source files are REQUIRED:

1. **Oxford 3000 Seed** (`sources/oxford3000_seed.jsonl`)
2. **WordNet Top** (`sources/wordnet_top.jsonl`)

### 2.2 Source Record Schema

Each source record MUST conform to:

```json
{
  "lemma": "run",
  "pos": "v",
  "vi_gloss": "chạy",
  "ref": "oxford3000:run_v_1"
}
```

**Required Fields:**
- `lemma` (string): MUST be lowercase `[a-z]+` only (no spaces, no hyphens, no mutation)
- `pos` (string): MUST be one of: `{n,v,adj,adv,prep,conj,det,pron,num,interj}`
- `vi_gloss` (string): MUST be 1–4 tokens; MUST NOT contain inference markers or multi-gloss separators
- `ref` (string): Evidence reference (optional but recommended)

**Hard Constraints:**
- **No lemma mutation**: Forms like `can't → cant` are FORBIDDEN
- **No inference markers**: `?`, `??`, `tbd`, `maybe`, `probably`, `approx`, `~` are FORBIDDEN in `vi_gloss`
- **No multi-gloss separators**: `;`, `|`, `/`, `\`, ` - ` are FORBIDDEN in `vi_gloss`

### 2.3 Validation Rules

The builder MUST validate each source record and REFUSE if:
- `lemma` does not match `^[a-z]+$`
- `pos` is not in the canonical POS set
- `vi_gloss` is empty, contains inference markers, or contains multi-gloss separators
- `vi_gloss` token count < 1 or > 4

---

## 3. Merge and Selection Policy

### 3.1 Priority-Based Merge

Source priority order (higher priority wins):
1. **Oxford 3000** (priority 0)
2. **WordNet Top** (priority 1)

Deduplication key: `lemma|pos`

If both sources provide the same `lemma|pos`, the **Oxford 3000** entry is selected.

### 3.2 Selection

From the merged candidate pool:
1. Sort by: `(priority asc, lemma asc, pos asc)`
2. Select the first `N` entries (default: 2000)
3. If candidate pool size < N, builder MUST REFUSE

### 3.3 Output Sorting

Output MUST be sorted by: `(lemma asc, pos asc)` (gate compliance requirement)

---

## 4. Output Requirements

### 4.1 Output File

**Path:** `lexicon/en_vi_lemmas_2k.jsonl`

**Format:** JSONL (one JSON object per line)

**Record Schema:**

```json
{
  "lemma": "run",
  "pos": "v",
  "vi_gloss": "chạy",
  "frame": ""
}
```

**Required Fields:**
- `lemma`, `pos`, `vi_gloss`: from source record
- `frame`: MUST be `""` (scope-lock v0.1)

### 4.2 Build Report

Builder MUST emit a deterministic build report to **stdout**:

```json
{
  "spec": "NTL_LEXICON_2K_BUILD_REPORT_v0_1",
  "tool": "tools/gen_lexicon_2k.js",
  "tool_version": "0.1.0",
  "inputs": {
    "oxford3000_seed": {
      "path": "sources/oxford3000_seed.jsonl",
      "sha256": "<sha256-hex>"
    },
    "wordnet_top": {
      "path": "sources/wordnet_top.jsonl",
      "sha256": "<sha256-hex>"
    }
  },
  "output": {
    "path": "lexicon/en_vi_lemmas_2k.jsonl",
    "lines": 2000,
    "sha256": "<sha256-hex>"
  },
  "policy": {
    "merge": "Oxford3000_priority_then_WordNet",
    "lemma_mutation": "FORBIDDEN",
    "missing_gloss": "REFUSE"
  }
}
```

---

## 5. Exit Codes

Builder MUST use UGTS-compatible exit codes:
- **0**: SUPPORTED (build succeeded)
- **3**: REFUSE (hard fail: validation error, policy violation, insufficient candidates)

---

## 6. Audit Trail

### 6.1 SHA-256 Binding

All input and output files MUST have SHA-256 hashes recorded in the build report.

### 6.2 Determinism Guarantee

Given identical source files (byte-for-byte), the builder MUST produce:
- Identical output file (byte-for-byte)
- Identical build report structure (excluding SHA-256 hashes if source files differ)

---

## 7. Compliance Notes

- This specification is **normative** for NRBPL Level L0 (stub/pipeline testing).
- Implementations MUST NOT add fallback glosses, infer POS, or mutate lemmas.
- Implementations MUST validate all records before merging.
- Implementations MUST emit machine-readable build reports (JSON only).

---

**Version:** 0.1
**Date:** 2025-01-23
**Status:** NORMATIVE
**Related Specs:** NTL_LEXICON_GATE_REPORT_SCHEMA_v0_1, NTL_SENSES_2K_TRACE_SPEC_v0_1
