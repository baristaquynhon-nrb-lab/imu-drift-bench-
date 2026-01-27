# NRBPL L1 Lexicon 2K — UGTS Closure Certificate (v0.1.2)

**Status**: CLOSURE-CERTIFIED (L1)
**Level**: L1
**Generated**: 2026-01-24T00:39:32Z

---

## Section ΔC — Condition (Evidence Anchors)

- Repository anchor:
  - branch: `claude/kernel-core-e2e-testing-Suz0x`
  - HEAD: `3880473e32c97b2a5ba1809f3f802ad290fd9f8d`
  - worktree: `CLEAN` (mandatory precondition)

- Mandatory locks (SHA256-bound):
  - `locks/PATCH_SCOPE_LOCK_v0_1.json` = `0dba0c962c993e01a0a250354287e110fee6e171a96e1acc869cd2ca892a28ee`
  - `locks/KERNEL_ABI_LOCK.json` = `d55b4081abf1f2907ffe4770ae9bcdeb5d758358643a6abda1a7a110eb7de6d3`

- Mandatory sources (SHA256-bound):
  - `sources/oxford3000_seed.jsonl` = `ddabe2125d49950812b896c2fef96a04cfe577d40824a2794b37692cd134fba8`
  - `sources/wordnet_top.jsonl` = `662b0636cbcaaa56f7f6a2a239fe72b4a433fa9dd4a810314d4b84730933a0c3`
  - `sources/oxford3000_senses.jsonl` = `b8b4bdb37aa6550883d72c411b20ba8fc9b52d4108eaef6b975889a51b15d622`
  - `sources/wordnet_senses.jsonl` = `5844d6d2ecea09710a64960cc4a3a4b870f90bca9d35284c764b8255664e8422`

## Section ΔS — Stability (Determinism + Replay)

- Output artifacts:
  - `lexicon/en_vi_lemmas_2k.jsonl` sha256 = `7b1b10c0c26095aa496fd6e2a5a1bb94959c5b43f3115f11610bea04bcad7bb5`
  - `lexicon/en_vi_senses_2k.jsonl` sha256 = `b39d5e1feecc27cae9d3c81637c50794b8eaf19d1587f06d33183608c00003fc`

- Evidence chain binding:
  - artifact_hashes.set_sha256 = `a702028ba76d36589998d6dcb84a57c72ffff06432139924c1cfeeef0c40d95e`
  - report_hashes.canonical_sha256 = `1d9e18db3bba8df16588ab6c23823341ff97e6ca57dd02c0f99993caf0c510f6`

- Replay commands:
  - `_audit/l1_lexicon_2k/REPLAY_COMMANDS.txt`

## Section ΔP — Phenomenon (Gate Verdict)

- Gate execution:
  - tool: `validators/lexicon_gate.js`
  - mode: `L1`
  - verdict: **SUPPORTED**
  - exit_code: `0`

- Gate checks (summary):
```json
{
  "crossref_colloc_lemma": true,
  "crossref_sense_lemma": true,
  "frame_scope_lock": true,
  "frames_known": true,
  "no_duplicates": true,
  "no_inference_markers": true,
  "no_multigloss": true,
  "no_sense_selection_without_trace": true,
  "schema_pass": true,
  "sorted": true
}
```

## Closure Verdict

**CLOSURE PASS (L1)** — Lexicon 2K toolchain reached deterministic scale-up with evidence chain verified.

---

## Appendix A — Generator Reports (verbatim JSON)

### A1) Lemma build report
```json
{
  "spec": "NTL_LEXICON_2K_BUILD_REPORT_v0_1",
  "tool": "tools/gen_lexicon_2k.js",
  "tool_version": "0.1.0",
  "inputs": {
    "oxford3000_seed": {
      "path": "sources/oxford3000_seed.jsonl",
      "sha256": "ddabe2125d49950812b896c2fef96a04cfe577d40824a2794b37692cd134fba8"
    },
    "wordnet_top": {
      "path": "sources/wordnet_top.jsonl",
      "sha256": "662b0636cbcaaa56f7f6a2a239fe72b4a433fa9dd4a810314d4b84730933a0c3"
    }
  },
  "output": {
    "path": "lexicon/en_vi_lemmas_2k.jsonl",
    "lines": 2000,
    "sha256": "7b1b10c0c26095aa496fd6e2a5a1bb94959c5b43f3115f11610bea04bcad7bb5"
  },
  "policy": {
    "merge": "Oxford3000_priority_then_WordNet",
    "lemma_mutation": "FORBIDDEN",
    "missing_gloss": "REFUSE"
  }
}
```

### A2) Sense build report
```json
{
  "spec": "NTL_SENSES_2K_BUILD_REPORT_v0_1",
  "tool": "tools/gen_senses_2k.js",
  "tool_version": "0.1.0",
  "inputs": {
    "lemmas": {
      "path": "lexicon/en_vi_lemmas_2k.jsonl",
      "sha256": "7b1b10c0c26095aa496fd6e2a5a1bb94959c5b43f3115f11610bea04bcad7bb5"
    },
    "oxford3000_senses": {
      "path": "sources/oxford3000_senses.jsonl",
      "sha256": "b8b4bdb37aa6550883d72c411b20ba8fc9b52d4108eaef6b975889a51b15d622"
    },
    "wordnet_senses": {
      "path": "sources/wordnet_senses.jsonl",
      "sha256": "5844d6d2ecea09710a64960cc4a3a4b870f90bca9d35284c764b8255664e8422"
    }
  },
  "policy": {
    "prefer": "oxford3000",
    "max_senses_per_lemma": 3,
    "missing_sense_source": "REFUSE"
  },
  "output": {
    "path": "lexicon/en_vi_senses_2k.jsonl",
    "senses": 2000,
    "sha256": "b39d5e1feecc27cae9d3c81637c50794b8eaf19d1587f06d33183608c00003fc"
  }
}
```

### A3) Gate report (verbatim JSON)
```json
{
  "artifact_hashes": {
    "manifest_lines": [
      "7b1b10c0c26095aa496fd6e2a5a1bb94959c5b43f3115f11610bea04bcad7bb5  /home/user/imu-drift-bench-/nrbpl_kernel_core_v0_1_s24/lexicon/en_vi_lemmas_2k.jsonl",
      "b39d5e1feecc27cae9d3c81637c50794b8eaf19d1587f06d33183608c00003fc  /home/user/imu-drift-bench-/nrbpl_kernel_core_v0_1_s24/lexicon/en_vi_senses_2k.jsonl"
    ],
    "set_sha256": "a702028ba76d36589998d6dcb84a57c72ffff06432139924c1cfeeef0c40d95e"
  },
  "checks": {
    "crossref_colloc_lemma": true,
    "crossref_sense_lemma": true,
    "frame_scope_lock": true,
    "frames_known": true,
    "no_duplicates": true,
    "no_inference_markers": true,
    "no_multigloss": true,
    "no_sense_selection_without_trace": true,
    "schema_pass": true,
    "sorted": true
  },
  "exit_code": 0,
  "fail_fast": true,
  "files": {
    "lemmas": "/home/user/imu-drift-bench-/nrbpl_kernel_core_v0_1_s24/lexicon/en_vi_lemmas_2k.jsonl",
    "senses": "/home/user/imu-drift-bench-/nrbpl_kernel_core_v0_1_s24/lexicon/en_vi_senses_2k.jsonl"
  },
  "mode": "--all",
  "notes": [],
  "reasons": [],
  "report_hashes": {
    "bytes_sha256_sidecar_required": true,
    "canonical_sha256": "1d9e18db3bba8df16588ab6c23823341ff97e6ca57dd02c0f99993caf0c510f6"
  },
  "spec": "NTL_LEXICON_GATE_REPORT_v0_1",
  "stats": {
    "colloc_lemma_missing": 0,
    "collocations": 0,
    "dup_colloc_id": 0,
    "dup_lemma_pos": 0,
    "dup_sense_id": 0,
    "lemmas": 2000,
    "sense_lemma_missing": 0,
    "senses": 2000,
    "unknown_frames": 0
  },
  "tool": "validators/lexicon_gate.js",
  "tool_version": "1.1.0",
  "verdict": "SUPPORTED"
}
```

## Appendix B — Evidence checksum list

See: `_audit/l1_lexicon_2k/EVIDENCE_SHA256SUMS.txt`
