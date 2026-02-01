# RFPT-VTS v1.0 — Reflexive Fixed-Point Theorem Validation Suite

**Status:** NORMATIVE
**Runner:** `tools/closure/rfpt_fixed_point_test.js`
**Vectors:** `tools/closure/rfpt_cases.json`
**Depends On:** 1.2.an (RFPT), 1.2.af (Lyapunov), 1.2.am (ESRE)

---

## Scope

Validate that the reflexive CAS operator 𝓕 admits a fixed point E*∞
and that trajectories converge without divergence, under both HOE and
BCE embedding modes.

---

## Test Definitions

### RFPT-1 — HOE Fixed Point (trivial)

| Field         | Value                                              |
|---------------|----------------------------------------------------|
| Input         | Z_0 scalar, mode=HOE, N steps                     |
| Check         | Z_t = Z_0 for all t; V grows by 1 per step        |
| Accept        | Z unchanged, W(Z) constant                        |

### RFPT-2 — BCE Contractive Convergence

| Field         | Value                                              |
|---------------|----------------------------------------------------|
| Input         | Z_0, mode=BCE, α, β, λ_V, N steps                 |
| Check         | W(Z_t) monotone decreasing; Z converges to Z∞      |
| Accept        | |Z_N − Z∞| < convergence_tol                       |

### RFPT-3 — Verification Boundedness

| Field         | Value                                              |
|---------------|----------------------------------------------------|
| Input         | Trajectory from RFPT-1 or RFPT-2                   |
| Check         | W_V(V_{t+1}) − W_V(V_t) ≤ B_V for each step       |
| Accept        | All steps satisfy bound                            |

### RFPT-4 — Fixed-Point Self-Consistency

| Field         | Value                                              |
|---------------|----------------------------------------------------|
| Input         | Converged state E*∞ from RFPT-2                    |
| Check         | Apply 𝓕 once more: Z does not change beyond tol    |
| Accept        | |𝓕(Z∞) − Z∞| < tol                                |

### RFPT-5 — Deterministic Replay

| Field         | Value                                              |
|---------------|----------------------------------------------------|
| Input         | Same parameters as RFPT-2, run twice               |
| Check         | Both runs produce identical Z trajectories          |
| Accept        | Exact bitwise equality on all Z_t                  |

### RFPT-6 — Small-Gain Violation (expect REFUSE)

| Field         | Value                                              |
|---------------|----------------------------------------------------|
| Input         | BCE parameters where αλ_V ≥ β                      |
| Check         | Runner detects violation, emits REFUSE              |
| Accept        | verdict = REFUSE, exit code 2                      |

---

## Exit Codes

| Code | Meaning                  |
|------|--------------------------|
| 0    | All checks PASS          |
| 2    | Expected REFUSE honored  |
| 3    | Unexpected failure       |

---

## Determinism

All computations use IEEE 754 double-precision arithmetic.
No randomness. Replay of same vectors must produce identical output.
