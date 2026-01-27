# NRBPL Roadmap Position Statement v0.1

**Date**: 2025-01-21
**Author**: Nguyen Ngoc Thi — SEE-R OS / NRB Laboratory
**Status**: NORMATIVE SPECIFICATION

---

## Executive Summary

NRBPL (Neuro-Reflex Barrier Programming Language) currently stands at the completion of **Milestone M1: Kernel-CORE v0.1**.

**Current Position**:
- ✅ **Kernel-CORE v0.1 COMPLETE** — Execution kernel operational with full PR/ledger verification
- ⛔ **Platform-CORE v0.1 BLOCKED** — Awaiting Section P (Pack Format) implementation

**Critical Path**: Section P binary pack format + PACK opcodes + compiler integration

---

## Layered Roadmap (L0 → L4)

### L0 — Philosophy / Laws ✅ DONE

**Status**: COMPLETE

**Components**:
- UGTS (Universal Grounded Truth System)
- CPL (Condition–Phenomenon Law)
- Verdict discipline (REFUSE > FAIL > PASS)
- "No ungrounded assertion" principle
- Fail-fast, refuse-first design

**Assessment**: NRBPL's philosophical foundation is complete and stable.

---

### L1 — Kernel ISA + PR Model + Ledger/Replay ✅ DONE

**Status**: COMPLETE (Kernel-CORE v0.1)

**Components**:
- **Section E**: ISA opcode semantics (stack-based VM)
  - PUSH, POP, DICT_LOOKUP, ASSERT_FOUND, HALT
  - Evidence generation for each operation
- **Section K**: PR schema (ΔC/ΔS/ΔP structure)
  - Provenance Record with context/semantic/phenomenal evidence
  - Verdict per PR
- **Section D**: Hash-chain ledger
  - Append PR with chain hash
  - Verify ledger integrity
  - Replay from ledger
- **Section V**: Verdict propagation (normative draft)
  - REFUSE > FAIL > PASS ordering
  - Terminal verdict handling
  - Fail-fast execution
- **Trial Protocol**: Manifest and forensic verification (Appendix T1)

**Implementation**:
- ✅ `src/runtime/`: cjson, pr_schema, verdict, pr_hash, ledger
- ✅ `src/vm/`: vm, vm_error
- ✅ `src/lexicon/`: dict_index (evidence binding)
- ✅ `src/pack/`: dict_pack (JSON-pack v0.1)
- ✅ End-to-end test suite: evidence → PR → ledger → replay

**Technical Assessment**:
- Kernel ISA is **execution-ready**
- PR model is **forensic-ready**
- Ledger verification is **deterministic and tamper-evident**
- **ABI/opcode semantics can be frozen** for Platform-CORE

**Critical Decision Point**:
> **L1 is COMPLETE and STABLE. ABI freeze is RECOMMENDED.**

---

### L2 — Platform Core ⛔ IN PROGRESS / BLOCKED

**Status**: BLOCKED by Section P

**Missing Components**:

#### 1. Section P: Pack Format (CRITICAL PATH)
- **Current**: JSON-pack format (v0.1-json)
- **Required**: Binary/sectioned pack container
  - Magic bytes + version header
  - Section markers (DICT, META, SIGN)
  - Compression support
  - Signature/hash integrity
- **Constraint**: Must preserve ABI/opcode semantics (no observable behavior change)
- **Impact**: High — blocks distribution and versioning

#### 2. PACK Opcodes
- `PACK_LOAD`: Load pack into VM context
- `PACK_VERIFY`: Verify pack hash/signature
- **Dependency**: Requires Section P completion

#### 3. DICT_LOOKUP Evidence Binding
- **Current**: Evidence generation works but limited to JSON-pack
- **Required**: Bind to Section P binary pack provenance
- **Dependency**: Section P completion

#### 4. Corpus/Dictionary Versioning
- Versioned pack with hash provenance
- Pack upgrade law (immutability + migration)
- Pack dependency resolution

**Implementation Status**:
- ⛔ Section P spec: NOT STARTED
- ⛔ Binary pack loader: NOT STARTED
- ⛔ PACK opcodes: NOT STARTED
- ⛔ Pack versioning law: NOT STARTED

**Assessment**:
> **L2 is the CRITICAL PATH for Platform-CORE v0.1.**
> **Section P must be completed before NRBPL can be considered a "platform".**

---

### L3 — Developer Experience ⏳ NOT STARTED / POST-P

**Status**: PENDING (after Section P completion)

**Components**:

#### 1. Section F: Compiler (CNL → Program JSON)
- Controlled Natural Language (CNL) parser
- AST → Opcode generation
- Evidence planning (static analysis)
- Compiler provenance record

#### 2. CLI Workflow
- **Current**: Basic `nrbcore run/verify/replay`
- **Required**:
  - `nrbcore compile <cnl> → <program.json>`
  - `nrbcore pack <dict> → <dict.nrbp>`
  - `nrbcore verify-pack <pack.nrbp>`
  - Interactive debugger
  - Profile/trace tools

#### 3. Debugging/Profiling Hooks
- PR stream inspection
- Ledger breakpoint replay
- Verdict trace visualization
- Performance profiling

#### 4. Tooling Spec
- Language Server Protocol (LSP) for CNL
- VS Code extension
- Syntax highlighting
- Linter for CNL

**Assessment**:
> **L3 is ESSENTIAL for developer adoption but BLOCKED by L2.**

---

### L4 — Natural Language Frontend ⏳ RESEARCH TRACK

**Status**: RESEARCH EXTENSION (not blocking Platform-CORE)

**Components**:

#### 1. PR-NLC (Section N)
- Natural Language Canonicalization
- Hash binding for NL → CNL transformation
- Dual-ledger verifier (NLC ledger + exec ledger)

#### 2. Speech-to-CNL Pipeline
- ASR → NL → CNL deterministic pipeline
- Vietnamese voice support (ΔS-Reflex integration)
- Real-time reflex-to-code generation

#### 3. NLC Ledger
- Separate ledger for NL → CNL transformations
- Cross-reference with execution ledger
- Forensic trace from speech to execution

**Assessment**:
> **L4 is a RESEARCH TRACK. Correct direction but not Platform-CORE requirement.**

---

## Milestone Definitions

### M1 — Kernel-CORE v0.1 ✅ PASS

**Condition**:
- ✅ VM executes programs
- ✅ Every operation emits PR
- ✅ Ledger append/verify/replay works
- ✅ Trial artifacts are complete
- ✅ End-to-end test passes

**Status**: **COMPLETE**

**Deliverables**:
- `nrbpl_kernel_core_v0_1_s24/` package
- Test suite with 100% pass rate
- Example program + dictionary
- Trial ledger output

---

### M2 — Platform-CORE v0.1 ⛔ BLOCKED

**Condition**:
- ⛔ Section P binary pack format implemented
- ⛔ `.nrbp-dict` pack format standardized
- ⛔ `PACK_LOAD` / `PACK_VERIFY` opcodes working
- ⛔ `DICT_LOOKUP` generates Section P evidence
- ⛔ Verdict propagation strict enforcement
- ⛔ Trial suite runs on binary packs

**Status**: **NOT STARTED (BLOCKED BY SECTION P)**

**Critical Dependencies**:
1. Section P specification
2. Binary pack format design
3. Pack loader implementation
4. Opcode integration

**Estimated Effort**:
- Section P spec: 2-3 days
- Binary pack implementation: 3-5 days
- Opcode integration: 2-3 days
- Test suite update: 1-2 days
- **Total**: ~10-15 days engineering time

---

### M3 — Platform v0.1-RELEASE ⏳ FUTURE

**Condition**:
- ⛔ Section P + Section F (compiler) complete
- ⛔ Full CLI tooling
- ⛔ Distribution + upgrade law
- ⛔ Security/sandbox limits
- ⛔ Full conformance suite

**Status**: **NOT STARTED (AFTER M2)**

---

## Critical Path Analysis

### Immediate Next Steps

**Priority 1 (CRITICAL)**:
1. **Write Section P Specification**
   - Define binary pack format
   - Specify section markers
   - Define hash/signature scheme
   - Document ABI compatibility constraints

2. **Implement Binary Pack Format**
   - Pack writer (dict → .nrbp binary)
   - Pack reader (deserialize + verify)
   - Hash computation (deterministic)
   - Test suite for pack integrity

3. **Implement PACK Opcodes**
   - `PACK_LOAD`: Load pack into VM
   - `PACK_VERIFY`: Verify pack hash
   - Evidence generation for PACK operations

4. **Update DICT_LOOKUP**
   - Bind to binary pack provenance
   - Generate Section P evidence
   - Update test suite

**Priority 2 (HIGH)**:
5. **Pack Versioning Law**
   - Immutability constraints
   - Migration protocol
   - Dependency resolution

6. **Trial Suite Update**
   - Binary pack examples
   - End-to-end verification with Section P
   - Regression tests

**Priority 3 (MEDIUM)**:
7. **Section F Compiler (CNL → Program JSON)**
   - After Section P stabilizes
   - Enables developer workflow
   - Required for Platform v0.1-RELEASE

---

## Blocking Issues

### Section P is the SINGLE BLOCKING ISSUE

**Current State**:
- Kernel-CORE v0.1 uses JSON-pack (temporary format)
- JSON-pack is INTENTIONAL (to avoid breaking ABI during kernel development)
- JSON-pack is NOT SUITABLE for production distribution

**Why Section P Blocks Platform-CORE**:
1. **Distribution**: Binary packs are required for efficient distribution
2. **Versioning**: Pack versioning depends on binary format
3. **Integrity**: Signature/hash scheme requires binary format spec
4. **Performance**: JSON parsing is slower than binary deserialization
5. **Compatibility**: Future-proof format with version headers

**Mitigation**:
- JSON-pack remains valid for Kernel-CORE v0.1 testing
- Section P implementation will NOT change ABI/opcode semantics
- Migration path: JSON-pack → binary pack converter

---

## Roadmap Decision Matrix

| Layer | Status | Blocking? | Priority | Effort |
|-------|--------|-----------|----------|--------|
| L0 (Philosophy) | DONE | No | N/A | N/A |
| L1 (Kernel) | DONE | No | N/A | N/A |
| L2 (Platform-CORE) | BLOCKED | **YES** | **CRITICAL** | 10-15 days |
| L3 (DevEx) | NOT STARTED | No | HIGH | 15-20 days |
| L4 (NL Frontend) | RESEARCH | No | LOW | Research track |

**Critical Path**: L2 (Section P) → L3 (Compiler) → M3 (Platform-RELEASE)

---

## Conclusion

### Current Position (1 sentence)

**NRBPL has completed Kernel-CORE v0.1 (Execution & Forensic Verification Ready) but is BLOCKED from Platform v0.1-RELEASE by Section P (Pack Format).**

### Strategic Recommendation

**FOCUS ALL EFFORT ON SECTION P.**

Once Section P is complete:
- Platform-CORE v0.1 becomes achievable
- Compiler (Section F) can proceed
- Distribution becomes viable
- NRBPL transitions from "kernel" to "platform"

### Stability Guarantee

**L1 (Kernel-CORE v0.1) is STABLE and ABI-FROZEN.**

All future work (L2, L3, L4) must preserve:
- Opcode semantics (Section E)
- PR schema (Section K)
- Ledger format (Section D)
- Verdict discipline (Section V)

---

## Appendix: Definition of "Platform"

A "platform" requires:
1. ✅ Execution kernel (DONE)
2. ⛔ Distribution format (BLOCKED by Section P)
3. ⛔ Compiler toolchain (PENDING)
4. ⛔ Developer tools (PENDING)
5. ⛔ Upgrade/migration law (PENDING)

**NRBPL is currently a "kernel", not yet a "platform".**

---

**Document Version**: 0.1
**Last Updated**: 2025-01-21
**Next Review**: After Section P completion

---

**"The kernel is complete. The platform awaits Section P."** — NRBPL Roadmap v0.1
