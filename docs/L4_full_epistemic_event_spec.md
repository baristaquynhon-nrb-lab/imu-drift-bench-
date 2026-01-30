# L4+ FULL EPISTEMIC CLP EVENT SPEC (CAS Closure Seal)

**Status:** NORMATIVE (Repo-Seal)
**Scope:** CAS Forensic Loop Closure (LEAE <-> Topology <-> Coherence)
**Applies to:** `test_type = "CAS_FULL_EPISTEMIC_TOPOLOGY"` and general CAS runs that require L4 forensic reproducibility.

---

## 1. Purpose

This document defines the **minimum CLP event payload** required to upgrade a session from:

> **Topology memory only**

to:

> **Full epistemic memory** (law algebra drift <-> topology drift <-> coherence drift)
all bound into **one hash-chained, replay-verifiable ledger**.

---

## 2. Canonical Requirement

A CLP event is valid at **L4+ FULL EPISTEMIC** iff:

1) Event is appended to an **append-only JSONL ledger** (no overwrite).
2) Event participates in a **hash chain**: `hash = SHA256(canon(decision) || prevHash)`.
3) A verifier can **recompute** from `input_bundle.json` and obtain:
   - identical `input_hash`,
   - identical `topology_hash`,
   - identical `LSI` and drift fields required by this spec.

---

## 3. Event Schema (Minimum Fields)

### 3.1 Meta
- `timestamp` (ISO-8601)
- `session`
- `test_type`
- `profile`

### 3.2 Verdict
- `verdict` in {PASS, FAIL}

### 3.3 Evidence Anchors (Delta-C binding)
- `input_hash = SHA256(canon(input_bundle))`

### 3.4 Algebra Binding (LEAE)
- `leae_S` (vector, deterministic)
- `LSI` (scalar derived from LEAE)
- `law_drift_algebra` (scalar drift between last two algebra states)

### 3.5 Topology Binding (LSTI/LDTM/LDBC)
- `topology_X` (vector)
- `topology_drift` (scalar)
- `topology_region` in {GENESIS, Stable, Transition, Mutation}
- `topology_hash = SHA256(canon(topology_trace))`

### 3.6 Coherence Tuple (CG/CLP)
- `MSI` (nullable in topology-only benches)
- `LMC` (label or numeric; must be present)
- `LSI` (shared invariant between algebra and coherence)

### 3.7 Chain Fields (Ledger wrapper)
Each JSONL row MUST include:
- `prevHash`
- `hash`

---

## 4. Determinism Constraint

**Canon() must be stable**. Implementations MUST use a deterministic canonical serializer that:
- sorts object keys recursively,
- preserves array order,
- emits identical bytes across runs given identical inputs.

---

## 5. Verification Rule (L4+ Closure)

A session attains **L4+ FULL EPISTEMIC** only if a replay verifier confirms:

- CLP chain integrity (all `hash` match recomputation; all `prevHash` link)
- `input_hash` match
- `topology_hash` match
- `LSI(last)` match
- `law_drift_algebra(last)` match
- `topology_drift(last)` and `topology_region(last)` match

Failure of any invariant => **Forensic FAIL**.

---

## 6. Seal Statement

> **A CAS session is forensically closed** when its law algebra state, topology state, and coherence tuple are co-recorded in a single hash-chained CLP event, and replay determinism proves the event is reconstructible from evidence inputs without substitution or narrative inference.

**End of Spec**
