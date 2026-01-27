# **FORMAL_SEMANTICS_OF_ASE_v0_1**

## **Denotational Semantics of ASE Schemas**

**System:** NRBPL Deterministic Semantic Execution
**Scope:** Mapping ASE Events → World State Transformations
**Nature:** Closed-world, inference-free, state-transforming logic

---

## **1. Semantic Framework**

Mỗi ASE event $e$ được diễn giải như một hàm:

$$
\llbracket e \rrbracket : S \rightarrow S
$$

Trong đó:

* $S$ = tập trạng thái thế giới
* $e = (schema, roles)$

State được biểu diễn như một cấu trúc logic:

$$
S = (Ent, Prop, Rel)
$$

| Thành phần   | Mô tả                       |
| ------------ | --------------------------- |
| Ent          | tập thực thể                |
| Prop(e,p)    | thuộc tính p của thực thể e |
| Rel(r,e₁,e₂) | quan hệ r giữa e₁ và e₂     |

---

## **2. Notation**

| Ký hiệu              | Nghĩa                    |
| -------------------- | ------------------------ |
| $e \in Ent$          | e là entity              |
| $p(e)$               | property p đúng với e    |
| $r(e_1,e_2)$           | quan hệ r giữa e₁,e₂     |
| $S' = S \cup \Delta$ | state sau khi thêm facts |

---

## **3. Schema Semantics**

### **3.1 GIFT_GIVING(agent, object, recipient)**

$$
\llbracket GIFT\_GIVING(a,o,r) \rrbracket (S) = S'
$$

Trong đó:

$$
S' = S \cup \{ has(r,o), \neg has(a,o) \}
$$

---

### **3.2 CONTAINER_OPEN(agent, container)**

$$
\llbracket CONTAINER\_OPEN(a,c) \rrbracket (S) = S \cup \{ opened(c) \}
$$

---

### **3.3 PERCEPTION_VISUAL(agent, object)**

$$
\llbracket PERCEPTION\_VISUAL(a,o) \rrbracket (S) = S \cup \{ seen(a,o) \}
$$

---

### **3.4 MOVEMENT(agent, location)**

$$
\llbracket MOVEMENT(a,l) \rrbracket (S) = S \cup \{ at(a,l) \}
$$

---

### **3.5 POSSESSION(agent, object)**

$$
\llbracket POSSESSION(a,o) \rrbracket (S) = S \cup \{ has(a,o) \}
$$

---

### **3.6 COMMUNICATION_SAY(agent, content)**

NRBPL không diễn giải nội dung:

$$
\llbracket COMMUNICATION\_SAY(a,c) \rrbracket (S) = S
$$

---

### **3.7 CREATION(agent, object)**

$$
\llbracket CREATION(a,o) \rrbracket (S) = S \cup \{ exists(o) \}
$$

---

### **3.8 DESTRUCTION(agent, object)**

$$
\llbracket DESTRUCTION(a,o) \rrbracket (S) = S \setminus \{ exists(o) \}
$$

---

## **4. Composition Law**

Chuỗi sự kiện:

$$
E = [e_1, e_2, ..., e_n]
$$

Ngữ nghĩa:

$$
\llbracket E \rrbracket = \llbracket e_n \rrbracket \circ ... \circ \llbracket e_1 \rrbracket
$$

---

## **5. Determinism Property**

Do mỗi $\llbracket e \rrbracket$ là hàm thuần:

$$
S_n = \llbracket E \rrbracket (S_0)
$$

là duy nhất.

---

## **6. Absence of Inference**

Không tồn tại rule:

$$
has(a,o) \Rightarrow owns(a,o)
$$

Nếu không có schema tương ứng, fact không được thêm.

---

## **7. Canonicalization Invariance**

Nếu:

$$
S_1 = S_2
$$

thì:

$$
C(S_1) = C(S_2)
$$

với C là canonicalizer.

---

## **8. Conclusion**

Mỗi ASE schema có thể được ánh xạ sang một **state transformation operator** xác định.

NRBPL runtime thực thi:

$$
Meaning_{event} \equiv State\ transformation
$$

không cần suy diễn, xác suất, hoặc tri thức ẩn.
