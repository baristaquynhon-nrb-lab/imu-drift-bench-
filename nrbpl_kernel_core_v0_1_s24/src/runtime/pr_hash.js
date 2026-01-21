/**
 * pr_hash.js — PR Hash Computation (Section D)
 *
 * Hash computation:
 * 1. Remove 'hash' field from PR
 * 2. Canonicalize to JSON
 * 3. Compute SHA-256
 * 4. Return hex digest
 */

const crypto = require('crypto');
const cjson = require('./cjson');

/**
 * Compute SHA-256 hash of PR.
 * @param {Object} pr - PR object (with or without hash field)
 * @returns {string} - Hex digest
 */
function hashPR(pr) {
  // Clone and remove hash field
  const prCopy = { ...pr };
  delete prCopy.hash;

  // Canonicalize
  const canonical = cjson.canonicalize(prCopy);

  // Hash
  const hash = crypto.createHash('sha256');
  hash.update(canonical, 'utf8');
  return hash.digest('hex');
}

/**
 * Verify PR hash.
 * @param {Object} pr - PR object with hash field
 * @returns {boolean} - true if hash is correct
 */
function verifyPRHash(pr) {
  if (!pr.hash) {
    throw new Error('PR has no hash field');
  }

  const computed = hashPR(pr);
  return computed === pr.hash;
}

/**
 * Add hash field to PR (mutates PR).
 * @param {Object} pr - PR object
 * @returns {Object} - PR with hash field
 */
function addHashToPR(pr) {
  pr.hash = hashPR(pr);
  return pr;
}

/**
 * Compute chain hash (hash of prev_hash + current PR hash).
 * @param {string} prevHash - Previous hash in chain
 * @param {string} currentHash - Current PR hash
 * @returns {string} - Chain hash
 */
function chainHash(prevHash, currentHash) {
  const combined = prevHash + currentHash;
  const hash = crypto.createHash('sha256');
  hash.update(combined, 'utf8');
  return hash.digest('hex');
}

module.exports = {
  hashPR,
  verifyPRHash,
  addHashToPR,
  chainHash
};
