# BREP_VTS_v1_0_SPEC.md

**Basin Radius Estimation Protocol — Validation Test Suite (BREP-VTS)**

**Status:** NORMATIVE
**Layer:** 1.2.ai (BREP)
**Discipline:** UGTS · Deterministic · Replay-Verifiable · IEEE-754 safe

---

## 1. Purpose

Validates that BREP deterministically estimates:
- ε_L_hat (basin radius)
- m_hat (boundary shell half-width)

from CG-admissible drift data, and that the derived partition {B, S, M} is
complete and consistent.

---

## 2. Input Artifacts

| Artifact | Role |
|---------|------|
| `basin_radius_cases.json` | Synthetic test vectors and expected ranges |
| Optional: CLP ledger jsonl | Real-session estimation (L3 upgrade path) |

Each synthetic case must provide:
- `drifts[]` numeric
- `cg_ok[]` boolean (aligned length)
- optional `expect` constraints

---

## 3. Exit Codes

| Code | Meaning |
|------|---------|
| 0 | PASS — BREP validated |
| 2 | FAIL — BREP violation |
| 3 | REFUSE — insufficient data / non-finite / malformed |

---

## 4. Tests

### BREP-1 — Determinism

Running BREP twice on identical inputs MUST yield identical:
- ε_L_hat
- m_hat
- derived region labels per step

---

### BREP-2 — Quantile Boundary Correctness

Let D be admissible drifts.
Let ε_L_hat = Q_p(D) per spec.

Test:
- ε_L_hat MUST equal expected quantile from sorted D (index floor(p*(n-1))).

---

### BREP-3 — Robust Shell Width Correctness

Let sigma_hat = 1.4826 * MAD(D).
Let m_hat = max(m_min, k * sigma_hat).

Test:
- m_hat MUST match formula exactly within numeric tolerance `tol`.

Default tol:
- 1e-12 for synthetic finite cases.

---

### BREP-4 — Partition Completeness and Disjointness

Given ε_L_hat and m_hat, assign each step:
- Stable / Transition / Mutation per 1.2.ai.5.

Test:
- every step has exactly one label.
- no step has multiple labels.

---

### BREP-5 — Coherence Boundary Dominance

Any step with cg_ok=false MUST be labeled Mutation, regardless of drift.

---

## 5. Acceptance Output

Runner prints:

```
--- BREP-VTS v1.0 ---

PASS [case name]
...

PASS: BREP-VTS v1.0 — Basin radius estimation validated.
```

---

## 6. Determinism Requirement

Repeated evaluation MUST produce identical ε_L_hat, m_hat, and labels.

No randomness allowed. Quantile and MAD computations are fully deterministic
on sorted arrays with floor-index selection.

---

## 7. Upgrade Criteria

| Level | Requirement |
|------:|-------------|
| L2 | PASS on synthetic cases |
| L3 | PASS on ≥1 real replay session and used downstream in PSG-VTS as parameters |
| L4 | Formal bound proofs (outside VTS scope) |

---

## 8. Dependencies

| Section | Role |
|---------|------|
| 1.2.ae | Epistemic State Manifold (metric d) |
| 1.2.af | Stability under Bounded Revision |
| 1.2.ag | Phase Transition Theorem (CPTT) |
| 1.2.ah | Phase Space Geometry (partition definitions) |
| 1.2.ai | Basin Radius Estimation Protocol (this section) |
