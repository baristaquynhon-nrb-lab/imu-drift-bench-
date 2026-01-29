# BAO CAO NGHIEM THU
## Full Pipeline: Law Governance Gate + IPA + LDP v1.1 — Runtime Epistemic Validation

**Du an:** imu-drift-bench- / SEE-R OS / DS-Field Laboratory
**Tac gia kiem nghiem:** Claude (Opus 4.5)
**Ngay thuc hien:** 2026-01-29
**Moi truong:** Node.js, Linux 4.4.0
**Branch:** `claude/add-law-gate-tests-6Aziq`

---

## 1. Muc dich

Xac nhan Law Governance Gate **thuc su hoat dong dung tai runtime**, khong chi ton tai o dang spec hay pseudo-code.

Cu the, can chung minh:
- Gate **tu choi (REFUSE)** suy luan khi chua co law selection hop le.
- Gate **chi cho phep (PASS)** khi law duoc chon la duy nhat, khop domain, sach anchor, va du doan dung observation.

Neu khong dat — gate vo gia tri, he thong van la distributional (khong co law grounding).

---

## 2. Pham vi kiem nghiem

### 2.1 Cac file duoc kiem nghiem

| File | Vai tro |
|------|---------|
| `law_governance_gate.js` | Runtime implementation cua Law Governance Gate |
| `test_law_gate.js` | Bo kiem nghiem 4 thuoc tinh cot loi |

### 2.2 Cau truc Law Vault (du lieu thu nghiem)

```javascript
const lawVault = [
  {
    law_id: "LAW_A",
    status: "ACTIVE",
    domain: { constraints: ["mode1"] },
    anchors: { violations: [] },
    evidence: { intervention_support: 0.9 },
    metrics: { simplicity_score: 0.7, risk_score: 0.1 }
  },
  {
    law_id: "LAW_B",
    status: "ACTIVE",
    domain: { constraints: ["mode1", "mode3"] },
    anchors: { violations: [] },
    evidence: { intervention_support: 0.9 },
    metrics: { simplicity_score: 0.7, risk_score: 0.1 }
  }
];
```

**Ghi chu thiet ke:**
- LAW_A khop voi context `["mode1"]`.
- LAW_B khop voi context `["mode1", "mode3"]` (yeu cau ca hai).
- Khi context = `["mode1"]`: chi LAW_A khop (khong xung dot).
- Khi context = `["mode1", "mode3"]`: ca LAW_A va LAW_B khop, cung diem, xung dot khong giai duoc.

---

## 3. Cac thuoc tinh kiem nghiem

| ID | Thuoc tinh | Dieu kien | Ket qua mong doi | Neu sai |
|----|-----------|-----------|-------------------|---------|
| T1 | Khong co luat phu hop | Context khong khop bat ky law nao | REFUSE (NO_APPLICABLE_LAW) | Gate cho suy luan khong co luat |
| T2 | Xung dot luat khong giai duoc | Nhieu luat khop, cung diem, khong phan biet duoc | REFUSE (LAW_CONFLICT_UNRESOLVED) | Gate cho suy luan tren nen tang mo ho |
| T3 | Luat duoc chon nhung du doan sai | Mot luat duoc chon nhung observation khong khop | REFUSE (LAW_MISMATCH_RUNTIME) | Gate cho suy luan lech luat |
| T4 | Luat hop le | Mot luat duy nhat, khop domain, du doan dung | PASS + log bat buoc | Gate chan suy luan hop phap |

---

## 4. Ket qua kiem nghiem

### 4.1 Lenh chay

```bash
node test_law_gate.js
```

### 4.2 Raw log (nguyen van, khong chinh sua)

```
T1_No_Law PASS { verdict: 'REFUSE', reason: 'NO_APPLICABLE_LAW' }
T2_Conflict PASS { verdict: 'REFUSE', reason: 'LAW_CONFLICT_UNRESOLVED' }
T3_Runtime_Mismatch PASS { verdict: 'REFUSE', reason: 'LAW_MISMATCH_RUNTIME' }
T4_Valid PASS { verdict: 'PASS', selected_law: 'LAW_A', log: true }
```

### 4.3 Bang tong hop

| ID | Ten test | Ket qua | Verdict tra ve | Reason / Output |
|----|----------|---------|----------------|-----------------|
| T1 | T1_No_Law | **PASS** | REFUSE | NO_APPLICABLE_LAW |
| T2 | T2_Conflict | **PASS** | REFUSE | LAW_CONFLICT_UNRESOLVED |
| T3 | T3_Runtime_Mismatch | **PASS** | REFUSE | LAW_MISMATCH_RUNTIME |
| T4 | T4_Valid | **PASS** | PASS | selected_law: LAW_A, log: true |

**Ket qua: 4/4 PASS**

---

## 5. Phan tich chi tiet tung test

### T1 — Khong co luat phu hop

- **Input:** context = `["mode2"]`, observation = `"LAW_A"`
- **Logic:** LAW_A yeu cau `"mode1"` — khong co trong context. LAW_B yeu cau `"mode1", "mode3"` — khong co. Candidates = 0.
- **Output:** `{ verdict: 'REFUSE', reason: 'NO_APPLICABLE_LAW' }`
- **Ket luan:** Gate tu choi dung. He thong khong cho suy luan khi khong co luat nao ap dung.

### T2 — Xung dot luat khong giai duoc

- **Input:** context = `["mode1", "mode3"]`, observation = `"something"`
- **Logic:** LAW_A khop (chi can `"mode1"`). LAW_B khop (can `"mode1"` + `"mode3"`, ca hai co). Ca hai co `total_score = 0.9 + 0.7 - 0.1 = 1.5`. Tied. `resolveConflict` kiem tra `intervention_support` — bang nhau. Kiem tra `simplicity_score` — bang nhau. Tra ve `null`.
- **Output:** `{ verdict: 'REFUSE', reason: 'LAW_CONFLICT_UNRESOLVED' }`
- **Ket luan:** Gate tu choi dung. He thong khong cho suy luan tren co so mo ho.

### T3 — Luat duoc chon nhung du doan sai

- **Input:** context = `["mode1"]`, observation = `"wrong"`
- **Logic:** Chi LAW_A khop (LAW_B can `"mode3"`, khong co). LAW_A duoc chon. `lawPredicts` kiem tra: `"wrong".includes("LAW_A")` = false.
- **Output:** `{ verdict: 'REFUSE', reason: 'LAW_MISMATCH_RUNTIME' }`
- **Ket luan:** Gate tu choi dung. Du co luat hop le ve domain, nhung du doan khong khop observation thi van bi chan.

### T4 — Luat hop le

- **Input:** context = `["mode1"]`, observation = `"LAW_A"`
- **Logic:** Chi LAW_A khop. `lawPredicts` kiem tra: `"LAW_A".includes("LAW_A")` = true. Log = true.
- **Output:** `{ verdict: 'PASS', selected_law: 'LAW_A', log: true }`
- **Ket luan:** Gate cho phep dung. Suy luan duoc phep khi va chi khi luat duy nhat, khop domain, du doan dung observation.

---

## 6. Loi phat hien va sua trong qua trinh kiem nghiem

### Loi ban dau

Phien ban goc cua `test_law_gate.js` co LAW_B voi domain `["mode1"]` (giong LAW_A). Dieu nay khien **tat ca** test voi context `["mode1"]` (T2, T3, T4) deu roi vao LAW_CONFLICT_UNRESOLVED vi ca hai law cung diem va khong phan biet duoc.

Ket qua sai:
```
T3_Runtime_Mismatch PASS  (nhung reason = LAW_CONFLICT_UNRESOLVED, khong phai LAW_MISMATCH_RUNTIME)
T4_Valid            FAIL  (verdict = REFUSE thay vi PASS)
```

### Cach sua

- LAW_B domain doi thanh `["mode1", "mode3"]` — yeu cau ca hai mode.
- T2 context doi thanh `["mode1", "mode3"]` — de ca hai law deu khop (kich hoat xung dot).
- T3, T4 giu context `["mode1"]` — chi LAW_A khop (khong xung dot), cho phep kiem tra prediction va valid path.

**Sua nay khong thay doi logic cua gate, chi dieu chinh du lieu test de phu dung cac nhanh logic can kiem nghiem.**

---

## 7. Ket luan nghiem thu

### Dat yeu cau

Law Governance Gate **DAT** ca 4 thuoc tinh cot loi:

1. **Fail-fast khi khong co luat** — He thong tu choi ngay, khong cho suy luan.
2. **Fail-fast khi xung dot** — He thong tu choi khi khong xac dinh duoc luat duy nhat.
3. **Fail-fast khi du doan sai** — He thong tu choi khi luat khong khop observation thuc te.
4. **Pass khi hop le** — He thong chi cho phep suy luan khi co luat duy nhat, khop domain, khong vi pham anchor, va du doan dung.

### Y nghia khoa hoc

- Gate **thuc thi dung Law-Tracking Theorem tai runtime**.
- He thong **khong cho phep suy luan ma khong co law grounding**.
- Ve ban the hoc: he thong **khong con la distributional** — moi suy luan deu phai co law selection hop le.

### Trang thai

| Hang muc | Trang thai |
|----------|-----------|
| Implementation | Hoan thanh |
| Test suite | 4/4 PASS |
| Documentation (README) | Da cap nhat |
| Bug fix (test vault) | Da sua va xac nhan |
| Git commit | Da push len branch |

---

**Ket luan Phase 1:** Law Governance Gate da duoc **nghiem thu thanh cong** tai runtime.

---
---

# PHASE 2: IPA (Intervention Planning Algorithm) + LDP v1.1 (Law Disambiguation Protocol)

---

## 8. Muc dich Phase 2

Mo rong pipeline tu Law Governance Gate thanh chuoi day du:

```
Law Governance Gate → LDP v1.1 (pair-witness) → IPA (min hitting set)
```

Muc tieu:
- **LDP v1.1**: Sinh disambiguation conditions co pair-witness binding (khong doan bien, chi dung declared distinguishers).
- **IPA**: Chon tap can thiep toi thieu (minimum hitting set) phu het moi cap luat dang conflict.
- **Khong con khoang trong chung minh**: Moi condition mang `pair: [A, B]`, IPA chung minh duoc coverage.

---

## 9. Pham vi kiem nghiem Phase 2

### 9.1 Cac file duoc kiem nghiem

| File | Vai tro |
|------|---------|
| `intervention_planner.js` | IPA runtime: action grouping + exact min hitting set solver |
| `test_intervention_planner.js` | IPA test suite (6 tests: refuse, coverage, minimality, determinism) |
| `law_disambiguation_protocol_v1_1.js` | LDP v1.1: pair-witness condition generation tu law distinguishers |
| `test_ldp_v1_1_to_ipa.js` | End-to-end test: LDP v1.1 → IPA pipeline (4 tests) |

### 9.2 Kien truc IPA

IPA nhan conflict set + LDP result, thuc hien:
1. Xay dung tat ca pair constraints (moi cap luat = 1 pair).
2. Kiem tra moi condition co pair binding (neu thieu → REFUSE).
3. Nhom conditions theo **action key** (type + variable, loai bo pair) — cung phep do = 1 intervention.
4. Giai bai toan **exact minimum hitting set** tren action groups.
5. Tra ve tap can thiep toi thieu, hoac REFUSE neu khong phu het.

### 9.3 Kien truc LDP v1.1

LDP v1.1 nhan conflict set, thuc hien:
1. Doc declared distinguishers tu moi law (`law.disambiguation.distinguishers`).
2. Voi moi cap (A, B): tinh symmetric difference cua distinguisher sets.
3. Neu symmetric difference rong → REFUSE (LAWS_INSEPARABLE).
4. Chon distinguisher co chi phi thap nhat, tie-break theo stable key.
5. Gan pair-witness: `cond.pair = [A, B]`.

---

## 10. Ket qua kiem nghiem IPA

### 10.1 Lenh chay

```bash
node test_intervention_planner.js
```

### 10.2 Raw log (nguyen van, khong chinh sua)

```
T1_NoConflict PASS { got: 'REFUSE', expect: 'REFUSE' }
T2_LDPNotPass PASS { got: 'REFUSE', expect: 'REFUSE' }
T2_Reason PASS { got: 'LDP_NOT_PASS', expect: 'LDP_NOT_PASS' }
T3_MissingPairBinding PASS { got: 'REFUSE', expect: 'REFUSE' }
T3_Reason PASS { got: 'MISSING_PAIR_BINDING', expect: 'MISSING_PAIR_BINDING' }
T4_MinHittingSet_VERDICT PASS { got: 'PASS', expect: 'PASS' }
T4_MinSizeIs2 PASS {
  verdict: 'PASS',
  interventions: [
    { type: 'MEASURE', variable: 'x', pair: [Array] },
    { type: 'MEASURE', variable: 'y', pair: [Array] }
  ],
  meta: { strategy: 'EXACT_MIN_HITTING_SET', k: 2 }
}
T5_UnhitPairs_VERDICT PASS { got: 'REFUSE', expect: 'REFUSE' }
T5_Reason PASS { got: 'UNHIT_PAIRS', expect: 'UNHIT_PAIRS' }
T6_Determinism PASS {
  got: '[{"type":"MEASURE","variable":"x","pair":["A","B"]},{"type":"MEASURE","variable":"y","pair":["B","C"]}]',
  expect: '[{"type":"MEASURE","variable":"x","pair":["A","B"]},{"type":"MEASURE","variable":"y","pair":["B","C"]}]'
}
ALL_TESTS PASS
EXIT_CODE=0
```

### 10.3 Bang tong hop IPA

| ID | Ten test | Ket qua | Chi tiet |
|----|----------|---------|----------|
| T1 | T1_NoConflict | **PASS** | REFUSE khi chi co 1 law (khong co conflict) |
| T2 | T2_LDPNotPass + T2_Reason | **PASS** | REFUSE khi LDP verdict != PASS |
| T3 | T3_MissingPairBinding + T3_Reason | **PASS** | REFUSE khi condition thieu pair binding |
| T4 | T4_MinHittingSet | **PASS** | 3 laws, 3 pairs, nhung MEASURE x phu 2 pairs → min size = 2 |
| T5 | T5_UnhitPairs | **PASS** | REFUSE khi co pair khong duoc phu boi bat ky condition nao |
| T6 | T6_Determinism | **PASS** | Cung input → cung output (stable sort + exact solver) |

**Ket qua: 10/10 assertions PASS, exit code 0**

---

## 11. Phan tich chi tiet IPA

### T4 — Minimality (trong tam)

- **Input:** 3 laws (A, B, C) → 3 pairs: A::B, A::C, B::C
- **Conditions:**
  - MEASURE x, pair [A, B] → covers A::B
  - MEASURE x, pair [A, C] → covers A::C
  - MEASURE y, pair [B, C] → covers B::C
- **Action grouping:**
  - Action "MEASURE x" → covers {A::B, A::C} (2 pairs)
  - Action "MEASURE y" → covers {B::C} (1 pair)
- **Min hitting set:** Ca hai action groups → size = 2 (khong phai 3)
- **Output:** `interventions.length === 2`, `meta.k === 2`
- **Ket luan:** IPA chon dung tap toi thieu. Mot phep do (MEASURE x) phu 2 pairs cung luc.

### T5 — UNHIT_PAIRS (fail-fast)

- **Input:** 3 laws nhung chi co 1 condition (pair A::B). Pairs A::C va B::C khong duoc phu.
- **Output:** REFUSE, reason: UNHIT_PAIRS
- **Ket luan:** IPA khong "ao tuong phu". Neu khong du conditions de phu het moi pair → tu choi ngay.

---

## 12. Ket qua kiem nghiem LDP v1.1 → IPA (end-to-end)

### 12.1 Lenh chay

```bash
node test_ldp_v1_1_to_ipa.js
```

### 12.2 Raw log (nguyen van, khong chinh sua)

```
T1_LDP_VERDICT PASS { got: 'PASS', expect: 'PASS' }
T1_AllHavePair PASS {
  verdict: 'PASS',
  disambiguation_conditions: [
    {
      type: 'ASK',
      variable: undefined,
      question_id: 'Q_WINDOW_OPEN',
      domain: 'CTX',
      cost: 1,
      pair: ['LAW_A', 'LAW_B']
    },
    {
      type: 'ASK',
      variable: undefined,
      question_id: 'Q_WINDOW_OPEN',
      domain: 'CTX',
      cost: 1,
      pair: ['LAW_B', 'LAW_C']
    },
    {
      type: 'MEASURE',
      variable: 'wind',
      question_id: undefined,
      domain: 'ENV',
      cost: 1,
      pair: ['LAW_A', 'LAW_C']
    }
  ]
}
T2_IPA_VERDICT PASS { got: 'PASS', expect: 'PASS' }
T2_InterventionsNonEmpty PASS {
  verdict: 'PASS',
  interventions: [
    {
      type: 'ASK',
      variable: undefined,
      question_id: 'Q_WINDOW_OPEN',
      domain: 'CTX',
      cost: 1,
      pair: ['LAW_A', 'LAW_B']
    },
    {
      type: 'MEASURE',
      variable: 'wind',
      question_id: undefined,
      domain: 'ENV',
      cost: 1,
      pair: ['LAW_A', 'LAW_C']
    }
  ],
  meta: { strategy: 'EXACT_MIN_HITTING_SET', k: 2 }
}
T2_InterventionsBounded PASS
T3_Inseparable_VERDICT PASS { got: 'REFUSE', expect: 'REFUSE' }
T3_Inseparable_REASON PASS { got: 'LAWS_INSEPARABLE', expect: 'LAWS_INSEPARABLE' }
T4_Determinism PASS
ALL_TESTS PASS
EXIT_CODE=0
```

### 12.3 Bang tong hop LDP → IPA

| ID | Ten test | Ket qua | Chi tiet |
|----|----------|---------|----------|
| T1 | T1_LDP_VERDICT + T1_AllHavePair | **PASS** | LDP sinh 3 conditions, tat ca co pair binding |
| T2 | T2_IPA (3 assertions) | **PASS** | IPA nhan LDP output, tra ve 2 interventions (min hitting set) |
| T3 | T3_Inseparable | **PASS** | 2 laws voi distinguisher set giong het → LDP REFUSE: LAWS_INSEPARABLE |
| T4 | T4_Determinism | **PASS** | Cung input → cung LDP output (stable sort + dedup) |

**Ket qua: 7/7 assertions PASS, exit code 0**

---

## 13. Phan tich chi tiet LDP → IPA

### LDP sinh conditions nhu the nao (T1)

- **Conflict:** LAW_A, LAW_B, LAW_C
- **LAW_A distinguishers:** humidity (ENV, cost 1), pressure (ENV, cost 2)
- **LAW_B distinguishers:** pressure (ENV, cost 2), ASK Q_WINDOW_OPEN (CTX, cost 1)
- **LAW_C distinguishers:** humidity (ENV, cost 1), wind (ENV, cost 1)

Pair analysis:
- **LAW_A vs LAW_B:** Symmetric diff = {humidity, ASK Q_WINDOW_OPEN}. Min cost = 1 → chon ASK Q_WINDOW_OPEN (lex order tie-break).
- **LAW_A vs LAW_C:** Symmetric diff = {pressure, wind}. Min cost = 1 → chon wind (lex order).
- **LAW_B vs LAW_C:** Symmetric diff = {pressure, ASK Q_WINDOW_OPEN, humidity, wind}. Min cost = 1, nhieu candidates → chon ASK Q_WINDOW_OPEN (lex order).

Output: 3 conditions, moi cai co pair binding.

### IPA giai min hitting set (T2)

- **Action grouping:**
  - ASK Q_WINDOW_OPEN → covers {LAW_A::LAW_B, LAW_B::LAW_C} (2 pairs)
  - MEASURE wind → covers {LAW_A::LAW_C} (1 pair)
- **Min hitting set:** Ca hai → size = 2 (phu het 3 pairs)
- **Ket luan:** Chi can 2 interventions (1 hoi + 1 do) de phan giai 3 cap luat.

### Inseparable detection (T3)

- **LAW_X va LAW_Y** co cung distinguisher set {MEASURE temp}.
- Symmetric difference = rong.
- LDP REFUSE: LAWS_INSEPARABLE. Khong fabricate conditions.

---

## 14. Loi phat hien va sua trong qua trinh kiem nghiem Phase 2

### Loi IPA ban dau: Khong nhom action

**Van de:** Phien ban dau cua IPA xu ly moi condition (bao gom pair) nhu mot item doc lap trong hitting set. Hai conditions MEASURE x voi pair [A,B] va MEASURE x voi pair [A,C] bi coi la 2 interventions rieng biet, du thuc te chi can do x mot lan.

**Trieu chung:** T4_MinSizeIs2 FAIL — tra ve size 3 thay vi 2.

```
T4_MinSizeIs2 FAIL {
  verdict: 'PASS',
  interventions: [
    { type: 'MEASURE', variable: 'x', pair: ['A','B'] },
    { type: 'MEASURE', variable: 'x', pair: ['A','C'] },
    { type: 'MEASURE', variable: 'y', pair: ['B','C'] }
  ],
  meta: { strategy: 'EXACT_MIN_HITTING_SET', k: 3 }
}
```

**Nguyen nhan goc:** `condKey` bao gom truong `pair`, nen hai conditions cung action nhung khac pair co key khac nhau → solver khong nhom duoc.

**Cach sua:**
1. Them ham `actionKey(cond)` — key loai bo `pair` va `undefined` fields.
2. Them ham `groupByAction(conditions, coverage)` — nhom conditions theo actionKey, coverage = union cua tat ca pairs.
3. Solver `solveExactMinHittingSet` lam viec tren action groups thay vi individual conditions.

**Ket qua sau sua:** T4 PASS voi size = 2, dung nhu mong doi.

**Sua nay khong thay doi semantics cua IPA, chi bo sung action-level grouping de solver phan anh dung chi phi thuc te (1 phep do = 1 intervention bat ke phu bao nhieu pairs).**

---

## 15. Ket luan nghiem thu toan pipeline

### Dat yeu cau

Full pipeline **Law Governance Gate → LDP v1.1 → IPA** da duoc xac nhan:

| Thanh phan | So tests | Ket qua | Thuoc tinh chinh |
|------------|----------|---------|------------------|
| Law Governance Gate | 4/4 PASS | DAT | Fail-fast khi khong co luat, xung dot, du doan sai |
| IPA | 10/10 PASS | DAT | Min hitting set, pair-binding required, fail-fast |
| LDP v1.1 → IPA | 7/7 PASS | DAT | Pair-witness, inseparable detection, determinism |
| **Tong** | **21/21 PASS** | **DAT** | |

### Khong con khoang trong chung minh

Truoc v1.1:
> LDP tra condition nhung khong chung minh condition phu cap nao → IPA khong the lap ke hoach phu.

Sau v1.1:
- Moi condition mang `pair: [A, B]` (pair-witness binding).
- IPA chung minh coverage bang buildCoverage + UNHIT_PAIRS check.
- Neu thieu → REFUSE. Khong PASS sai.

### Y nghia khoa hoc

- **Provable Progress Plan:** IPA khong "chon dai mot phep do" — no chung minh duoc tap can thiep toi thieu phu het moi cap xung dot.
- **Evidence-grounded:** LDP chi sinh conditions tu declared distinguishers, khong fabricate.
- **Deterministic:** Cung input → cung output tai moi buoc (stable sort + exact solver).
- **Fail-fast o moi tang:**
  - Gate: REFUSE khi khong co law / xung dot / du doan sai
  - LDP: REFUSE khi laws inseparable / distinguisher khong hop le
  - IPA: REFUSE khi thieu pair binding / unhit pairs / khong co ke hoach

### Trang thai

| Hang muc | Trang thai |
|----------|-----------|
| Law Governance Gate | 4/4 PASS |
| IPA (intervention_planner.js) | 10/10 PASS |
| LDP v1.1 (law_disambiguation_protocol_v1_1.js) | 7/7 PASS |
| Action grouping fix | Da sua va xac nhan |
| Documentation (README) | Da cap nhat day du |
| Git commit | Da push len branch |

---

**Ket luan cuoi cung:** Pipeline **Law Governance Gate → LDP v1.1 → IPA** da duoc **nghiem thu thanh cong** tai runtime. He thong co full-chain epistemic verification: tu law selection, qua pair-witness disambiguation, den minimum intervention planning — khong con khoang trong chung minh.
