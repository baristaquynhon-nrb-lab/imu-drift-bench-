/**
 * ir_to_opcodes.js — IR → Opcodes Compiler
 *
 * Compiles IR instructions to VM-compatible opcode format.
 *
 * Output format (compatible with vm.js):
 * {
 *   program_name: "...",
 *   program_version: "0.1.0",
 *   instructions: [
 *     { op: "DICT_LOOKUP", args: { dict_id: "...", lemma: "..." } },
 *     { op: "ASSERT_FOUND", args: {} },
 *     { op: "HALT", args: {} }
 *   ]
 * }
 *
 * Special handling:
 * - DICT_LOOKUP: Extract dict_id from using_pack path
 * - LEDGER_VERIFY/REPLAY: Compile to meta instructions (not VM opcodes)
 *
 * MUST:
 * - Preserve exact semantics from IR
 * - Generate deterministic opcodes
 * - Be compatible with Kernel-CORE ISA v0.1
 */

const path = require('path');

/**
 * Compile IR to opcodes program.
 * @param {Object} ir - IR object
 * @returns {Object} - Opcodes program
 */
function compileIR(ir) {
  const instructions = [];

  for (const irInstruction of ir.instructions) {
    const opcodeInstruction = compileInstruction(irInstruction);
    if (opcodeInstruction) {
      instructions.push(opcodeInstruction);
    }
  }

  return {
    program_name: 'NL-Generated Program',
    program_version: '0.1.0',
    source: 'NRBPL_NL_PROGRAMMING_v0.1',
    instructions
  };
}

/**
 * Compile single IR instruction to opcode.
 * @param {Object} irInstruction - IR instruction
 * @returns {Object|null} - Opcode instruction or null for meta instructions
 */
function compileInstruction(irInstruction) {
  switch (irInstruction.type) {
    case 'DICT_LOOKUP':
      return compileDictLookup(irInstruction);
    case 'ASSERT_FOUND':
      return compileAssertFound(irInstruction);
    case 'HALT':
      return compileHalt(irInstruction);
    case 'LEDGER_VERIFY':
    case 'LEDGER_REPLAY':
      // These are meta instructions (handled by executor, not VM)
      return {
        op: irInstruction.type,
        args: {
          path: irInstruction.path
        },
        meta: true
      };
    default:
      throw new Error(`Unknown IR instruction type: ${irInstruction.type}`);
  }
}

/**
 * Compile DICT_LOOKUP instruction.
 * @param {Object} irInstruction - IR instruction
 * @returns {Object} - Opcode instruction
 */
function compileDictLookup(irInstruction) {
  const { lemma, using_pack } = irInstruction;

  // Extract dict_id from pack path
  // For example: examples/en_en_lex_min.nrbp-dict.json → en_en_lex_min
  const dict_id = extractDictId(using_pack);

  return {
    op: 'DICT_LOOKUP',
    args: {
      dict_id,
      lemma
    },
    meta: {
      using_pack
    }
  };
}

/**
 * Extract dictionary ID from pack path.
 * @param {string} packPath - Pack file path
 * @returns {string} - Dictionary ID
 */
function extractDictId(packPath) {
  const basename = path.basename(packPath, '.json');

  // Remove .nrbp-dict suffix if present
  if (basename.endsWith('.nrbp-dict')) {
    return basename.slice(0, -'.nrbp-dict'.length);
  }

  return basename;
}

/**
 * Compile ASSERT_FOUND instruction.
 * @param {Object} irInstruction - IR instruction
 * @returns {Object} - Opcode instruction
 */
function compileAssertFound(irInstruction) {
  return {
    op: 'ASSERT_FOUND',
    args: {}
  };
}

/**
 * Compile HALT instruction.
 * @param {Object} irInstruction - IR instruction
 * @returns {Object} - Opcode instruction
 */
function compileHalt(irInstruction) {
  return {
    op: 'HALT',
    args: {
      reason: 'NL program completed'
    }
  };
}

module.exports = {
  compileIR,
  compileInstruction,
  compileDictLookup,
  compileAssertFound,
  compileHalt,
  extractDictId
};
