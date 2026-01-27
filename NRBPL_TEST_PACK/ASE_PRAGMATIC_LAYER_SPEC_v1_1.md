# **ASE_PRAGMATIC_LAYER_SPEC_v1_1**

**Status:** NORMATIVE EXTENSION
**Scope:** Social--Performative Speech Acts
**Depends on:** ASE_SPEC_v1_0
**Layer:** Pragmatic Event Layer (PEL)
**Discipline:** UGTS · evidence-first · fail-fast · audit-ready

---

## **Section P1 — Purpose**

Layer này bổ sung khả năng biểu diễn:

> **Utterances whose primary function is to enact social bonds rather than describe world events**

Bao gồm:

* chúc mừng
* chào hỏi
* xin lỗi
* chúc may mắn
* cảm ơn
* nghi thức xã hội

Không thay thế ASE v1.0 mà **mở rộng phía trên**.

---

## **Section P2 — Ontological Distinction**

| ASE v1.0 Core                | Pragmatic Layer v1.1   |
| ---------------------------- | ---------------------- |
| Physical / perceptual events | Social symbolic acts   |
| Observable change            | Conventional meaning   |
| World-state semantics        | Relationship semantics |

Pragmatic Events **không bắt buộc có world-state effect**.

---

## **Section P3 — New Schema Family**

### **SCHEMA_FAMILY: SPEECH_ACT_RITUAL**

```
SPEECH_ACT_WISH
SPEECH_ACT_GREETING
SPEECH_ACT_CONGRATULATE
SPEECH_ACT_APOLOGIZE
SPEECH_ACT_THANK
SPEECH_ACT_FAREWELL
```

---

## **Section P4 — Event Structure**

```json
{
  "event_id": "E<number>",
  "schema": "SPEECH_ACT_WISH",
  "speaker": "<AGENT_ID>",
  "addressee": "<AGENT_ID | GROUP | GENERIC>",
  "formula": "<CANONICAL_FORMULA_ID>",
  "mode": "<OPTIONAL_CONTEXT_TAG>"
}
```

---

## **Section P5 — Canonical Formula Registry**

Các utterance ritual được chuẩn hoá thành **formula IDs**, không giữ raw text.

Ví dụ:

| Formula ID       | Surface examples      |
| ---------------- | --------------------- |
| HAPPY_BIRTHDAY   | Happy birthday to you |
| GOOD_LUCK        | Good luck!            |
| THANK_YOU        | Thank you             |
| CONGRATS_GENERIC | Congratulations       |

---

## **Section P6 — Mapping Rules**

1. **One formula → one event**
2. Không trích xuất causal meaning
3. Không suy diễn intention ngoài loại speech act
4. Không biến thành EMOTIONAL_STATE

---

## **Section P7 — Gate Conditions**

| Condition                                | Action |
| ---------------------------------------- | ------ |
| Formula không có trong registry          | REFUSE |
| Speaker không xác định                   | REFUSE |
| Trộn với schema vật lý trong cùng event  | REFUSE |
| Dùng adjective cảm xúc như state literal | REFUSE |

---

## **Section P8 — Example**

### Input

"Happy birthday to you"

### ASE v1.1 Event

```json
{
  "event_id": "E1",
  "schema": "SPEECH_ACT_WISH",
  "speaker": "AGENT_1",
  "addressee": "YOU",
  "formula": "HAPPY_BIRTHDAY",
  "mode": "CELEBRATORY"
}
```

---

## **Section P9 — NRBPL Opcode Mapping**

```
AGENT_1:SAY(HAPPY_BIRTHDAY)->YOU
```

---

## **Section P10 — Separation Rule**

Pragmatic layer **MUST NOT**:

* modify physical ASE events
* inject world-state changes
* alter causal structure

It is a **parallel semantic layer**.

---

## **Section P11 — Compliance Levels**

| Level  | Meaning                 |
| ------ | ----------------------- |
| ASE-P0 | Raw formula recognized  |
| ASE-P1 | Agent + formula mapped  |
| ASE-P2 | UGTS gated, NRBPL ready |

---

## **Section P12 — Non-Goals**

Không mô hình hoá:

* sarcasm
* metaphor
* hidden intention
* discourse structure

---

## **Final Declaration**

ASE v1.1 Pragmatic Layer mở rộng hệ thống từ:

> **Event semantics** → **Social interaction semantics**

mà vẫn giữ:

* schema-locked
* deterministic
* audit-safe
