# ASE Compliance Test Suite v1.0

**Status:** NORMATIVE
**Purpose:** Validate ASE events against ASE_SPEC_v1_0
**Tool:** `ASE_VALIDATOR.js`

---

## PASS Cases

### TC-PASS-01

**Text:** "Dad gives Tim a toy."

**Expected:**
- schema: `GIFT_GIVING`
- roles: `agent`, `recipient`, `object`

```json
{
  "event_id": "E1",
  "schema": "GIFT_GIVING",
  "agent": "DAD",
  "recipient": "TIM",
  "object": "TOY"
}
```

**Verdict:** PASS (code 0)

---

### TC-PASS-02

**Text:** "The car moves fast."

**Expected:**
- schema: `OBJECT_MOTION`
- roles: `agent`, `speed`

```json
{
  "event_id": "E2",
  "schema": "OBJECT_MOTION",
  "agent": "CAR",
  "speed": "FAST"
}
```

**Verdict:** PASS (code 0)

---

### TC-PASS-03

**Text:** Parallel EN-VI alignment

- EN event count = VI event count
- Event order identical
- Event-ID aligned 1-1

**Verdict:** PASS (code 0)

---

### TC-PASS-04

**Text:** "Tim opens the box."

**Expected:**
- schema: `CONTAINER_OPEN`
- roles: `agent`, `object`

```json
{
  "event_id": "E3",
  "schema": "CONTAINER_OPEN",
  "agent": "TIM",
  "object": "BOX"
}
```

**Verdict:** PASS (code 0)

---

### TC-PASS-05

**Text:** "It is Christmas."

**Expected:**
- schema: `TEMPORAL_CONTEXT`
- roles: `value`

```json
{
  "event_id": "E4",
  "schema": "TEMPORAL_CONTEXT",
  "value": "CHRISTMAS"
}
```

**Verdict:** PASS (code 0)

---

## REFUSE Cases

### TC-REFUSE-01

**Reason:** Missing agent

```json
{
  "event_id": "E10",
  "schema": "MOVE_TO_LOCATION",
  "location": "ZOO"
}
```

**Gate:** `MISSING_ROLE:agent`
**Verdict:** REFUSE (code 3)

---

### TC-REFUSE-02

**Reason:** Unknown schema

```json
{
  "event_id": "E11",
  "schema": "RUN_AROUND",
  "agent": "DOG"
}
```

**Gate:** `UNKNOWN_SCHEMA`
**Verdict:** REFUSE (code 3)

---

### TC-REFUSE-03

**Reason:** Semantic injection

- EN source: "The car moves fast"
- VI ASE output: `speed = "ACCELERATING"`

Aspect changed (`fast` -> `accelerating`) violates Section E.2.

**Gate:** Semantic injection detected
**Verdict:** REFUSE (code 3)

---

### TC-REFUSE-04

**Reason:** Stylistic contamination

```json
{
  "event_id": "E12",
  "schema": "EMOTIONAL_STATE",
  "agent": "TIM",
  "state": "VERY_HAPPY_AND_PROUD"
}
```

**Gate:** `STYLE_CONTAMINATION` (amplifier `VERY_` detected)
**Verdict:** REFUSE (code 3)

---

### TC-REFUSE-05

**Reason:** Missing schema field

```json
{
  "event_id": "E13",
  "agent": "TIM",
  "object": "BOX"
}
```

**Gate:** `MISSING_SCHEMA`
**Verdict:** REFUSE (code 3)

---

## INSUFFICIENT Cases

### TC-INS-01

**Reason:** Ambiguous agent

**Text:** "He went."

- Agent = "He" -- unresolved pronoun.
- ASE requires agent resolution before event creation (Section B.1).
- Cannot create valid event without explicit agent identity.

**Verdict:** Cannot construct valid ASE event. Pre-ASE resolution required.

---

## Verdict Mapping

| Code | Meaning |
|------|---------|
| 0 | **PASS** |
| 2 | **FAIL** (IO/format error) |
| 3 | **REFUSE** (spec/gate violation) |

---

## Running Tests

```bash
# Validate PASS cases
node ASE_VALIDATOR.js ase_test_pass.json

# Validate REFUSE cases (expect exit code 3)
node ASE_VALIDATOR.js ase_test_refuse.json
```

---

## Architecture Implications

This test suite makes ASE:

- **Machine-checkable** -- automated validation via `ASE_VALIDATOR.js`
- **Schema-locked** -- only `SCHEMA_SET` v1.0 accepted
- **UGTS-gated** -- REFUSE on missing roles, unknown schemas, style contamination
- **NRBPL-ready** -- validated events can be compiled to opcode streams
