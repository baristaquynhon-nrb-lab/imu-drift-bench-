# NRBPL Architecture Map v0.1 (NRBPL-ARCH-MAP-v0.1)
**Controlled Compilation + Interpretive Translation + Repository Audit Governance**

**Version:** 0.1
**Date:** 2026-01-23
**Scope:** NRBPL / GSRA
**Status:** Normative — Spec-ready
**Audience:** NRBPL implementers, auditors, maintainers
**Principle:** Evidence-first discipline (UGTS/CPL), deterministic, fail-fast, audit-grade, canonical-sealable.

---

## 0. Normative Objective

NRBPL SHALL be managed as a **governed, auditable, deterministic system** consisting of:

- **Language Plane** (biên dịch / dịch thuật có kiểm soát)
- **Knowledge Plane** (Translation Library — NTL, dữ liệu chuẩn hoá)
- **Governance Plane** (Repository Audit System — kiểm soát repo + sealing)

NRBPL MUST NOT be operated as a loose collection of scripts/specs without governance integration.

---

## 1. Three-Plane Architecture (Normative)

### 1.1 Plane A — Language Plane (Execution Semantics)
**Purpose:** Convert controlled language input into canonical intermediate forms and executable kernel artifacts.

**A1 — Controlled NL Compiler (NRBPL-NL v0.1)**
- NL → CNL → IR → Opcodes
- Deterministic compilation; no inference.

**A2 — Interpretive Translation Core (NITL / NRBPL-TCS v1.0)**
- Interpretation/Comprehension → Deverbalization → Re-expression
- Translation is meaning → language mapping; prohibits word→word as primary mechanism.

**Outputs (Language Plane)**
- Canonical IR objects (meaning IR, execution IR)
- Canonical opcode streams (if applicable)
- Deterministic re-expression outputs (when permitted by gates)

### 1.2 Plane B — Knowledge Plane (NTL: NRBPL Translation Library)
**Purpose:** Provide sealed, deterministic, provenance-bound resources for meaning-first translation.

**B1 — L0 Lexicon**
- Lemma inventory (single-word base forms only)
- Sense inventory (sense_id, constraints, mapping to frames)
- Collocations (explicit, non-lemma; stored as collocations, not lemmas)

**B2 — L1 Frames / Roles**
- Frame catalog (event types)
- Role inventory (semantic roles)
- Meaning constraints

**B3 — Canonical Corpus**
- Gold samples with fixed 5 artifacts per sample:
  - source.txt
  - target.vi.txt
  - align.json (meaning-segment level)
  - meaning_ir.json (deverbalized)
  - audit.json (phase markers + ΔC references)

**B4 — L2 Realization Templates (optional in v0.1)**
- Semantics-preserving fluency operations whitelist
- Must be auditable and gate-controlled

**Outputs (Knowledge Plane)**
- Sealed NTL packs (canonical build, deterministic hash)
- Replayable meaning resources

### 1.3 Plane C — Governance Plane (Repository Audit System)
**Purpose:** Enforce UGTS/CPL discipline at repo level; prevent loopholes; enable CANONICAL+SEALED+FROZEN lifecycle.

**C1 — Validators (Hard Gates)**
- Lexicon gates (L0 invariants + cross-file checks)
- Meaning IR gate (schema + deverbalization markers)
- Alignment gate (meaning-segment alignment constraints)
- NITL gate (phase marker enforcement; no re-expression without prior phases)
- TSL gate (ΔC anchor / evidence sufficiency gate)
- HTL claim gate (blocks human-like claims without artifacts)

**C2 — Schemas**
- JSON schemas for IRs, manifests, witness seals, audit reports

**C3 — Audit Runner**
- Deterministic execution of validator chain
- Emits machine-readable `audit.json` to stdout and writes artifacts under `_audit/`

**C4 — Canonical Sealing**
- Manifest sha256 binding
- Witness seal binding
- Freeze policy (immutable tags)

**Outputs (Governance Plane)**
- Repo compliance verdicts
- Audit reports
- Sealed manifests & witness records

---

## 2. Mandatory Dataflow (Normative)

### 2.1 Translation/Interpretive Pipeline (NITL)
NRBPL translation claims MUST follow:

1) **Comprehension**: source → meaning_ir (schema valid)
2) **Deverbalization**: meaning_ir.language_independent = true
3) **Re-expression**: allowed ONLY if (1) and (2) are verifiably completed

### 2.2 Governance Gating Order (Hard Requirement)
Any build/seal operation MUST run gates in this order:

1) `validators/tsl_gate.js` (ΔC anchor / evidence gate)
2) `validators/lexicon_gate.js` (L0; `--all` cross-check mode for NTL)
3) `validators/meaning_ir_gate.js` (per sample / per IR)
4) `validators/alignment_gate.js` (per sample)
5) `validators/nitl_gate.js` (pipeline phase integrity)
6) `validators/htl_claim_gate.js` (claim hygiene)

If any gate returns verdict ≠ SUPPORTED → build MUST fail-fast (non-zero exit).

---

## 3. Repository State Machine (Normative)

NRBPL repo SHALL be operated under this lifecycle:

- **DEV**: editable, no seal claims
- **AUDITED**: audit runner PASS, outputs archived
- **SEALED**: manifest + witness generated; hash-bound
- **FROZEN**: read-only canonical tag; any changes require version bump

Rules:
- SEALED artifacts MUST be reproducible via deterministic build.
- Any post-seal modification MUST bump version and re-audit.

---

## 4. Minimal Compliance Surfaces (v0.1)

NRBPL v0.1 SHALL be considered governance-complete when:

- Audit runner exists and can be executed offline
- All required validators exist and are chained
- NTL build uses canonical mode (no timestamp in pack)
- manifest + witness binding is produced
- A single "CANONICAL_SEALED_v0.1" build can be reproduced

---

## 5. Non-Compliance Classes (Normative)

NRBPL MUST refuse or fail-fast when:

- Token/word→word is used as primary translation mechanism under NITL claim
- Re-expression occurs without deverbalized meaning IR
- Lexicon contains multiword lemmas, duplicates, or unsupported counts
- Any sealed artifact is not hash-consistent with manifest/witness
- A build emits "PASS" without running mandatory gates

---

## 6. Reference Integration Points

- `docs/spec/NRBPL-TCS-v1.0` (Interpretive Translation Core Law)
- `docs/spec/NTL_BUILD_PIPELINE_v0_1.md` (NTL construction)
- `docs/spec/NRBPL_REPO_AUDIT_SYSTEM_v0_1.md` (Repo audit normative spec)
- `schemas/audit_report.schema.json` (Audit report schema)
- `schemas/witness_seal.schema.json` (Witness seal schema)
- `tools/repo_audit.js` (Audit runner entrypoint)

---

## 7. File Tree (Normative Structure)

```
nrbpl/
├── docs/
│   └── spec/
│       ├── NRBPL-ARCH-MAP-v0.1.md              # This document
│       ├── NRBPL-TCS-v1.0.md                   # Translation Core Spec
│       ├── NTL_BUILD_PIPELINE_v0_1.md          # Build pipeline
│       └── NRBPL_REPO_AUDIT_SYSTEM_v0_1.md     # Audit system spec
├── schemas/
│   ├── nitl_meaning_ir.schema.json
│   ├── audit_report.schema.json
│   ├── witness_seal.schema.json
│   └── manifest.schema.json
├── validators/
│   ├── lexicon_gate.js           # v1.0.1 (supports --all)
│   ├── meaning_ir_gate.js
│   ├── alignment_gate.js
│   ├── nitl_gate.js
│   ├── tsl_gate.js
│   └── htl_claim_gate.js
├── tools/
│   └── repo_audit.js             # Audit runner (deterministic, no deps)
├── lexicon/
│   ├── en_vi_lemmas.jsonl
│   ├── en_vi_senses.jsonl
│   └── collocations_en.jsonl
├── frames/
│   ├── meaning_frames.json
│   └── role_inventory.json
├── corpus/
│   └── canonical/
│       ├── *.source.txt
│       ├── *.target.vi.txt
│       ├── *.align.json
│       ├── *.meaning_ir.json
│       └── *.audit.json
├── manifests/                    # Generated
│   └── *.sha256
├── witness/                      # Generated
│   └── *.WITNESS.json
└── _audit/                       # Generated (optional in dev)
    └── audit_YYYYMMDD/
```

---

## 8. Governance Contracts (Hard Requirements)

### 8.1 Gate Contract (all validators)
Each validator MUST:
- Write exactly one JSON object to stdout
- JSON format: `{ "verdict": "...", "reason_codes": [...], "checks": {...}, "scope": "...", "artifact_refs": [...] }`
- Exit code mapping:
  - `0` = SUPPORTED
  - `2` = INSUFFICIENT / CONTRADICTORY
  - `3` = REFUSE

### 8.2 Audit Runner Contract
`tools/repo_audit.js` MUST:
- Produce consolidated audit JSON to stdout
- Include per-gate results as array
- Include deterministic ordering
- Include overall verdict

### 8.3 Build Contract
Any build that emits SEALED artifacts MUST:
- Have an audit PASS (SUPPORTED) immediately before sealing
- Bind pack hash into manifest + witness

---

## 9. Versioning & Freeze

After first successful canonical seal, tag:
```
CANONICAL_SEALED_v0.1
```

Any changes to:
- validators
- schemas
- build scripts
- lexicon/frames/corpus

MUST bump version (v0.1 → v0.2 or v0.1.1) and re-seal.

---

## 10. Technical Notes (Loophole Prevention)

- `lexicon_gate.js` v1.0.1 when running `--all` MUST:
  - Reject multiword "lemma inventory" (but **collocations** MAY be multiword)
  - Cross-check: every `sense.lemma` MUST exist in lemmas
  - Cross-check: `collocation.lemma` MUST exist in lemmas
  - Reject duplicates globally by `(lemma,pos)` and `sense_id`, `collocation_id`
  - stdout JSON only (no log text), for `tools/repo_audit.js` to parse directly

- `build_ntl_pack.js` MUST NOT call gates via `require()` (easy to bypass/hard-to-audit)
  - MUST call via **CLI child_process** and parse stdout JSON

---

**Document Version:** 0.1
**Last Updated:** 2026-01-23
**Status:** Normative Specification
