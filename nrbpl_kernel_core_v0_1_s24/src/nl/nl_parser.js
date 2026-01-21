/**
 * nl_parser.js — NL → Intent/Slots Parser (Section N)
 *
 * Parses natural language input into intent and slots using
 * regex patterns from NL_LEXICON_VI_EN_v0_1.json.
 *
 * MUST:
 * - Match NL input against patterns only (no inference)
 * - Extract slots via regex capture groups
 * - Validate slots against patterns
 * - Refuse on: no match, missing slot, validation fail, ambiguity
 */

const fs = require('fs');
const path = require('path');

// Load lexicon
const LEXICON_PATH = path.join(__dirname, 'NL_LEXICON_VI_EN_v0_1.json');
const LEXICON = JSON.parse(fs.readFileSync(LEXICON_PATH, 'utf8'));

/**
 * Normalize NL input according to lexicon rules.
 * @param {string} input - Raw NL input
 * @returns {string} - Normalized input
 */
function normalizeInput(input) {
  let normalized = input;

  if (LEXICON.normalization.trim_whitespace) {
    normalized = normalized.trim();
  }

  if (LEXICON.normalization.collapse_spaces) {
    normalized = normalized.replace(/\s+/g, ' ');
  }

  return normalized;
}

/**
 * Validate slot value against pattern.
 * @param {string} value - Slot value
 * @param {string} pattern - Regex pattern
 * @returns {boolean} - true if valid
 */
function validateSlot(value, pattern) {
  if (!pattern) return true;
  const regex = new RegExp(pattern);
  return regex.test(value);
}

/**
 * Parse NL input into intent and slots.
 * @param {string} nlInput - Natural language input
 * @param {string} lang - Language code ('vi' or 'en')
 * @returns {Object} - { verdict, intent?, slots?, reason? }
 */
function parseNL(nlInput, lang = 'vi') {
  // Check for forbidden characters in raw input (before normalization removes them)
  if (/[\n\r\t;]/.test(nlInput)) {
    return {
      verdict: 'REFUSE',
      reason: LEXICON.refuse_policy.on_slot_validation_fail.reason
    };
  }

  // Normalize input
  const normalized = normalizeInput(nlInput);

  // Get patterns for language
  const langPatterns = LEXICON.nl_patterns[lang];
  if (!langPatterns) {
    return {
      verdict: 'REFUSE',
      reason: `Language '${lang}' not supported`
    };
  }

  // Try to match against all intent patterns
  // For each intent, try patterns in order and take first match only
  const matches = [];

  for (const intentName in langPatterns) {
    const patterns = langPatterns[intentName];
    const intentDef = LEXICON.intents[intentName];

    let intentMatched = false;

    for (const patternDef of patterns) {
      if (intentMatched) break; // Only one match per intent

      const regex = new RegExp(patternDef.pattern, 'i');
      const match = normalized.match(regex);

      if (match) {
        // Extract slots
        const slots = {};
        for (const slotName in patternDef.slot_map) {
          const captureIndex = patternDef.slot_map[slotName];
          const value = match[captureIndex];

          if (!LEXICON.normalization.preserve_case_in_slots && typeof value === 'string') {
            slots[slotName] = value.toLowerCase();
          } else {
            slots[slotName] = value;
          }
        }

        matches.push({
          intent: intentName,
          slots,
          intentDef
        });

        intentMatched = true;
      }
    }
  }

  // Check for no match
  if (matches.length === 0) {
    return {
      verdict: 'REFUSE',
      reason: LEXICON.refuse_policy.on_no_match.reason
    };
  }

  // Check for ambiguity (multiple matches)
  if (matches.length > 1) {
    return {
      verdict: 'REFUSE',
      reason: LEXICON.refuse_policy.on_ambiguity.reason
    };
  }

  const matched = matches[0];
  const { intent, slots, intentDef } = matched;

  // Check for missing required slots
  for (const requiredSlot of intentDef.required_slots) {
    if (!(requiredSlot in slots) || !slots[requiredSlot]) {
      return {
        verdict: 'REFUSE',
        reason: LEXICON.refuse_policy.on_missing_slot.reason
      };
    }
  }

  // Validate slots against patterns
  for (const slotName in slots) {
    const slotValue = slots[slotName];
    const slotDef = intentDef.slots[slotName];

    if (slotDef && slotDef.pattern) {
      if (!validateSlot(slotValue, slotDef.pattern)) {
        return {
          verdict: 'REFUSE',
          reason: LEXICON.refuse_policy.on_slot_validation_fail.reason
        };
      }
    }
  }

  return {
    verdict: 'PASS',
    intent,
    slots
  };
}

module.exports = {
  parseNL,
  normalizeInput,
  validateSlot,
  LEXICON
};
