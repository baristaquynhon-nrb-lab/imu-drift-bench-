# NRBPL_L1B_COLLOC_FRAME_CLOSURE_CERTIFICATE_v0_1
Status: CLOSURE-CERTIFIED (L1-B)

## ΔC — Condition (Anchors + Locks)
- HEAD: d76d4a5b71016a79a019f869266384d72427454e
- locks: locks/PATCH_SCOPE_LOCK_v0_1.json, locks/KERNEL_ABI_LOCK.json, locks/SEMANTIC_LAW_LOCK_v0_1.json, locks/L2_REQUIRED_UNITS_LOCK_v0_1.json, locks/L1B_SCOPE_LOCK_v0_1.json

## ΔS — Stability (Artifacts + Evidence Chain)
- lexicon/en_vi_collocations_2k.jsonl sha256: 30ba36759ce6ce278282bc773a2d7ff4f221d24601c7f0422ebd9cfcfd921b05
- lexicon/en_vi_frames_2k.jsonl sha256: e2557b2714760603bc773fcdef1ab45bd3319a397c60791f63f72a74c16f178b
- evidence: _audit/l1b_lexicon_2k/EVIDENCE_SHA256SUMS.txt

## ΔP — Phenomenon (Gate Verdict)
- semantic gate log: _audit/l1b_lexicon_2k/03_semantic_gate.log
- verdict: SUPPORTED (exit 0) iff semantic_gate.js returned exit 0

