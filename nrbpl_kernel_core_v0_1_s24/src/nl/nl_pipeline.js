/**
 * nl_pipeline.js — Complete NL Programming Pipeline
 *
 * NL → Intent/Slots → CNL → IR → Opcodes
 *
 * MUST:
 * - Be deterministic
 * - Refuse on any ambiguity or error
 * - Preserve exact semantics at each stage
 * - Generate audit trail
 */

const nlParser = require('./nl_parser');
const cnlGenerator = require('./cnl_generator');
const cnlToIR = require('./cnl_to_ir');
const irToOpcodes = require('./ir_to_opcodes');

/**
 * Process NL input through complete pipeline.
 * @param {string} nlInput - Natural language input
 * @param {string} lang - Language code ('vi' or 'en')
 * @returns {Object} - Pipeline result
 */
function processNL(nlInput, lang = 'vi') {
  const result = {
    nl_input: nlInput,
    lang,
    verdict: 'PASS',
    stages: {}
  };

  try {
    // Stage 1: NL → Intent/Slots
    const parseResult = nlParser.parseNL(nlInput, lang);
    result.stages.parse = parseResult;

    if (parseResult.verdict !== 'PASS') {
      result.verdict = parseResult.verdict;
      result.reason = parseResult.reason;
      return result;
    }

    const { intent, slots } = parseResult;

    // Stage 2: Intent/Slots → CNL
    const cnlLines = cnlGenerator.generateCNLProgram(intent, slots);
    const cnlText = cnlLines.join('\n');
    result.stages.cnl = {
      lines: cnlLines,
      text: cnlText
    };

    // Stage 3: CNL → IR
    const ir = cnlToIR.parseCNL(cnlText);
    cnlToIR.validateIR(ir);
    result.stages.ir = ir;

    // Stage 4: IR → Opcodes
    const opcodes = irToOpcodes.compileIR(ir);
    result.stages.opcodes = opcodes;

    result.verdict = 'PASS';
    return result;

  } catch (error) {
    result.verdict = 'REFUSE';
    result.reason = error.message;
    result.error = error;
    return result;
  }
}

/**
 * Process NL and return CNL text only.
 * @param {string} nlInput - Natural language input
 * @param {string} lang - Language code
 * @returns {Object} - { verdict, cnl?, reason? }
 */
function nlToCNL(nlInput, lang = 'vi') {
  try {
    const parseResult = nlParser.parseNL(nlInput, lang);

    if (parseResult.verdict !== 'PASS') {
      return {
        verdict: parseResult.verdict,
        reason: parseResult.reason
      };
    }

    const { intent, slots } = parseResult;
    const cnlText = cnlGenerator.generateCNLText(intent, slots);

    return {
      verdict: 'PASS',
      cnl: cnlText
    };
  } catch (error) {
    return {
      verdict: 'REFUSE',
      reason: error.message
    };
  }
}

/**
 * Process NL and return IR only.
 * @param {string} nlInput - Natural language input
 * @param {string} lang - Language code
 * @returns {Object} - { verdict, ir?, reason? }
 */
function nlToIR(nlInput, lang = 'vi') {
  const result = processNL(nlInput, lang);

  if (result.verdict !== 'PASS') {
    return {
      verdict: result.verdict,
      reason: result.reason
    };
  }

  return {
    verdict: 'PASS',
    ir: result.stages.ir
  };
}

/**
 * Process NL and return opcodes only.
 * @param {string} nlInput - Natural language input
 * @param {string} lang - Language code
 * @returns {Object} - { verdict, opcodes?, reason? }
 */
function nlToOpcodes(nlInput, lang = 'vi') {
  const result = processNL(nlInput, lang);

  if (result.verdict !== 'PASS') {
    return {
      verdict: result.verdict,
      reason: result.reason
    };
  }

  return {
    verdict: 'PASS',
    opcodes: result.stages.opcodes
  };
}

module.exports = {
  processNL,
  nlToCNL,
  nlToIR,
  nlToOpcodes
};
