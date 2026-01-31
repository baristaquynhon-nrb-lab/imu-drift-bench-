# RVE_VTS_v1_0_SPEC.md

**Reflexive Verification Embedding — Validation Test Suite (RVE-VTS)**

**Status:** NORMATIVE
**Layer:** 1.2.ak (RVE)
**Discipline:** UGTS · Deterministic · Replay-Verifiable

---

## 1. Purpose

Validates that CAS verification results are correctly embedded as epistemic
events in the CLP chain, with deterministic hashing and replay verifiability.

---

## 2. Exit Codes

| Code | Meaning |
|------|---------|
| 0 | PASS — RVE validated |
| 2 | FAIL — RVE violation |
| 3 | REFUSE — insufficient data |

---

## 3. Tests

### RVE-1 — Event Formation

Every VTS result must produce a well-formed VERIFICATION_EVENT containing:
event_type, layer, spec_hash, runner_hash, case_hash, result_hash, verdict.

### RVE-2 — Hash Canonicality

Hashes must be deterministic: same input → same hash. Re-hashing the same
content must produce identical spec_hash, runner_hash, case_hash, result_hash.

### RVE-3 — Replay Verification

Given a stored VERIFICATION_EVENT, re-running the verification with the same
inputs must produce the same result_hash.

### RVE-4 — Chain Immutability

Verification events appended to the history chain must be append-only.
No prior event may be modified. Chain hash must be consistent.

---

## 4. Output Format

```
--- RVE-VTS v1.0 ---

PASS [RVE-1: ...]
PASS [RVE-2: ...]
PASS [RVE-3: ...]
PASS [RVE-4: ...]

PASS: RVE-VTS v1.0 — Reflexive Verification Embedding validated.
```
