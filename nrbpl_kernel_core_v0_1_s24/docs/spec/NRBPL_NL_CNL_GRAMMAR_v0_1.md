# NRBPL v0.1 — Section N (Normative)
## Controlled Natural Language (CNL) Grammar v0.1

### N.0 Scope

This section specifies the Controlled Natural Language (CNL) for NRBPL NL Programming v0.1.
CNL serves as a deterministic, unambiguous authoring layer between Natural Language (NL) and IR/Canonical Opcodes.

This version (v0.1) SHALL support only:
- DICT_LOOKUP
- ASSERT_FOUND
- LEDGER_VERIFY
- LEDGER_REPLAY
- HALT

All behaviors MUST be deterministic and replayable.

---

### N.1 Conformance Terms

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", and "MAY"
are to be interpreted as described in RFC 2119.

---

### N.2 Canonical Record Discipline

Every successfully parsed CNL program:
- MUST compile into a canonical IR object (Section N.4).
- MUST compile into a canonical opcode sequence compatible with Kernel-CORE ISA v0.1.
- MUST emit PR records (ΔC/ΔS/ΔP) for each runtime operation.
- MUST support deterministic replay of the resulting ledger.

---

### N.3 CNL Syntax (EBNF)

The grammar below is normative.

#### N.3.1 Lexical Units

- WS = one or more spaces (ASCII 0x20)
- NL = newline ("\n")
- IDENT = [A-Z_][A-Z0-9_]*  (UPPER_SNAKE_CASE only)
- STRING = single-quoted UTF-8 string without unescaped single quote
- INT = [0-9]+
- BOOL = "true" | "false"

#### N.3.2 Grammar

PROGRAM        := HEADER? NL* STATEMENT_LIST
HEADER         := "NRBPL_CNL" WS "v0.1"

STATEMENT_LIST := STATEMENT (NL+ STATEMENT)* NL*
STATEMENT      := TASK_STMT | ASSERT_STMT | LEDGER_STMT | HALT_STMT | COMMENT

COMMENT        := "#" .*   (ignored)

TASK_STMT      := "TASK" WS "DICT_LOOKUP" WS "lemma=" STRING WS "using_pack=" STRING
ASSERT_STMT    := "ASSERT" WS "FOUND" WS "on_last_lookup"
LEDGER_STMT    := "LEDGER" WS ("VERIFY" | "REPLAY") WS "path=" STRING
HALT_STMT      := "HALT"

---

### N.4 Canonical Semantics (Normative)

#### N.4.1 TASK DICT_LOOKUP

CNL:
  TASK DICT_LOOKUP lemma='<LEMMA>' using_pack='<PACK>'

Semantics:
- MUST perform dictionary lookup for lemma within the specified pack.
- MUST emit a PR record with:
  - ΔC: { op: "DICT_LOOKUP", lemma: <LEMMA>, pack: <PACK> }
  - ΔS: { deterministic: true, canonical_inputs: true }
  - ΔP: { verdict: PASS|REFUSE, result: <value?>, reason?: <string?> }
- If lemma is not found, verdict MUST be REFUSE with reason "Lemma not found".

#### N.4.2 ASSERT FOUND on_last_lookup

CNL:
  ASSERT FOUND on_last_lookup

Semantics:
- MUST assert that the immediately preceding DICT_LOOKUP resulted in PASS.
- If last lookup verdict is PASS: ASSERT_FOUND verdict MUST be PASS.
- Otherwise: ASSERT_FOUND verdict MUST be REFUSE with reason "ASSERT_FOUND failed".

#### N.4.3 LEDGER VERIFY / REPLAY

CNL:
  LEDGER VERIFY path='<LEDGER_JSON>'
  LEDGER REPLAY path='<LEDGER_JSON>'

Semantics:
- VERIFY MUST verify hash-chain integrity of the ledger at path.
- REPLAY MUST deterministically replay ledger entries and emit per-entry verdict line.

#### N.4.4 HALT

CNL:
  HALT

Semantics:
- MUST terminate program execution without further opcodes.

---

### N.5 Compilation Constraints (Normative)

- Compiler MUST reject any token outside the grammar (fail-fast).
- Compiler MUST reject missing required key/value pairs.
- Compiler MUST NOT infer default packs, lemmas, or paths.
- Compiler MUST preserve exact lemma/pack/path strings as provided.
- Compiler MUST produce stable opcode sequence for identical CNL input.

---

### N.6 Examples (Normative)

Example 1:
NRBPL_CNL v0.1
TASK DICT_LOOKUP lemma='hello' using_pack='examples/en_en_lex_min.nrbp-dict.json'
ASSERT FOUND on_last_lookup
HALT

Example 2:
NRBPL_CNL v0.1
LEDGER VERIFY path='trial_ledger.json'
HALT
