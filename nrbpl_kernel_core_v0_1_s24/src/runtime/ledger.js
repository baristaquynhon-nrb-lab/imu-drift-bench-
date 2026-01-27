/**
 * ledger.js — Hash-Chain Ledger (Section D)
 *
 * Ledger structure:
 * {
 *   version: "0.1",
 *   genesis_hash: "sha256 of genesis block",
 *   entries: [
 *     {
 *       pr: { ... },
 *       chain_hash: "hash(prev_chain_hash + pr.hash)"
 *     },
 *     ...
 *   ]
 * }
 */

const prHash = require('./pr_hash');
const prSchema = require('./pr_schema');

const LEDGER_VERSION = '0.1';
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Create new ledger.
 * @returns {Object} - Empty ledger
 */
function createLedger() {
  return {
    version: LEDGER_VERSION,
    genesis_hash: GENESIS_HASH,
    entries: []
  };
}

/**
 * Append PR to ledger.
 * @param {Object} ledger - Ledger object
 * @param {Object} pr - PR object (must have hash)
 * @returns {Object} - Updated ledger
 */
function appendPR(ledger, pr) {
  // Validate PR
  prSchema.validatePR(pr);

  // Ensure PR has hash
  if (!pr.hash) {
    prHash.addHashToPR(pr);
  }

  // Verify PR hash
  if (!prHash.verifyPRHash(pr)) {
    throw new Error('PR hash verification failed');
  }

  // Compute chain hash
  const prevChainHash = ledger.entries.length > 0
    ? ledger.entries[ledger.entries.length - 1].chain_hash
    : ledger.genesis_hash;

  const currentChainHash = prHash.chainHash(prevChainHash, pr.hash);

  // Append entry
  ledger.entries.push({
    pr,
    chain_hash: currentChainHash
  });

  return ledger;
}

/**
 * Verify entire ledger chain.
 * @param {Object} ledger - Ledger object
 * @returns {boolean} - true if valid
 * @throws {Error} - if invalid
 */
function verifyLedger(ledger) {
  if (ledger.version !== LEDGER_VERSION) {
    throw new Error(`Invalid ledger version: ${ledger.version}`);
  }

  if (ledger.genesis_hash !== GENESIS_HASH) {
    throw new Error('Invalid genesis hash');
  }

  let prevChainHash = ledger.genesis_hash;

  for (let i = 0; i < ledger.entries.length; i++) {
    const entry = ledger.entries[i];
    const pr = entry.pr;

    // Validate PR
    prSchema.validatePR(pr);

    // Verify PR hash
    if (!prHash.verifyPRHash(pr)) {
      throw new Error(`Entry ${i}: PR hash verification failed`);
    }

    // Verify chain hash
    const expectedChainHash = prHash.chainHash(prevChainHash, pr.hash);
    if (entry.chain_hash !== expectedChainHash) {
      throw new Error(`Entry ${i}: Chain hash mismatch`);
    }

    prevChainHash = entry.chain_hash;
  }

  return true;
}

/**
 * Replay ledger and return list of PRs.
 * @param {Object} ledger - Ledger object
 * @returns {Object[]} - List of PRs
 */
function replayLedger(ledger) {
  verifyLedger(ledger);
  return ledger.entries.map(entry => entry.pr);
}

/**
 * Get latest chain hash.
 * @param {Object} ledger - Ledger object
 * @returns {string} - Chain hash
 */
function getLatestChainHash(ledger) {
  if (ledger.entries.length === 0) {
    return ledger.genesis_hash;
  }
  return ledger.entries[ledger.entries.length - 1].chain_hash;
}

module.exports = {
  LEDGER_VERSION,
  GENESIS_HASH,
  createLedger,
  appendPR,
  verifyLedger,
  replayLedger,
  getLatestChainHash
};
