# **FORMAL_SEMANTICS_OF_PRAGMATIC_LAYER_v1_1**

## **Formal Analysis of the Pragmatic Event Layer**

**System:** NRBPL Two-Domain Deterministic Semantic Machine
**Scope:** ASE v1.1 Pragmatic Event Layer (PEL)
**Depends on:** FORMAL_MODEL_AND_LIMITATIONS_v0_1, FORMAL_SEMANTICS_OF_ASE_v0_1
**Nature:** Product system, monotonic social state, inference-free

---

## **I. Architectural Upgrade: From Single-Domain to Product System**

Trước PEL, hệ là:

$$
\mathcal{M}_{core} = (S_w, E_{phys}, \delta_w)
$$

Bây giờ hệ mở rộng thành:

$$
\mathcal{M}_{prag} = (S_s, E_{prag}, \delta_s)
$$

và hệ tổng:

$$
\mathcal{M}_{total} = (S_w, S_s, E_{phys} \cup E_{prag}, \delta_w, \delta_s)
$$

Điểm quan trọng:

> **Không có một hàm $\delta$ chung**.
> Có **hai hàm chuyển trạng thái độc lập trên hai miền khác nhau**.

Đây là thiết kế đúng kiểu **product system**, không phải hệ trộn lẫn.

---

## **II. Denotational Semantics of PEL**

Ở core layer:

$$
\llbracket e \rrbracket : S_w \to S_w
$$

Ở pragmatic layer:

$$
\llbracket e_p \rrbracket : S_s \to S_s
$$

Cả hai đều:

* là **state transformers**
* không sinh giá trị ngôn ngữ
* không dùng embedding
* không dùng inference

Tức là:

> **Meaning = state transformation**
> (ở hai miền khác nhau)

Đây là một phát biểu rất mạnh về mặt triết học tính toán.

---

## **III. Monotonicity: Critical Design Decision**

PEL tuân theo nguyên tắc:

> Không xoá trừ (monotonic social update)

Điều này đảm bảo:

$$
S'_{s} = S_s \cup \Delta_{social}
$$

Hệ quả:

1. Không có dependency theo thứ tự rule
2. Không có branching execution
3. Không có need for conflict resolution

Nếu cho phép xoá (ví dụ: retract gratitude), ta phải định nghĩa:

* precedence
* temporal ordering
* resolution policy

→ làm hệ phức tạp và có nguy cơ mất determinism.

Hiện tại PEL vẫn thuộc lớp:

> **monotonic transition system**

→ an toàn cho formal proof.

---

## **IV. Separation Theorem: The Firewall**

Phát biểu:

$$
\llbracket e_p \rrbracket : S_w \not\rightarrow S_w
$$

Đây là firewall giữa hai domain:

| Domain | Nội dung           |
| ------ | ------------------ |
| $S_w$  | vật lý, tri giác   |
| $S_s$  | xã hội, nghi thức  |

Nếu PEL được phép tác động vào $S_w$ (ví dụ: "I apologize" → remove blame), ta đã:

* đưa inference trở lại
* phá closed-world assumption của $S_w$

Hiện tại thiết kế này **ngăn điều đó ngay từ tầng spec**, không phải ở runtime.

---

## **V. Determinism Preservation**

PEL không phá chứng minh determinism trước đó vì 3 lý do:

### 1. Registry-locked formulas

Text không đi thẳng vào hệ → phải qua formula ID.

### 2. Không có rule suy diễn

Không có rule kiểu:

```
wish_well(a,b,birthday) ⇒ emotional_state(b,happy)
```

### 3. $\delta_s$ là hàm thuần

Mỗi event thêm một fact rõ ràng, không phụ thuộc context.

Vì vậy:

$$
\delta_s : S_s \times E_{prag} \to S_s
$$

vẫn là hàm đơn trị → vẫn hash-verifiable.

---

## **VI. Speech Acts as Computable Operators**

Phần lớn nghiên cứu speech acts:

* nằm ở triết học ngôn ngữ
* hoặc trong discourse/pragmatics
* rất ít có formal execution model

Ở đây hệ đã:

> biến speech acts thành **operators trên social state**

không phải:

* cảm xúc
* niềm tin
* ý định ẩn

mà là:

> **conventional social tokens**

Điều này giữ chúng trong phạm vi:

**computable + deterministic + canonicalizable**

---

## **VII. System Identity After Extension**

Từ một máy:

> Deterministic Event Execution Machine

hệ trở thành:

> **Two-Domain Deterministic Semantic Machine**

Với hai miền:

| Miền   | Kiểu nghĩa              |
| ------ | ----------------------- |
| $S_w$  | Descriptive / physical  |
| $S_s$  | Performative / social   |

Cả hai đều:

* schema-bounded
* inference-free
* canonicalizable
* hash-auditable

Đây là một cấu trúc rất hiếm thấy trong NLP.

---

## **VIII. Next Formal Step: Unified Runtime Model**

Hiện tại ta có:

* formal model cho core
* formal model cho pragmatic

Nhưng chưa có:

$$
\mathcal{M}_{total} = (S_w, S_s, E, \delta)
$$

với:

$$
\delta(e) =
\begin{cases}
\delta_w(e) & e \in E_{phys} \\
\delta_s(e) & e \in E_{prag}
\end{cases}
$$

Tài liệu đó sẽ:

* hợp nhất hai miền thành một hệ toán học duy nhất
* chứng minh determinism cho hệ tổng
* xác lập rõ biên giữa hai domain

---

## **Conclusion**

FORMAL_SEMANTICS_OF_PRAGMATIC_LAYER_v1_1:

* không làm hệ "mềm" đi
* không kéo hệ sang NLP xác suất
* không phá chứng minh trước đó

Nó mở rộng hệ theo cách:

> **đưa speech acts vào phạm vi formal computation mà vẫn giữ UGTS, determinism, canonicality.**

Đây là mở rộng đúng kiểu hệ khoa học, không phải feature engineering.
