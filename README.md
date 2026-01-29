# ΔS–CPL Reflex Loop v2.5 — Mobile Reflex PWA

**Author:** Nguyen Ngoc Thi — SEE-R OS / ΔS-Field Laboratory  
**Device Target:** Samsung S24 (Android 14, Chrome 120+)  
**Version:** v2.5 — Auto-Speak Reflex PWA (Vietnamese Voice)

---

## 🌐 Overview
This PWA enables **real-time reflex simulation** based on the ΔS–CPL (Condition–Phenomenon Law) framework.  
It integrates camera + microphone sensors on Samsung S24 to generate **neuro-reflex actions** (NRB format) in real-time.

---

## ⚙️ Features
- 📸 Camera reflex detection (head motion, optical flow, or landmark)
- 🎤 Voice wake-word: **“Này Delta”**
- 🔊 Auto-speak reflex using **Vietnamese female TTS**
- 🧠 Logs ΔS / NRB reflex data to **LocalStorage**
- 📄 Exports reflex history to **CSV** for later review
- 💡 Works offline as **Progressive Web App (PWA)**

---

## 📁 Files
| File | Description |
|------|--------------|
| `mobile_reflex_v2_5.html` | Main PWA Reflex Interface |
| `manifest.json` | PWA configuration |
| `serviceWorker.js` | Offline caching & background reflex sync |
| `ΔS_Reflex_Log.csv` | Example exported log file |

---

## 🚀 How to Run
1. Open the repository on GitHub Pages or local server (e.g., Termux / `http-server`).
2. Allow **camera + microphone** access.
3. Say **“Này Delta”** to activate reflex mode.
4. Observe visual + voice feedback in real time.

---

## 🧩 Development Notes
- Built with **HTML5, TypeScript, Web Speech API, MediaPipe**
- Follows **W3C Open Standard APIs** (no commercial SDK)
- Designed for **AI Reflex Research (ΔS–CPL / NRB Laboratory)**

---

## 🔒 Law Governance Gate — Runtime Epistemic Test Suite

The Law Governance Gate must be **validated at runtime** before it can be considered a legitimate epistemic gate. Spec and pseudo-code alone are insufficient — the gate must **prove** it enforces fail-fast behavior and blocks inference without valid law selection.

### Files

| File | Description |
|------|-------------|
| `law_governance_gate.js` | Simplified Law Governance Gate runtime implementation |
| `test_law_gate.js` | Runtime epistemic test suite (4 core property tests) |

### Run

```bash
node test_law_gate.js
```

### Core Properties Validated

| ID | Property | If violated |
|----|----------|-------------|
| T1 | No applicable law → REFUSE | Gate allows lawless inference |
| T2 | Unresolvable law conflict → REFUSE | Gate permits ambiguous grounding |
| T3 | Selected law fails prediction → REFUSE | Gate allows mismatched reasoning |
| T4 | Valid law → PASS + mandatory log | Gate blocks legitimate inference |

### Test Results

```
T1_No_Law        PASS  { verdict: 'REFUSE', reason: 'NO_APPLICABLE_LAW' }
T2_Conflict      PASS  { verdict: 'REFUSE', reason: 'LAW_CONFLICT_UNRESOLVED' }
T3_Runtime_Mismatch PASS  { verdict: 'REFUSE', reason: 'LAW_MISMATCH_RUNTIME' }
T4_Valid          PASS  { verdict: 'PASS', selected_law: 'LAW_A', log: true }
```

All 4 tests **PASS** — confirming the gate correctly implements the Law-Tracking Theorem at runtime:
- The system **refuses** inference when no law applies, when laws conflict without resolution, or when the selected law fails to predict the observation.
- The system **permits** inference only when a uniquely selected, domain-matched, anchor-clean law successfully predicts the runtime observation.

If any of these tests fail, the gate has not implemented Law-Tracking correctly and the system remains distributional (no law grounding).

---

## 🔬 Intervention Planning Algorithm (IPA) — Minimum Hitting Set

When the Law Governance Gate detects conflicting laws, IPA computes the **minimum set of physical interventions** (measurements, queries) that separates all competing law pairs. Uses exact subset enumeration with action-level grouping: conditions sharing the same physical action (type + variable) are merged so a single measurement can disambiguate multiple pairs.

### Files

| File | Description |
|------|-------------|
| `intervention_planner.js` | IPA runtime: action grouping + exact min hitting set solver |
| `test_intervention_planner.js` | IPA test suite (6 tests: refuse, coverage, minimality, determinism) |

### Run

```bash
node test_intervention_planner.js
```

### Properties Validated

| ID | Property | If violated |
|----|----------|-------------|
| T1 | No conflict → REFUSE | IPA runs without conflict input |
| T2 | LDP not PASS → REFUSE | IPA accepts unvalidated LDP output |
| T3 | Missing pair binding → REFUSE | IPA allows evidence-free coverage claims |
| T4 | Minimum hitting set (size=2, not 3) | IPA wastes interventions (not minimal) |
| T5 | Uncovered pairs → REFUSE | IPA claims progress without full coverage |
| T6 | Determinism (same input → same output) | IPA is non-reproducible |

### Test Results

```
T1_NoConflict PASS
T2_LDPNotPass PASS
T2_Reason PASS
T3_MissingPairBinding PASS
T3_Reason PASS
T4_MinHittingSet_VERDICT PASS
T4_MinSizeIs2 PASS  (interventions.length === 2, strategy: EXACT_MIN_HITTING_SET)
T5_UnhitPairs_VERDICT PASS
T5_Reason PASS
T6_Determinism PASS
ALL_TESTS PASS (exit code 0)
```

---

## 🧬 LDP v1.1 — Law Disambiguation Protocol (Pair-Witness)

LDP v1.1 generates **pair-witness disambiguation conditions** from law-declared distinguishers. Each condition is bound to exactly one competing pair (`cond.pair = [A, B]`), enabling IPA to prove coverage. If two laws share identical distinguisher sets (inseparable), LDP refuses immediately.

### Files

| File | Description |
|------|-------------|
| `law_disambiguation_protocol_v1_1.js` | LDP v1.1: pair-witness condition generation from law distinguishers |
| `test_ldp_v1_1_to_ipa.js` | End-to-end test: LDP v1.1 → IPA pipeline (4 tests) |

### Run

```bash
node test_ldp_v1_1_to_ipa.js
```

### Properties Validated

| ID | Property | If violated |
|----|----------|-------------|
| T1 | LDP PASS + all conditions have pair binding | Conditions lack provable coverage |
| T2 | IPA PASS with minimal intervention plan | Pipeline broken between LDP and IPA |
| T3 | Inseparable laws → LDP REFUSE | LDP fabricates distinguishers |
| T4 | Determinism (same input → same output) | Pipeline is non-reproducible |

### Test Results

```
T1_LDP_VERDICT PASS
T1_AllHavePair PASS
T2_IPA_VERDICT PASS
T2_InterventionsNonEmpty PASS  (2 interventions, strategy: EXACT_MIN_HITTING_SET)
T2_InterventionsBounded PASS
T3_Inseparable_VERDICT PASS
T3_Inseparable_REASON PASS
T4_Determinism PASS
ALL_TESTS PASS (exit code 0)
```

### Full Pipeline Architecture

```
Law Governance Gate → LDP v1.1 (pair-witness) → IPA (min hitting set)
```

No proof gap: every condition carries a `pair` binding, IPA verifies full coverage, and the hitting set solver is exact + deterministic.

---

## 📜 License
Open standard license (non-commercial academic use).  
© 2025 Nguyen Ngoc Thi — SEE-R OS / ΔS-Field Laboratory
