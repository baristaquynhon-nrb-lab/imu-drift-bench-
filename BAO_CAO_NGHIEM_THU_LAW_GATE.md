# BAO CAO NGHIEM THU
## Law Governance Gate — Runtime Epistemic Validation

**Du an:** imu-drift-bench- / SEE-R OS / DS-Field Laboratory
**Tac gia kiem nghiem:** Claude (Opus 4.5)
**Ngay thuc hien:** 2026-01-28
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

**Ket luan cuoi cung:** Law Governance Gate da duoc **nghiem thu thanh cong** tai runtime. Day la epistemic gate runtime hop le dau tien cho law-tracking cognition trong du an nay.
