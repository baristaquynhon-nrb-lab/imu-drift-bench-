# REBT-VTS v1.0 — Representation–Epistemic Boundary Theorem Validation Suite

**Status:** NORMATIVE
**Runner:** `tools/closure/rebt_boundary_test.js`
**Vectors:** `tools/closure/rebt_cases.json`
**Depends On:** 6.y.4 (REB-T), 6.y.2 (SRT), 6.y.3 (EIT)

---

## Scope

Validate the RP/EP boundary criterion and gauge group properties
on synthetic linear operators over a representation fiber space ℋ
with epistemic base ΔP.

Model: ℋ = ℝ⁴, ΔP = ℝ² (first 2 components).
- Encode(ΔP) = [ΔP[0], ΔP[1], 0, 0]
- Decode(h)  = [h[0], h[1]]
- T is a 4×4 matrix
- RP criterion: T[0:2, 0:2] = I₂ and T[0:2, 2:4] = 0₂

---

## Test Definitions

### REBT-1 — Identity Operator (trivially RP)

| Field  | Value                                          |
|--------|------------------------------------------------|
| Input  | T = I₄, test ΔP vectors                       |
| Check  | Decode(T · Encode(ΔP)) = ΔP for all vectors   |
| Accept | classification = RP                            |

### REBT-2 — Fiber-Only Transform (RP)

| Field  | Value                                          |
|--------|------------------------------------------------|
| Input  | T with I₂ top-left, arbitrary bottom-right     |
| Check  | Projection preserved for all test ΔP           |
| Accept | classification = RP                            |

### REBT-3 — Epistemic Shift (EP)

| Field  | Value                                          |
|--------|------------------------------------------------|
| Input  | T with top-left ≠ I₂ (e.g., scaling on base)  |
| Check  | ∃ ΔP where round-trip ≠ ΔP                     |
| Accept | classification = EP, requires CG gate          |

### REBT-4 — Fiber-to-Base Mixing (EP)

| Field  | Value                                          |
|--------|------------------------------------------------|
| Input  | T with I₂ top-left but nonzero top-right block |
| Check  | Encode includes zeros in fiber; T mixes them in |
| Accept | classification = EP for general h inputs        |

### REBT-5 — Gauge Group Composition Closure

| Field  | Value                                          |
|--------|------------------------------------------------|
| Input  | T₁ ∈ RP, T₂ ∈ RP                              |
| Check  | T₁ · T₂ ∈ RP (top-left block = I₂)            |
| Accept | composed operator classified as RP             |

### REBT-6 — EP Detection + CG Gate Enforcement

| Field  | Value                                          |
|--------|------------------------------------------------|
| Input  | T ∈ EP, CG gate check                         |
| Check  | Operator flagged, CG required before apply     |
| Accept | cg_required = true                             |

### REBT-7 — Near-Identity Perturbation (EP by epsilon)

| Field  | Value                                          |
|--------|------------------------------------------------|
| Input  | T with top-left = I₂ + ε (tiny perturbation)  |
| Check  | Even small ε → EP classification               |
| Accept | classification = EP (no silent drift allowed)  |

### REBT-8 — Deterministic Replay

| Field  | Value                                          |
|--------|------------------------------------------------|
| Input  | Same operators and ΔP vectors, run twice       |
| Check  | Identical classifications and round-trip values |
| Accept | Bitwise equality across runs                   |

---

## Exit Codes

| Code | Meaning                  |
|------|--------------------------|
| 0    | All checks PASS          |
| 2    | Expected REFUSE honored  |
| 3    | Unexpected failure       |

---

## Determinism

All computations use IEEE 754 double-precision matrix arithmetic.
No randomness. Replay of same vectors must produce identical output.
