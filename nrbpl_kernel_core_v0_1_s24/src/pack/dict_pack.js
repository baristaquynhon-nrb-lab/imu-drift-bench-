/**
 * dict_pack.js — Dictionary Pack Format (JSON-pack for Kernel-CORE v0.1)
 *
 * Pack structure:
 * {
 *   pack_version: "0.1-json",
 *   pack_type: "dict",
 *   dict_id: "unique_id",
 *   dict_version: "semver",
 *   hash: "sha256 of pack (excluding this field)",
 *   entries: [
 *     {
 *       lemma: "word",
 *       pos: "NOUN|VERB|...",
 *       senses: [
 *         {
 *           sense_id: "word.01",
 *           definition: "...",
 *           examples: ["..."]
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * NOTE: This is JSON-pack format for Kernel-CORE v0.1.
 * Section P binary pack format will be implemented in Platform-CORE.
 */

const crypto = require('crypto');
const cjson = require('../runtime/cjson');

const PACK_VERSION = '0.1-json';

/**
 * Validate dictionary pack.
 * @param {Object} pack - Pack object
 * @returns {boolean} - true if valid
 * @throws {Error} - if invalid
 */
function validatePack(pack) {
  if (!pack || typeof pack !== 'object') {
    throw new Error('Pack must be an object');
  }

  if (pack.pack_version !== PACK_VERSION) {
    throw new Error(`Pack version must be ${PACK_VERSION}`);
  }

  if (pack.pack_type !== 'dict') {
    throw new Error('Pack type must be "dict"');
  }

  if (!pack.dict_id || typeof pack.dict_id !== 'string') {
    throw new Error('Pack must have dict_id');
  }

  if (!pack.dict_version || typeof pack.dict_version !== 'string') {
    throw new Error('Pack must have dict_version');
  }

  if (!Array.isArray(pack.entries)) {
    throw new Error('Pack must have entries array');
  }

  return true;
}

/**
 * Compute hash of pack.
 * @param {Object} pack - Pack object
 * @returns {string} - Hex digest
 */
function hashPack(pack) {
  const packCopy = { ...pack };
  delete packCopy.hash;

  const canonical = cjson.canonicalize(packCopy);
  const hash = crypto.createHash('sha256');
  hash.update(canonical, 'utf8');
  return hash.digest('hex');
}

/**
 * Verify pack hash.
 * @param {Object} pack - Pack object with hash field
 * @returns {boolean} - true if valid
 */
function verifyPackHash(pack) {
  if (!pack.hash) {
    throw new Error('Pack has no hash field');
  }

  const computed = hashPack(pack);
  return computed === pack.hash;
}

/**
 * Add hash to pack (mutates).
 * @param {Object} pack - Pack object
 * @returns {Object} - Pack with hash
 */
function addHashToPack(pack) {
  pack.hash = hashPack(pack);
  return pack;
}

/**
 * Create empty pack.
 * @param {string} dict_id - Dictionary ID
 * @param {string} dict_version - Dictionary version
 * @returns {Object} - Empty pack
 */
function createPack(dict_id, dict_version) {
  return {
    pack_version: PACK_VERSION,
    pack_type: 'dict',
    dict_id,
    dict_version,
    entries: []
  };
}

/**
 * Add entry to pack.
 * @param {Object} pack - Pack object
 * @param {Object} entry - Entry object { lemma, pos, senses }
 * @returns {Object} - Updated pack
 */
function addEntry(pack, entry) {
  if (!entry.lemma || !entry.pos || !Array.isArray(entry.senses)) {
    throw new Error('Invalid entry format');
  }

  pack.entries.push(entry);
  return pack;
}

module.exports = {
  PACK_VERSION,
  validatePack,
  hashPack,
  verifyPackHash,
  addHashToPack,
  createPack,
  addEntry
};
