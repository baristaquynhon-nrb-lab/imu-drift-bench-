# L4++ FULL CAS EPISTEMIC EVENT SPEC (Meaning + Law + Topology Closure)

**Status:** NORMATIVE (Repo-Seal)
**Scope:** CAS Full Epistemic Loop Closure (Meaning <-> Law <-> Topology <-> Coherence <-> History)
**Applies to:** `test_type = "CAS_FULL_EPISTEMIC_TOPOLOGY_MEANING"`
**Supersedes:** `L4_full_epistemic_event_spec.md` (Law+Topology only)

---

## 1. Purpose

This document defines the **minimum CLP event payload** required for a session to achieve:

> **Full CAS epistemic memory** across all five axes:
> Meaning <-> Law <-> Topology <-> Coherence <-> History

A CLP event at this level records not just law-topology binding, but also the
**meaning state**, **meaning drift**, and **meaning stability index (MSI)** --
all replay-verifiable from evidence inputs.

---

## 2. Architectural Statement

After this upgrade, the CLP event is no longer a "topology test record". It is a:

> **CAS Epistemic Memory Cell** --
> a single hash-chained event that co-records Meaning-state, Law-state,
> Topology-state, and Coherence tuple, and is reconstructible from evidence
> inputs without substitution or narrative inference.

The five-axis constraint:

```
Meaning <-> Law <-> Topology <-> Coherence <-> History
    |          |        |            |           |
   MSI       LSI    topology     (MSI,LSI,    CLP hash
  drift    drift      drift      LMC)         chain
```

---

## 3. Canonical Requirement

A CLP event is valid at **L4++ FULL CAS** iff:

1) Event is appended to an **append-only JSONL ledger** (no overwrite).
2) Event participates in a **hash chain**: `hash = SHA256(canon(decision) || prevHash)`.
3) A verifier can **recompute** from `input_bundle.json` and obtain identical values for ALL anchors:
   - `input_hash`
   - `meaning_input_hash`
   - `topology_hash`
   - `meaning_trace_hash`
   - `meaning_state_hash` (last step)
   - `MSI`, `LSI`, all drift fields, `topology_region`

---

## 4. Event Schema (Full CAS Fields)

### 4.1 Meta
- `timestamp` (ISO-8601)
- `session`
- `test_type` = `"CAS_FULL_EPISTEMIC_TOPOLOGY_MEANING"`
- `profile` = `"MEANING_LEAE_LSTI_LDTM_LDBC_CLP_REPLAY"`

### 4.2 Verdict
- `verdict` in {PASS, FAIL}

### 4.3 Coherence Tuple (CG/CLP)
- `MSI` (Meaning Stability Index -- replay-verifiable scalar)
- `LSI` (Law Stability Index -- replay-verifiable scalar)
- `LMC` (coherence marker/class label)

### 4.4 Evidence Anchors
- `input_hash = SHA256(canon(input_bundle))`
- `meaning_input_hash = SHA256(canon(meaning_input_bundle))`

### 4.5 Meaning Binding (NEW in L4++)
- `meaning_state_hash = SHA256(canon(meaning_state_last))`
- `meaning_drift` (scalar, between last two meaning vectors)
- `meaning_trace_hash = SHA256(canon(meaning_trace))`

### 4.6 Algebra Binding (LEAE)
- `leae_S` (vector, deterministic)
- `law_drift_algebra` (scalar drift between last two algebra states)

### 4.7 Topology Binding (LSTI/LDTM/LDBC)
- `topology_X` (vector)
- `topology_drift` (scalar)
- `topology_region` in {GENESIS, Stable, Transition, Mutation}
- `topology_hash = SHA256(canon(topology_trace))`

### 4.8 Chain Fields (Ledger wrapper)
Each JSONL row MUST include:
- `prevHash`
- `hash`

---

## 5. Meaning Pipeline Specification

### 5.1 meaningStateFromLaw(law)

Deterministic mapping from law state to meaning state:
- `meaning_vec`: [coverage, consistency, alignment]
- `meaning_assertions`: sorted array of categorical assertions derived by threshold

### 5.2 MSI (Meaning Stability Index)

```
MSI = mean(meaning_vec)
```

### 5.3 meaning_drift

```
meaning_drift = ||meaning_vec[t] - meaning_vec[t-1]||
```

### 5.4 Determinism Constraint

All meaning functions MUST be deterministic and use `stableStringify` for hashing.
Writer and verifier MUST share identical implementations.

---

## 6. Verification Rule (L4++ Closure)

A session attains **L4++ FULL CAS** only if a replay verifier confirms ALL 12 invariants:

| # | Invariant | Layer |
|---|-----------|-------|
| 1 | `input_hash` match | Evidence |
| 2 | `meaning_input_hash` match | Evidence |
| 3 | `topology_hash` match | Topology |
| 4 | `meaning_trace_hash` match | Meaning |
| 5 | `MSI(last)` match | Meaning |
| 6 | `meaning_state_hash(last)` match | Meaning |
| 7 | `meaning_drift(last)` match | Meaning |
| 8 | `LSI(last)` match | Law |
| 9 | `law_drift_algebra(last)` match | Law |
| 10 | `topology_drift(last)` match | Topology |
| 11 | `topology_region(last)` match | Topology |
| 12 | `leae_S(last)` match | Law |

Failure of any invariant => **Forensic FAIL**.

---

## 7. Seal Statement

> **A CAS session achieves full epistemic historical memory** when its meaning state,
> law algebra state, topology state, and coherence tuple are co-recorded in a single
> hash-chained CLP event, and a replay verifier reconstructs all 12 invariants from
> evidence inputs without substitution or narrative inference.

This is the closure condition for the five-axis CAS architecture:

```
Meaning <-> Law <-> Topology <-> Coherence <-> History
```

---

## 8. Upgrade Path

| Level | Scope | Checks |
|-------|-------|--------|
| L3 Validated | Test passes | 0 invariants |
| L4 Forensic | Law+Topology CLP | 8 invariants |
| L4+ Full Epistemic | + stableStringify + LSI | 8 invariants (canonical) |
| **L4++ Full CAS** | **+ Meaning + MSI + meaning_drift** | **12 invariants** |

**End of Spec**
