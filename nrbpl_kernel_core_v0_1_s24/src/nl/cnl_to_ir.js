/**
 * cnl_to_ir.js — CNL → IR Compiler
 *
 * Parses CNL program text and compiles to Intermediate Representation (IR).
 *
 * IR format:
 * {
 *   version: "0.1",
 *   instructions: [
 *     { type: "DICT_LOOKUP", lemma: "...", using_pack: "..." },
 *     { type: "ASSERT_FOUND" },
 *     { type: "LEDGER_VERIFY", path: "..." },
 *     { type: "LEDGER_REPLAY", path: "..." },
 *     { type: "HALT" }
 *   ]
 * }
 *
 * MUST:
 * - Parse CNL according to grammar in NRBPL_NL_CNL_GRAMMAR_v0_1.md
 * - Reject invalid syntax (fail-fast)
 * - Preserve exact slot values
 * - Produce deterministic IR
 */

/**
 * Parse CNL program text into IR.
 * @param {string} cnlText - CNL program text
 * @returns {Object} - IR object
 */
function parseCNL(cnlText) {
  const lines = cnlText.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));

  if (lines.length === 0) {
    throw new Error('CNL program is empty');
  }

  // Check header
  if (lines[0] !== 'NRBPL_CNL v0.1') {
    throw new Error('CNL program must start with "NRBPL_CNL v0.1" header');
  }

  const instructions = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const instruction = parseCNLStatement(line);
    instructions.push(instruction);
  }

  return {
    version: '0.1',
    instructions
  };
}

/**
 * Parse single CNL statement.
 * @param {string} statement - CNL statement
 * @returns {Object} - IR instruction
 */
function parseCNLStatement(statement) {
  // TASK DICT_LOOKUP lemma='...' using_pack='...'
  const dictLookupMatch = statement.match(/^TASK\s+DICT_LOOKUP\s+lemma='([^']+)'\s+using_pack='([^']+)'$/);
  if (dictLookupMatch) {
    return {
      type: 'DICT_LOOKUP',
      lemma: dictLookupMatch[1],
      using_pack: dictLookupMatch[2]
    };
  }

  // ASSERT FOUND on_last_lookup
  if (statement === 'ASSERT FOUND on_last_lookup') {
    return {
      type: 'ASSERT_FOUND'
    };
  }

  // LEDGER VERIFY path='...'
  const ledgerVerifyMatch = statement.match(/^LEDGER\s+VERIFY\s+path='([^']+)'$/);
  if (ledgerVerifyMatch) {
    return {
      type: 'LEDGER_VERIFY',
      path: ledgerVerifyMatch[1]
    };
  }

  // LEDGER REPLAY path='...'
  const ledgerReplayMatch = statement.match(/^LEDGER\s+REPLAY\s+path='([^']+)'$/);
  if (ledgerReplayMatch) {
    return {
      type: 'LEDGER_REPLAY',
      path: ledgerReplayMatch[1]
    };
  }

  // HALT
  if (statement === 'HALT') {
    return {
      type: 'HALT'
    };
  }

  throw new Error(`Invalid CNL statement: ${statement}`);
}

/**
 * Validate IR structure.
 * @param {Object} ir - IR object
 * @returns {boolean} - true if valid
 */
function validateIR(ir) {
  if (!ir || typeof ir !== 'object') {
    throw new Error('IR must be an object');
  }

  if (ir.version !== '0.1') {
    throw new Error('IR version must be 0.1');
  }

  if (!Array.isArray(ir.instructions)) {
    throw new Error('IR must have instructions array');
  }

  // Validate each instruction
  for (const instruction of ir.instructions) {
    validateInstruction(instruction);
  }

  return true;
}

/**
 * Validate IR instruction.
 * @param {Object} instruction - IR instruction
 * @returns {boolean} - true if valid
 */
function validateInstruction(instruction) {
  if (!instruction.type) {
    throw new Error('Instruction must have type');
  }

  switch (instruction.type) {
    case 'DICT_LOOKUP':
      if (!instruction.lemma || !instruction.using_pack) {
        throw new Error('DICT_LOOKUP must have lemma and using_pack');
      }
      break;
    case 'ASSERT_FOUND':
      // No additional fields required
      break;
    case 'LEDGER_VERIFY':
    case 'LEDGER_REPLAY':
      if (!instruction.path) {
        throw new Error(`${instruction.type} must have path`);
      }
      break;
    case 'HALT':
      // No additional fields required
      break;
    default:
      throw new Error(`Unknown instruction type: ${instruction.type}`);
  }

  return true;
}

module.exports = {
  parseCNL,
  parseCNLStatement,
  validateIR,
  validateInstruction
};
