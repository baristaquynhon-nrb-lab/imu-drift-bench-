# CCEP_VTS_v1_0_SPEC.md

**Coupling Constant Estimation Protocol — Validation Test Suite (CCEP-VTS)**

**Status:** NORMATIVE
**Layer:** 1.2.aj (CCEP)
**Discipline:** UGTS · Deterministic · Replay-Verifiable · IEEE-754 safe

---

## 1. Purpose

Validates that CCEP deterministically estimates:
- K_ML (Meaning → Law coupling)
- K_LT (Law → Topology coupling)
- K_C (Coherence dampening ratio)

from CLP drift trajectory data, using only CG-admissible steps for K_ML/K_LT
and both admissible/inadmissible for K_C.

---

## 2. Input Artifacts

| Artifact | Role |
|---------|------|
| `coupling_constant_cases.json` | Synthetic test vectors with expected K values |

Each case provides per-step drift vectors:
- `delta_M`, `delta_L`, `delta_X`, `delta_C` (numeric)
- `cg_ok` (boolean)

---

## 3. Exit Codes

| Code | Meaning |
|------|---------|
| 0 | PASS — CCEP validated |
| 2 | FAIL — CCEP violation |
| 3 | REFUSE — insufficient data / non-finite / malformed |

---

## 4. Tests

### CCEP-1 — Determinism

Running CCEP twice on identical inputs MUST yield identical K_ML, K_LT, K_C.

---

### CCEP-2 — Coupling Correctness (K_ML, K_LT)

K_ML = median(|ΔL|, admissible) / median(|ΔM|, admissible)
K_LT = median(|ΔX|, admissible) / median(|ΔL|, admissible)

Must match expected values within tolerance.

---

### CCEP-3 — Coherence Dampening (K_C)

K_C = median(|ΔL|, CG_OK) / median(|ΔL|, CG_FAIL)

Must match expected value. Requires both CG_OK and CG_FAIL groups with n ≥ 5.

---

### CCEP-4 — Outlier Robustness (Q99 filtering)

Extreme outlier values (> Q99) must be removed before median computation.
Resulting K must match clean-data expectation.

---

### CCEP-5 — Edge Cases

- Zero denominator (all ΔM = 0) → K_ML = null
- Insufficient data (n < 5) → verdict REFUSE
- No CG_FAIL steps → K_C = null

---

## 5. Acceptance Output

```
--- CCEP-VTS v1.0 ---

PASS [case name]
...

PASS: CCEP-VTS v1.0 — Coupling constant estimation validated.
```

---

## 6. Determinism Requirement

Repeated evaluation MUST produce identical K_ML, K_LT, K_C.
No randomness. Median computed on sorted arrays.

---

## 7. Upgrade Criteria

| Level | Requirement |
|------:|-------------|
| L2 | PASS on synthetic cases |
| L3 | PASS on ≥1 real replay session |
| L4 | Formal bounds linking K to Lyapunov stability margin |

---

## 8. Dependencies

| Section | Role |
|---------|------|
| 1.2.ae | Epistemic State Manifold (metric d) |
| 1.2.af | Stability (K assumptions) |
| 1.2.ah | Phase Space Geometry |
| 1.2.ai | BREP (ε_L, m estimation) |
| 1.2.aj | CCEP (this section) |
