# ARCHITECTURAL CLOSURE TEST SUITE SPEC v1.0
## CAS v1.6 System-Level Closure Validation

**Status:** NORMATIVE (Repo-Seal)
**Applies to:** CAS v1.6 (Meaning-Law-Topology-Coherence-History)
**Goal:** Prove *architectural closure* beyond module-level correctness.

---

## A. Purpose

This specification defines the **Architectural Closure Test Suite (ACTS)** for CAS.
ACTS validates that CAS is *system-closed* along three required properties:

1) **Architectural Loop Integrity**
2) **Governance Determinism**
3) **Historical Consistency (CLP Closure)**

A system is **architecturally sealed** iff all three tests PASS.

---

## B. Definitions

### B.1 CAS Architecture Nodes (Normative)
ACTS treats the architecture as a directed graph with required nodes:

- Cognitive Layer (GSRA Meaning Runtime) : `COG`
- Law Layer (LawVault System)            : `LAW`
- Coherence Gate                         : `CG`
- Full CAS Epistemic Event Binding       : `FCEE`
- Coherence Ledger Protocol Ledger       : `CLP`
- Law Evaluation Algebra                 : `LEAE`
- Law State Topology Embedding           : `LSTI`
- Drift Trajectory Map                   : `LDTM`
- Drift Boundary Classifier              : `LDBC`
- Law Governance Orchestrator            : `LGO`
- Law Update Evidence Integration        : `LUEIP`

### B.2 Required Architectural Edges (Normative)
ACTS defines the minimal required edges:

- `COG -> CG`
- `LAW -> CG`
- `CG  -> FCEE`
- `FCEE -> CLP`
- `LAW -> LEAE -> LSTI -> LDTM -> LDBC -> LGO -> LUEIP -> LAW`

Additionally, write/replay semantics:
- `CG -> CLP` MUST be mediated via `FCEE` (no direct bypass).
- `LUEIP -> LAW` MUST be mediated via `LGO` decision (no direct update bypass).

---

## C. Canonicalization and Hashing Rules

### C.1 Canonical JSON
All hashing MUST use deterministic canonical JSON:
- sort object keys recursively
- preserve array order

### C.2 Hash Rule
`SHA256(stableStringify(obj))`

### C.3 Chain Rule (CLP)
Each ledger event MUST satisfy:
`hash = SHA256(canon(decision) || prevHash)`

---

## D. Test Suite: Required Tests

## D.1 Test-1: Architectural Loop Integrity (ALI)

**Objective:** Ensure no architectural backdoor exists that allows:
- law update without `LGO`
- coherence decision without `FCEE`+`CLP`
- drift stack bypass

**Input:** `arch_graph.json` describing nodes and edges.
**Pass Condition:** Graph contains all required nodes and required edges,
and does NOT include forbidden bypass edges.

**Forbidden bypass edges (minimum set):**
- `CG -> CLP` (bypassing FCEE)
- `LDBC -> LAW` (bypassing LGO+LUEIP)
- `CG -> LUEIP` (bypassing topology/governance)
- `LAW -> LAW` update edge without LUEIP (self-update bypass)

---

## D.2 Test-2: Governance Determinism (GDT)

**Objective:** Prove that governance action is a deterministic function of:
`(topology_region, topology_drift, law_drift_algebra, LSI, MSI, LMC)`.

**Input:**
- `governance_cases.json` (test vectors)
- a deterministic governance function `decideAction(features)` embedded in test runner

**Pass Condition:**
For each case:
- repeated evaluation yields identical action
- action equals expected action in test vector
- no runtime-dependent entropy is used

---

## D.3 Test-3: Historical Consistency / CLP Closure (HCC)

**Objective:** Ensure that system state is historically reconstructible from CLP:
No "current state" is admissible without CLP lineage.

**Input:**
- `clp_ledger_append.jsonl` + `clp_hash_head.txt`
- `input_bundle.json` (or equivalent evidence input)
- a replay verifier for the event type under test

**Pass Condition:**
1) ledger chain integrity holds for all events
2) selected event(s) are replay-verifiable from evidence inputs
3) if a `state_snapshot.json` is provided, its hash MUST match reconstructed state hash

---

## E. Verdict Policy

- PASS iff D.1, D.2, D.3 all PASS
- FAIL if any invariant fails
- REFUSE if required files are missing or malformed

Exit codes:
- 0 PASS
- 2 FAIL
- 3 REFUSE

---

## F. Seal Statement (Normative)

> CAS v1.6 is architecturally sealed iff:
> (i) architectural graph has no bypass edges,
> (ii) governance is deterministic from topology+metrics,
> (iii) CLP constitutes a mandatory historical substrate enabling replay reconstruction.

**End of Spec**
