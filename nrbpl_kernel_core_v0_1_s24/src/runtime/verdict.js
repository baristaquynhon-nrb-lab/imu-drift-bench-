/**
 * verdict.js — Verdict Propagation Logic (Section V)
 *
 * Verdict discipline:
 * - REFUSE > FAIL > PASS (strict ordering)
 * - Any REFUSE in chain → entire chain REFUSE
 * - Any FAIL (without REFUSE) → entire chain FAIL
 * - All PASS → chain PASS
 */

const VERDICT_ORDER = {
  'REFUSE': 3,
  'FAIL': 2,
  'PASS': 1
};

/**
 * Merge multiple verdicts into single verdict.
 * @param {string[]} verdicts - Array of verdict strings
 * @returns {string} - Merged verdict
 */
function mergeVerdicts(verdicts) {
  if (!verdicts || verdicts.length === 0) {
    return 'REFUSE'; // No evidence → REFUSE
  }

  let maxOrder = 0;
  let result = 'PASS';

  for (const v of verdicts) {
    const order = VERDICT_ORDER[v];
    if (order === undefined) {
      throw new Error(`Invalid verdict: ${v}`);
    }
    if (order > maxOrder) {
      maxOrder = order;
      result = v;
    }
  }

  return result;
}

/**
 * Propagate verdict from dependencies.
 * If any dependency is REFUSE or FAIL, propagate that.
 * @param {Object[]} prList - List of PR objects
 * @returns {string} - Propagated verdict
 */
function propagateVerdicts(prList) {
  if (!prList || prList.length === 0) {
    return 'REFUSE';
  }

  const verdicts = prList.map(pr => pr.verdict);
  return mergeVerdicts(verdicts);
}

/**
 * Check if verdict is terminal (REFUSE or FAIL).
 * @param {string} verdict - Verdict string
 * @returns {boolean} - true if terminal
 */
function isTerminal(verdict) {
  return verdict === 'REFUSE' || verdict === 'FAIL';
}

/**
 * Check if verdict allows continuation.
 * @param {string} verdict - Verdict string
 * @returns {boolean} - true if PASS
 */
function canContinue(verdict) {
  return verdict === 'PASS';
}

module.exports = {
  VERDICT_ORDER,
  mergeVerdicts,
  propagateVerdicts,
  isTerminal,
  canContinue
};
