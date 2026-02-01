# RPP-VTS v1.0 — Reflexive Phase Portrait Validation Suite

**Status:** NORMATIVE
**Runner:** `tools/closure/rpp_phase_portrait_test.js`
**Vectors:** `tools/closure/rpp_cases.json`
**Depends On:** 1.2.ao (RPP), 1.2.an (RFPT), 1.2.ah (Phase Geometry),
1.2.am (ESRE)

---

## Scope

Validate the five canonical portrait invariants (RPP-1 through RPP-5)
on synthetic reflexive trajectories in both HOE and BCE modes.

---

## Test Definitions

### RPP-1 — Basin Convergence

| Field         | Value                                              |
|---------------|----------------------------------------------------|
| Input         | HOE and BCE trajectories starting inside basin     |
| Check         | Final Z within convergence tolerance of Z∞          |
| Accept        | Basin membership preserved throughout              |

### RPP-2 — Extended Lyapunov W* Monotone Decrease (BCE)

| Field         | Value                                              |
|---------------|----------------------------------------------------|
| Input         | BCE trajectory with γ chosen per spec              |
| Check         | W*(E*_{t+1}) ≤ W*(E*_t) for all valid steps        |
| Accept        | W* non-increasing along entire trajectory          |

### RPP-3 — REFUSE Absorbing Stop

| Field         | Value                                              |
|---------------|----------------------------------------------------|
| Input         | Parameters that violate small-gain or basin bound  |
| Check         | System emits REFUSE rather than diverging           |
| Accept        | verdict = REFUSE                                   |

### RPP-4 — Chain Monotone Append-Only

| Field         | Value                                              |
|---------------|----------------------------------------------------|
| Input         | Any valid trajectory                               |
| Check         | V_count monotone increasing; no step reduces it    |
| Accept        | V_{t+1} ≥ V_t for all t                            |

### RPP-5 — Attractor Replay Determinism

| Field         | Value                                              |
|---------------|----------------------------------------------------|
| Input         | Same trajectory run twice                          |
| Check         | Identical Z_t, W_t, V_t sequences                  |
| Accept        | Bitwise equality across runs                       |

### RPP-6 — HOE Fiber Ascent (Z constant, V grows)

| Field         | Value                                              |
|---------------|----------------------------------------------------|
| Input         | HOE trajectory, N steps                            |
| Check         | Z constant; W(Z) constant; V_count = N at end     |
| Accept        | Fiber-bundle semantics: base fixed, fiber grows    |

### RPP-7 — BCE Spiral Descent (W* decreasing to attractor)

| Field         | Value                                              |
|---------------|----------------------------------------------------|
| Input         | BCE trajectory with small-gain satisfied           |
| Check         | W(Z) decreasing; W* decreasing with appropriate γ  |
| Accept        | Trajectory converges to Z∞ attractor               |

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
