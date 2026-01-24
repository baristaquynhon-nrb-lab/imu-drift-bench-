# NRBPL_L2_SEMANTIC_VALIDATION_LAW_v0_1.md

**NRBPL Specification v0.1 — L2 Semantic Validation Law (Normative)**

**Status**: NORMATIVE
**Level**: L2 (Semantic Integrity Layer)
**Applies to**: Lexicon, Sense Graph, Translation Runtime, Collocation, Frame Systems
**Discipline**: UGTS · evidence-first · fail-fast · deterministic

---

## 1. Purpose (Normative)

This law defines mandatory constraints for preserving:

1. **Meaning integrity**
2. **Truth conditions**
3. **Non-inferential semantics**

across all NRBPL L2 pipelines.

Any system component producing or transforming semantic artifacts
(`MEANING`, `SENSE`, `TRANSLATION`, `COLLOCATION`, `FRAME`)
**MUST** comply with this law.

**Violation of this law MUST result in REFUSE (exit 3).**

---

## 2. Core Definitions (Normative)

### 2.1 Meaning (NRBPL)

**Meaning** is defined as:

> A symbol-to-reality mapping that is:
> - **grounded in evidence**
> - **stable under replay**
> - **falsifiable by conditions**

Meaning is **NOT**:
- statistical similarity
- latent embedding proximity
- inferred intention without trace

---

### 2.2 Truth Condition

A **truth condition** is the set of explicit conditions under which
a semantic unit may be considered valid.

Truth conditions **MUST** be:
- **enumerable**
- **inspectable**
- **evidence-bound**

---

## 3. Section C — Preconditions (Normative)

### C.1 Mandatory Semantic Scope Lock

Any L2 semantic validation **MUST** require:

```
locks/SEMANTIC_LAW_LOCK_v0_1.json
locks/PATCH_SCOPE_LOCK_v0_1.json
```

**Missing lock → REFUSE.**

---

### C.2 Eligible Semantic Units

This law applies to:

- `sense`
- `sense_pair`
- `collocation`
- `frame`
- `translation_unit`

Any other unit type **MUST** be explicitly declared or **REFUSE**.

---

## 4. Section D — Semantic Invariants (Normative)

### D.1 Meaning Preservation Invariant

A transformation **MUST** preserve meaning iff:

1. No new semantic claim is introduced
2. No semantic claim is removed
3. No truth condition is altered

**If any of the above is violated → REFUSE.**

---

### D.2 No Implicit Inference Rule

A semantic unit **MUST NOT**:

- infer intent
- infer causality
- infer metaphor
- infer abstraction

unless **explicitly declared and evidence-bound**.

**Detection of implicit inference markers → REFUSE.**

---

### D.3 Truth Condition Stability

For any semantic unit `S`:

> The set of truth conditions **MUST** remain identical across replay.
> Reordering is allowed; mutation is **NOT**.

**Mismatch across runs → REFUSE.**

---

### D.4 Semantic Scope Conservation

A semantic unit **MUST NOT** exceed its declared scope.

Examples of scope violations:

- `sense` used outside declared `POS`
- `collocation` applied without `frame`
- `translation` applied without `sense` binding

**Any scope overflow → REFUSE.**

---

## 5. Section E — Validation Obligations (Normative)

### E.1 Mandatory Semantic Validation Report

Each semantic validation **MUST** emit a report containing:

- `semantic_unit_id`
- `unit_type`
- `declared_truth_conditions[]`
- `observed_conditions[]`
- `preservation_result` (PASS/FAIL)
- `violation_reason` (if any)
- `sha256(binding)`

**Missing any field → REFUSE.**

---

### E.2 Deterministic Replay Requirement

Given identical inputs and locks:

> **Semantic validation output MUST be byte-identical.**

**Any divergence → REFUSE.**

---

## 6. Section V — Enforcement & Verdict Discipline (Normative)

### V.1 Verdict Mapping

| Condition | Verdict | Exit Code |
|-----------|---------|-----------|
| All invariants satisfied | SUPPORTED | 0 |
| Optional semantic layer missing (explicitly allowed) | INSUFFICIENT | 2 |
| Any invariant violated | REFUSE | 3 |

---

### V.2 Non-Override Rule

No higher-level module (UI, demo, runtime) may override:

- semantic `REFUSE`
- truth-condition failure
- scope violation

**Attempted override → REFUSE.**

---

## 7. Compliance Implications (Normative)

Any component claiming:

- "correct meaning"
- "accurate translation"
- "semantic equivalence"
- "truth-preserving transformation"

**MUST** reference this law explicitly.

**Absence of reference → CLAIM INVALID.**

---

## 8. Rationale (Informative, Non-Normative)

This law exists to prevent:

1. **meaning drift** during scale-up
2. **silent semantic corruption**
3. **LLM-style plausibility masking**
4. **non-falsifiable semantic claims**

It is the **semantic firewall** between
deterministic symbol processing (L1)
and grounded meaning systems (L2+).

---

**END SPEC**
