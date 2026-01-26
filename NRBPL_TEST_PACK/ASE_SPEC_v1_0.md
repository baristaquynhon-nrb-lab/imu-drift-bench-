# Agent–Schema–Event (ASE) Specification v1.0

**Status:** NORMATIVE
**Scope:** Canonical Semantic Event Representation
**Discipline:** UGTS · evidence-first · fail-fast · audit-ready
**Compatibility:** NRBPL v0.1+
**Supersedes:** ad-hoc semantic parsing / token-based interpretation

---

## Section A — Purpose & Design Principles

### A.1 Purpose

Agent–Schema–Event (ASE) defines a **canonical, language-independent semantic representation**
for describing **actions, states, perceptions, and interactions** expressed in natural language.

ASE exists to:

- eliminate semantic ambiguity
- prevent stylistic or inferential contamination
- enable deterministic mapping EN ↔ VI (and other languages)
- serve as **Intermediate Representation (IR)** for NRBPL execution

### A.2 Design Principles

ASE is governed by the following non-negotiable principles:

1. **Event Atomicity** — One event encodes exactly one fact.
2. **No Inference Rule** — ASE MUST NOT infer intentions, causes, or consequences not explicitly stated.
3. **No Stylistic Content** — Tone, persona, politeness, emotion words-as-style are excluded.
4. **Auditability** — Every ASE event MUST be traceable to explicit surface evidence.
5. **Language Neutrality** — EN, VI, and other languages MUST map to identical Event Graphs.

---

## Section B — Core Concepts

### B.1 Agent

An **Agent** is an entity capable of participating in an event.

Allowed agent classes:

| Class | Constraint |
|-------|-----------|
| `HUMAN` | — |
| `ANIMAL` | — |
| `OBJECT` | — |
| `GROUP` | explicit only |
| `ABSTRACT_ENTITY` | restricted; must be justified |

Rules:

- Agents MAY be implicit but MUST be resolved before event creation.
- Gender, honorifics, and persona MUST NOT be injected.

### B.2 Schema

A **Schema** defines the type of event.

- Schemas are **closed-class primitives**.
- No free-form schemas are allowed.

### B.3 Event

An **Event** is a structured record with:

- exactly one schema
- zero or more roles (agent, object, target, location…)
- no narrative, no style

Each event MUST have a unique `event_id`.

---

## Section C — Canonical Schema Set (v1.0)

The following schema set is **normative and closed** for v1.0.

```
SCHEMA_SET = {
  "TEMPORAL_CONTEXT",
  "MOVE_TO_LOCATION",
  "MOVE_STATE",
  "PERCEPTION_VISUAL",
  "PERCEPTION_AUDITORY",
  "OBJECT_LOCATION",
  "CONTAINER_OPEN",
  "OBJECT_IDENTIFICATION",
  "PHYSICAL_ATTRIBUTE",
  "OBJECT_ACTION",
  "OBJECT_MOTION",
  "GIFT_GIVING",
  "CONSUMPTION",
  "EMOTIONAL_STATE",
  "AFFECTION_ACTION",
  "SPEECH_ACT_ADMONISH",
  "SPEECH_ACT_ADVISE",
  "SPEECH_ACT_CHALLENGE",
  "FACIAL_EXPRESSION",
  "LOSS_EVENT",
  "STATE_TRANSITION"
}
```

Rules:

- New schemas REQUIRE spec revision.
- Schemas MUST NOT overlap semantically.

---

## Section D — Event Structure (Normative)

### D.1 Event Record Format

```json
{
  "event_id": "E<number>",
  "agent": "<AGENT_ID | optional>",
  "schema": "<SCHEMA_NAME>",
  "...": "<schema-specific roles>"
}
```

### D.2 Mandatory Constraints

- `event_id` MUST be unique.
- `schema` MUST belong to `SCHEMA_SET`.
- All roles MUST be explicit or omitted (never guessed).

---

## Section E — Language Mapping Rules

### E.1 EN–VI Alignment Rule

For parallel texts:

- Event count MUST match.
- Event order MUST match.
- Event-ID MUST align 1–1.

**Violation ⇒ REFUSE**

### E.2 Forbidden Operations

The following are explicitly forbidden:

- Adding implicit causes
- Adding emotional evaluation not stated
- Changing aspect (e.g., `fast` → `accelerating`)
- Changing agent role (e.g., `"he"` → `"anh ta"` when age unspecified)

---

## Section F — Stylistic Re-projection Boundary

ASE terminates before stylistic expression.

```
ASE → Policy PASS → Stylistic Re-projection → Surface Text
```

Rules:

- Style MUST NOT modify ASE.
- ASE MUST be frozen before re-projection.

---

## Section G — Policy & Gate Integration (UGTS)

### G.1 Gate Conditions

| Condition | Action |
|-----------|--------|
| Missing agent | **REFUSE** |
| Schema not in registry | **REFUSE** |
| Semantic injection detected | **REFUSE** |
| Stylistic contamination | **REFUSE** |
| Complete & traceable | **PASS** |

---

## Section H — NRBPL Integration

### H.1 ASE as IR

ASE is the **sole semantic IR** allowed before NRBPL execution.

NRBPL execution units MUST consume:

- ordered ASE Event Graph
- frozen schema identifiers

### H.2 Example NRBPL Event Stream

```json
{
  "context": "CHRISTMAS",
  "events": [
    "DAD:GIVE(TOY)->TIM",
    "TIM:OPEN(BOX)",
    "TIM:SEE(TOY)",
    "TOY:IS(CAR)",
    "CAR:MOVE(FAST)",
    "TIM:HUG(DAD)",
    "DAD:SMILE"
  ]
}
```

---

## Section I — Compliance Levels

| Level | Requirements |
|-------|-------------|
| **ASE-C0** | Schema-complete, no audit |
| **ASE-C1** | Schema + EN–VI alignment |
| **ASE-C2** | UGTS-gated, NRBPL-ready **(RECOMMENDED)** |

---

## Section J — Non-Goals (Explicit)

ASE does **NOT** attempt to:

- generate text
- paraphrase
- reason causally
- interpret metaphor
- model psychology

---

## Section K — Versioning

| Version | Scope |
|---------|-------|
| **v1.0** | Closed schema set, deterministic mapping |
| **v1.x** | Schema extension (backward compatible) |
| **v2.0** | Discourse-level schemas (out of scope) |

---

## Final Declaration (Normative)

Agent–Schema–Event (ASE) v1.0 is hereby defined as the **canonical semantic event
representation** for NRBPL and UGTS-compliant systems.

**Any system that violates ASE constraints MUST be considered non-compliant.**
