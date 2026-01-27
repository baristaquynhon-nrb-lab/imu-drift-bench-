# **FORMAL_MODEL_AND_LIMITATIONS_v0_1**

## **Formal Model, Determinism Conditions, and Boundary of Applicability**

**System:** NRBPL Deterministic Semantic Execution Pipeline
**Version:** v0.1
**Scope:** ASE → Opcode → Runtime → Canonical State
**Nature:** Closed-world, schema-bounded, inference-free semantic execution

---

## **1. Formal Model of the Runtime**

NRBPL runtime được mô hình hóa như một hệ chuyển trạng thái tất định:

$$
\mathcal{M} = (S, E, \delta)
$$

| Ký hiệu  | Nghĩa                                    |
| -------- | ---------------------------------------- |
| $S$      | Tập trạng thái thế giới hữu hạn          |
| $E$      | Tập sự kiện nguyên tử (opcode instances) |
| $\delta$ | Hàm chuyển trạng thái                    |

---

### **1.1 State Space**

Mỗi trạng thái $s \in S$ là một cấu trúc:

$$
s = (Entities, Properties, Relations)
$$

Trong đó:

* `Entities` = tập đối tượng đã khai báo
* `Properties(e)` = tập thuộc tính của entity e
* `Relations(e₁, e₂)` = quan hệ nhị nguyên

Không tồn tại:

* tri thức ẩn
* ngữ cảnh bên ngoài
* ký ức không biểu diễn trong state

Hệ là **closed-world**: điều không có trong state được xem là không đúng.

---

### **1.2 Event Space**

Mỗi opcode tương ứng với một sự kiện hình thức:

$$
e = (schema, roles)
$$

Ví dụ:

$$
GIFT\_GIVING(DAD, TOY, TIM)
$$

Mỗi sự kiện có **denotation**:

$$
\llbracket e \rrbracket : S \to S
$$

---

### **1.3 Transition Function**

Runtime định nghĩa:

$$
\delta(s, e) = \llbracket e \rrbracket(s)
$$

Với chuỗi sự kiện $E = [e_1, e_2, ..., e_n]$:

$$
\delta^*(s_0, E) = \delta(...\delta(\delta(s_0,e_1),e_2)...,e_n)
$$

---

## **2. Determinism Theorem**

### **Theorem**

NRBPL runtime là tất định nếu thỏa:

1. $\delta$ là hàm thuần
2. Không có nguồn entropy
3. Không có suy diễn (inference)
4. State canonicalization là ánh xạ đơn trị

---

### **Proof Sketch**

Giả sử hai lần chạy:

$$
s_n = \delta^*(s_0, E)
$$
$$
s'_n = \delta^*(s_0, E)
$$

Do $\delta$ thuần và không có biến ngẫu nhiên:

$$
s_n = s'_n
$$

Canonicalizer $C$ là hàm:

$$
C: S \to J
$$

trong đó J là JSON canonical.

Do $C$ đơn trị:

$$
C(s_n) = C(s'_n)
$$

Do SHA-256 là hàm băm xác định:

$$
H(C(s_n)) = H(C(s'_n))
$$

⇒ Hash giống nhau.

---

## **3. Vai trò của No-Inference Constraint**

Nếu tồn tại rule suy diễn:

$$
s \to s + \Delta
$$

trong đó $\Delta$ phụ thuộc:

* thứ tự rule
* chiến lược reasoning
* heuristic

thì $\delta$ không còn là hàm.

Hệ trở thành:

$$
\delta: S \times E \to \mathcal{P}(S)
$$

(đa trị)

⇒ không còn determinism.

**Kết luận:**
$$
No\text{-}Inference \Rightarrow \delta \text{ is a function} \Rightarrow Determinism
$$

---

## **4. Canonical State Mapping**

Canonicalizer:

$$
C : S \to J
$$

thỏa:

| Tính chất         | Ý nghĩa                             |
| ----------------- | ----------------------------------- |
| Idempotent        | $C(C(s)) = C(s)$                    |
| Order-independent | không phụ thuộc thứ tự object/array |
| Entropy-free      | loại timestamp, path, exit_code     |

⇒ $C$ tạo canonical representation.

---

## **5. Boundary of Applicability**

NRBPL không áp dụng cho:

| Lĩnh vực         | Lý do                  |
| ---------------- | ---------------------- |
| Pragmatics       | cần inference          |
| Implicature      | ngữ nghĩa ngầm         |
| Causality        | không có rule suy diễn |
| Uncertainty      | không có xác suất      |
| Knowledge growth | không reasoning        |

NRBPL chỉ áp dụng cho:

> **Schema-bounded, explicitly stated event semantics**

---

## **6. Separation of Layers**

| Layer                          | Nature                 |
| ------------------------------ | ---------------------- |
| Natural language understanding | probabilistic          |
| ASE representation             | structural             |
| NRBPL execution                | deterministic          |
| Canonical state                | cryptographic identity |

NRBPL nằm **sau** giai đoạn hiểu ngôn ngữ.

---

## **7. Overclaim Prevention**

NRBPL **không chứng minh**:

* rằng ngữ nghĩa tự nhiên hoàn toàn hình thức
* rằng NLP có thể bỏ LLM
* rằng hệ xử lý mọi câu

NRBPL chỉ chứng minh:

> Với event semantics đã được chuẩn hóa, execution có thể là formal, deterministic và hash-verifiable.

---

## **8. Formal Conclusion**

NRBPL là một hệ:

$$
Meaning_{event} \xrightarrow{\delta^*} State \xrightarrow{C} Canonical\ Representation \xrightarrow{H} Identity
$$

Trong đó:

* $\delta$ thuần
* Không inference
* Không entropy

⇒ Hệ là một **deterministic formal semantic execution system** trong phạm vi schema đã định nghĩa.
