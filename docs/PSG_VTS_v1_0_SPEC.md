# PSG_VTS_v1_0_SPEC.md

**Phase Space Geometry — Validation Test Suite (PSG-VTS)**

**Status:** NORMATIVE
**Layer:** 1.2.ah (CAS Phase Space Geometry)
**Discipline:** UGTS · Deterministic · Replay-Verifiable · Law-Topology Consistent

---

## 1. Purpose

This VTS validates **Section 1.2.ah (Phase Space Geometry of CAS)**:

> CAS phase space decomposes into Basin, Boundary Shell, and Mutation Region as
> a disjoint partition of the Epistemic State Manifold, governed by two
> independent boundaries (drift threshold and coherence admissibility), with
> cause-classified governance and absorbing-state trajectory semantics.

The suite verifies:
- **Geometric partition soundness** (Basin / Shell / Mutation)
- **Admissible set closure** (CG as independent boundary)
- **Multi-step trajectory legality** (no illegal phase jumps)
- **Hysteresis / absorbing-state semantics**
- **Governance phase-selectivity** (cause-classified actions)

---

## 2. Input Artifacts

| Artifact | Role |
|---------|------|
| `phase_space_cases.json` | Synthetic controlled test vectors (single-step + multi-step) |
| LDBC operator (symmetric margin) | Region classifier |
| LGO operator (cause-selective) | Governance operator |
| CG gate | Coherence admissibility |

---

## 3. Exit Codes

| Code | Meaning |
|------|---------|
| 0 | PASS — PSG validated |
| 2 | FAIL — PSG violation |
| 3 | REFUSE — insufficient data |

---

## 4. PSG Tests

### PSG-1 — Admissible Set Closure

If `cg_ok = false`:

```
region MUST equal "Mutation"
state MUST be marked outside Ω (admissible = false)
```

This re-confirms CPTT-2 but adds the explicit Ω-membership check.

---

### PSG-2 — Basin & Boundary Shell Soundness (Symmetric Margin)

Given parameters `ε_L` and `margin`:

| Condition | Required Region |
|-----------|----------------|
| drift < (ε_L − margin) ∧ cg_ok | Stable |
| \|drift − ε_L\| ≤ margin ∧ cg_ok | Transition |
| drift > (ε_L + margin) ∨ ¬cg_ok | Mutation |

**Key difference from CPTT:** margin is applied symmetrically around ε_L,
closing the gap where "just above epsilon" could ambiguously be Transition.

---

### PSG-3 — Multi-step Trajectory Legality

Given a sequence of events `[E_0, E_1, ..., E_n]`:

**Legal transitions:**

| From → To | Condition |
|-----------|-----------|
| Stable → Stable | Always legal |
| Stable → Transition | Always legal |
| Transition → Stable | Always legal |
| Transition → Transition | Always legal |
| Transition → Mutation | Always legal |
| Stable → Mutation | Only if drift > ε_L + margin OR ¬cg_ok |
| Mutation → Mutation | Always legal (absorbing) |

**Illegal:** Stable → Mutation with small drift and cg_ok = true.

**Recovery transitions** (Mutation → Transition or Mutation → Stable):
- Only legal if `recovery_allowed = true` in config
- Requires drift < ε_L − margin AND cg_ok = true for ≥ k consecutive steps

---

### PSG-4 — Hysteresis / Absorbing State

If `recovery_allowed = false` (default):

```
Once region = Mutation, all subsequent steps MUST remain Mutation
```

If `recovery_allowed = true`:

```
Recovery requires:
  - drift < (ε_L − margin) for ≥ k consecutive steps
  - cg_ok = true for all k steps
  - recovery target region = Stable (not Transition)
```

---

### PSG-5 — Governance Phase-Selective

When region = Mutation, governance action depends on **mutation cause**:

| Cause | Condition | Valid Actions |
|-------|-----------|---------------|
| DRIFT | drift > ε_L + margin ∧ cg_ok | {FORK, SHIFT} |
| COHERENCE | ¬cg_ok ∧ drift ≤ ε_L + margin | {SHIFT, DEPRECATE} |
| COMPOUND | drift > ε_L + margin ∧ ¬cg_ok | {FORK, SHIFT, DEPRECATE} |

Non-Mutation regions:
| Region | Valid Actions |
|--------|---------------|
| Stable | {NOOP} |
| Transition | {PATCH} |

---

## 5. Acceptance Rubric

| Test | Requirement |
|------|-------------|
| PSG-1 | ¬cg_ok → Mutation + outside Ω |
| PSG-2 | Symmetric margin produces correct region for all drift values |
| PSG-3 | No illegal trajectory jumps in multi-step sequences |
| PSG-4 | Mutation is absorbing (or recovery follows k-step rule) |
| PSG-5 | Governance action matches mutation cause |

---

## 6. Determinism Requirement

Repeated evaluation MUST produce identical region, cause, and governance output.

No randomness allowed. Multi-step sequences must produce identical trajectory
classifications on every run.

---

## 7. Output Format

```
--- PSG-VTS v1.0 ---

PASS [PSG-1: case name]
PASS [PSG-2: case name]
PASS [PSG-3: trajectory name]
PASS [PSG-4: absorbing/recovery name]
PASS [PSG-5: governance name]
PASS [DETERMINISM]

PASS: PSG-VTS v1.0 — Phase Space Geometry validated.
```

---

## 8. Geometric Invariants Checked

| ID | Invariant |
|----|-----------|
| GI-1 | B, S, M form disjoint partition of E |
| GI-2 | B ⊂ Ω (all basin states are CG-admissible) |
| GI-3 | Ω^c ⊂ M (CG-inadmissible → Mutation) |
| GI-4 | Stable→Mutation requires explicit cause |
| GI-5 | Mutation absorbing unless recovery_allowed + k-step |

---

## 9. Upgrade Criteria

| Level | Requirement |
|-------|-------------|
| L2 | PSG-VTS PASS on synthetic vectors |
| L3 | PSG-VTS PASS on ≥1 real session (replay-verifiable) |
| L4 | Formal proof of partition completeness + basin geometry bounds |

---

## 10. Dependencies

| Section | Role |
|---------|------|
| 1.2.ae | Epistemic State Manifold (metric d) |
| 1.2.af | Stability under Bounded Revision (Lyapunov) |
| 1.2.ag | Phase Transition Theorem (CPTT) |
| 1.2.ah | Phase Space Geometry (this section) |
| 1.2.ad | Law–Topology Consistency |
| 1.2.ac | LDBC Boundary Semantics |
