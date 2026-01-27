# NRBPL Repository Audit System v0.1 (Normative)

**Project:** NRBPL — Neuro Reflex Binary Programming Language
**Component:** Evidence-Bound Repository Audit
**Author:** Nguyen Ngoc Thi
**Status:** Normative (v0.1)
**Date:** 2026-01-23

---

## 0. Scope

This document specifies the mandatory repository audit procedure for NRBPL, aligned with UGTS/CPL:
- Evidence-first (ΔC artifacts are mandatory)
- Deterministic verification
- Fail-fast discipline
- No claim without proof (no narrative-only audit)

The audit SHALL be executed by the tool:
```bash
node tools/repo_audit.js
```

---

## 1. Conformance Terms

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", and "MAY"
are to be interpreted as described in RFC 2119.

---

## 2. Audit as a Mandatory Step

### 2.1 Required Invocation

A conformant repository MUST support running the audit tool as follows:

```bash
node tools/repo_audit.js --scope ntl --mode canonical
```

The audit tool MUST:
- Execute checks in deterministic order
- Emit evidence artifacts under `_audit/`
- Emit a machine-checkable audit report JSON
- Exit with a normative exit code (Section 6)

### 2.2 Prohibited Behavior

The audit tool MUST NOT:
- Claim PASS without emitting ΔC artifacts
- Modify Kernel ABI-locked files
- Infer success from partial results

---

## 3. Preconditions (Mandatory)

A conformant audit run REQUIRES:

1. Node.js runtime environment available
2. Repository structure present (lexicon/, frames/, corpus/, etc.)
3. Validator scripts present in `validators/`
4. Schemas present in `schemas/`

If any required precondition is missing, audit verdict MUST be REFUSE.

---

## 4. Required Evidence Artifacts (ΔC)

A conformant audit run MUST create a dedicated audit directory:
```
_audit/repo_audit_<TIMESTAMP>/
```

Within that directory, the following artifacts MUST be present:

**audit_report.json**
- Consolidated audit report with per-gate results
- Verdict (SUPPORTED/INSUFFICIENT/REFUSE)
- Exit code
- Timestamp UTC
- Gates array with individual results

**gate_outputs/ (optional)**
- Individual gate output artifacts for forensics

---

## 5. Audit Report Schema (Normative)

The final audit report MUST be a JSON object conforming to `schemas/audit_report.schema.json`:

```json
{
  "spec": "NRBPL_AUDIT_REPORT_v0.1",
  "scope": "ntl",
  "mode": "canonical",
  "timestamp_utc": "2026-01-23T10:00:00.000Z",
  "verdict": "SUPPORTED|INSUFFICIENT|REFUSE",
  "exit_code": 0|2|3,
  "gates": [
    {
      "gate_id": "LEXICON_GATE_ALL",
      "cmd": "validators/lexicon_gate.js",
      "argv": [...],
      "verdict": "SUPPORTED",
      "exit_code": 0,
      "audit": {...},
      "errors": []
    }
  ]
}
```

The audit tool MUST write this JSON to stdout.

---

## 6. Verdict Semantics and Exit Codes (Normative)

Verdict rules:

**SUPPORTED (exit code 0)**
- All mandatory checks pass
- All required evidence artifacts are produced
- No critical errors

**INSUFFICIENT (exit code 2)**
- Checks execute but reveal insufficient evidence
- Soft failures
- May be acceptable in dev mode

**REFUSE (exit code 3)**
- Hard preconditions missing
- Critical violations detected
- Build MUST halt

Exit codes (normative):
- SUPPORTED → exit code `0`
- INSUFFICIENT → exit code `2`
- REFUSE → exit code `3`

---

## 7. Validator Chain (Deterministic Order)

The audit runner MUST execute validators in this order:

1. `validators/tsl_gate.js` (ΔC anchor / evidence gate) — optional if file exists
2. `validators/lexicon_gate.js --all` (L0 cross-check mode) — REQUIRED
3. `validators/meaning_ir_gate.js` (per sample) — optional if file exists
4. `validators/alignment_gate.js` (per sample) — optional if file exists
5. `validators/nitl_gate.js` (pipeline phase integrity) — optional if file exists
6. `validators/htl_claim_gate.js` (claim hygiene) — optional if file exists

If any REQUIRED validator is missing, verdict MUST be REFUSE.

If any validator returns REFUSE, the audit MUST stop immediately (fail-fast).

---

## 8. Validator Contract (Normative)

Each validator MUST:

**Input:**
- Accept CLI arguments (e.g., `--all`, `--lemmas`, `--senses`, etc.)
- Execute deterministically (same inputs → same outputs)

**Output:**
- Write exactly ONE JSON object to stdout (machine-readable)
- JSON format:
```json
{
  "verdict": "SUPPORTED|INSUFFICIENT|CONTRADICTORY|OUT_OF_SCOPE|REFUSE",
  "reason_codes": ["CODE1", "CODE2"],
  "checks": {...},
  "scope": "...",
  "artifact_refs": [...]
}
```

**Exit Codes:**
- `0` = SUPPORTED
- `2` = INSUFFICIENT / CONTRADICTORY
- `3` = REFUSE

**Prohibited:**
- Writing logs to stdout (use stderr if needed)
- Requiring external dependencies (must be standalone Node.js)
- Modifying any files during validation

---

## 9. Integration Requirements (Mandatory)

A conformant repository SHOULD expose a package script:

```json
{
  "scripts": {
    "audit": "node tools/repo_audit.js --scope ntl --mode canonical"
  }
}
```

If present, CI pipelines SHOULD run:
```bash
npm run audit
```

---

## 10. Canonical Sealing (Normative)

After a successful audit (SUPPORTED verdict), a canonical build MAY be sealed:

**Manifest Generation:**
```bash
sha256sum <artifact> > manifests/<ARTIFACT_ID>.sha256
```

**Witness Generation:**
```json
{
  "spec": "NRBPL_WITNESS_SEAL_v1.0",
  "artifact": {
    "id": "NTL_v0.1",
    "path": "path/to/artifact"
  },
  "integrity": {
    "sha256": "abc123..."
  },
  "seal": {
    "mode": "CANONICAL_SEALED",
    "timestamp_utc": "2026-01-23T10:00:00.000Z",
    "issuer": "Nguyen Ngoc Thi"
  }
}
```

Sealed artifacts MUST be reproducible (deterministic build).

---

## 11. Non-Normative Notes

- Determinism probe is coarse; prefer hashing canonical artifacts if available
- Git evidence is best-effort; absence of git does not necessarily imply FAIL
- Audit runner is intentionally standalone (no external dependencies)

---

## 12. Example Usage

```bash
# Run audit
node tools/repo_audit.js --scope ntl --mode canonical

# Save output
node tools/repo_audit.js --scope ntl --mode canonical --out _audit/report.json

# Integrate in build pipeline
node tools/repo_audit.js --scope ntl --mode canonical && node build/build_ntl_pack.js
```

---

**Document Version:** 0.1
**Last Updated:** 2026-01-23
**Status:** Normative Specification
