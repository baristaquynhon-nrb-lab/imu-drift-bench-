# NRBPL Governance Integration Map v0.1
**UGTS/CPL Integration Contract (Spec-Ready)**

**Version:** 0.1
**Date:** 2026-01-23
**Subsystem ID:** NRBPL
**Maturity:** L1 (Minimal Viable Governance)
**Status:** Normative

---

## 1. Purpose (Normative)

This document specifies the mandatory integration contract that registers NRBPL as a governed subsystem in the overall NRB/GSRA architecture.

---

## 2. Integration Requirements (Normative)

**MAP-R1** — Parent repo MUST register NRBPL using:
- `governance/subsystems/NRBPL.registry.json`

**MAP-R2** — Parent repo MUST bind to NRBPL baseline using:
- `evidence/NRBPL_L1_BASELINE_POINTER.json`

**MAP-R3** — Any claim "NRBPL L1 compliant / governed" MUST be refused unless:
- pointer exists AND
- evidence artifacts exist AND
- sha256 + witness binding verify AND
- audit verdict == SUPPORTED

---

## 3. Architecture Diagram (Normative, Block)

```
┌──────────────────────────────────────────────────────────────────────┐
│                  NRB/GSRA PARENT REPOSITORY (GOV)                    │
│                                                                      │
│  (A) Registry: governance/subsystems/NRBPL.registry.json (MUST)     │
│  (B) Pointer : evidence/NRBPL_L1_BASELINE_POINTER.json (MUST)       │
│                                                                      │
│  Verification Rule (MUST):                                           │
│    pointer.sha256 == sha256(_audit/NRBPL_AUDIT_REPORT_L1.json)      │
│    witness binds to same sha256                                      │
│    verdict == SUPPORTED                                              │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           NRBPL SUBSYSTEM                            │
│                                                                      │
│  Plane C — Governance (Mandatory, L1)                                │
│    tools/repo_audit.js             (audit runner)                    │
│    validators/lexicon_gate.js --all (L0 gate)                        │
│    tools/freeze_l1_baseline.js     (seal + witness)                  │
│                                                                      │
│  Plane B — Knowledge (Mandatory, L1)                                 │
│    lexicon/*.jsonl  +  frames/meaning_frames.json                    │
│                                                                      │
│  Evidence Output (Canonical)                                         │
│    _audit/NRBPL_AUDIT_REPORT_L1.json                                 │
│    _audit/NRBPL_AUDIT_REPORT_L1.sha256                               │
│    _audit/NRBPL_AUDIT_WITNESS_L1.json                                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. File Tree Contract (Normative)

### 4.1 Parent repo MUST include:

```
governance/subsystems/NRBPL.registry.json
evidence/NRBPL_L1_BASELINE_POINTER.json
docs/architecture/NRBPL_GOVERNANCE_INTEGRATION_MAP_v0_1.md
```

### 4.2 NRBPL repo MUST include (L1 baseline contract):

```
tools/repo_audit.js
tools/freeze_l1_baseline.js
validators/lexicon_gate.js
schemas/audit_report.schema.json
schemas/witness_seal.schema.json
lexicon/en_vi_lemmas.jsonl
lexicon/en_vi_senses.jsonl
lexicon/collocations_en.jsonl
frames/meaning_frames.json
_audit/NRBPL_AUDIT_REPORT_L1.json
_audit/NRBPL_AUDIT_REPORT_L1.sha256
_audit/NRBPL_AUDIT_WITNESS_L1.json
```

---

## 5. Enforcement Notes (Normative)

- Parent repo MUST refuse governance claims without verifying the bound evidence artifacts.
- Integration MUST remain deterministic and dependency-free at L1.
- Any baseline update MUST produce a new sha256 + witness + pointer update.

(End)
