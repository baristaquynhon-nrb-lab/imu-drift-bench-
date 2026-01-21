/**
 * pr_schema.js — Provenance Record (PR) Schema
 *
 * PR structure (Section K):
 * {
 *   pr_version: "0.1",
 *   op: "opcode_name",
 *   ΔC: { context evidence },
 *   ΔS: { semantic evidence },
 *   ΔP: { phenomenal evidence },
 *   verdict: "PASS" | "FAIL" | "REFUSE",
 *   ts: "ISO8601 timestamp",
 *   hash: "sha256 of canonical PR (excluding this field)"
 * }
 */

const VERDICT_VALUES = ['PASS', 'FAIL', 'REFUSE'];
const PR_VERSION = '0.1';

/**
 * Validate PR structure.
 * @param {Object} pr - PR object
 * @returns {boolean} - true if valid
 * @throws {Error} - if invalid
 */
function validatePR(pr) {
  if (!pr || typeof pr !== 'object') {
    throw new Error('PR must be an object');
  }

  if (pr.pr_version !== PR_VERSION) {
    throw new Error(`PR version must be ${PR_VERSION}`);
  }

  if (typeof pr.op !== 'string' || !pr.op) {
    throw new Error('PR.op must be a non-empty string');
  }

  if (!pr.ΔC || typeof pr.ΔC !== 'object') {
    throw new Error('PR.ΔC must be an object');
  }

  if (!pr.ΔS || typeof pr.ΔS !== 'object') {
    throw new Error('PR.ΔS must be an object');
  }

  if (!pr.ΔP || typeof pr.ΔP !== 'object') {
    throw new Error('PR.ΔP must be an object');
  }

  if (!VERDICT_VALUES.includes(pr.verdict)) {
    throw new Error(`PR.verdict must be one of: ${VERDICT_VALUES.join(', ')}`);
  }

  if (typeof pr.ts !== 'string' || !pr.ts) {
    throw new Error('PR.ts must be an ISO8601 timestamp string');
  }

  return true;
}

/**
 * Create a PR template.
 * @param {string} op - Opcode name
 * @param {Object} deltaC - Context evidence
 * @param {Object} deltaS - Semantic evidence
 * @param {Object} deltaP - Phenomenal evidence
 * @param {string} verdict - Verdict value
 * @returns {Object} - PR object (without hash)
 */
function createPR(op, deltaC, deltaS, deltaP, verdict) {
  if (!VERDICT_VALUES.includes(verdict)) {
    throw new Error(`Invalid verdict: ${verdict}`);
  }

  return {
    pr_version: PR_VERSION,
    op,
    ΔC: deltaC || {},
    ΔS: deltaS || {},
    ΔP: deltaP || {},
    verdict,
    ts: new Date().toISOString()
  };
}

/**
 * Extract evidence fields from PR.
 * @param {Object} pr - PR object
 * @returns {Object} - { ΔC, ΔS, ΔP }
 */
function extractEvidence(pr) {
  return {
    ΔC: pr.ΔC,
    ΔS: pr.ΔS,
    ΔP: pr.ΔP
  };
}

module.exports = {
  PR_VERSION,
  VERDICT_VALUES,
  validatePR,
  createPR,
  extractEvidence
};
