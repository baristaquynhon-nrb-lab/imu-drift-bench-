/**
 * cnl_generator.js — Intent/Slots → CNL Program Generator
 *
 * Generates CNL program text from intent and slots.
 *
 * MUST:
 * - Use CNL templates from lexicon
 * - Add NRBPL_CNL v0.1 header
 * - Add HALT at end
 * - Produce deterministic output
 */

const fs = require('fs');
const path = require('path');

// Load lexicon
const LEXICON_PATH = path.join(__dirname, 'NL_LEXICON_VI_EN_v0_1.json');
const LEXICON = JSON.parse(fs.readFileSync(LEXICON_PATH, 'utf8'));

/**
 * Generate CNL statement from intent and slots.
 * @param {string} intent - Intent name
 * @param {Object} slots - Slot values
 * @returns {string} - CNL statement
 */
function generateCNLStatement(intent, slots) {
  const intentDef = LEXICON.intents[intent];
  if (!intentDef) {
    throw new Error(`Unknown intent: ${intent}`);
  }

  let cnl = intentDef.cnl_template;

  // Replace slot placeholders
  for (const slotName in slots) {
    const placeholder = `{${slotName}}`;
    const value = slots[slotName];
    cnl = cnl.replace(placeholder, value);
  }

  return cnl;
}

/**
 * Generate complete CNL program from intent and slots.
 * @param {string} intent - Intent name
 * @param {Object} slots - Slot values
 * @returns {string[]} - CNL program lines
 */
function generateCNLProgram(intent, slots) {
  const lines = [];

  // Add header
  lines.push('NRBPL_CNL v0.1');

  // Add statement
  const statement = generateCNLStatement(intent, slots);
  lines.push(statement);

  // Add HALT
  lines.push('HALT');

  return lines;
}

/**
 * Generate CNL program text (joined with newlines).
 * @param {string} intent - Intent name
 * @param {Object} slots - Slot values
 * @returns {string} - CNL program text
 */
function generateCNLText(intent, slots) {
  const lines = generateCNLProgram(intent, slots);
  return lines.join('\n');
}

module.exports = {
  generateCNLStatement,
  generateCNLProgram,
  generateCNLText
};
