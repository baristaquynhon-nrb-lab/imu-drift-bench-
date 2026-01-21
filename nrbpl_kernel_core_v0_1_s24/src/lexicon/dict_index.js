/**
 * dict_index.js — Dictionary Index and Lookup
 *
 * Provides fast lemma lookup in dictionary packs.
 * Index structure: Map<lemma, entry[]>
 */

/**
 * Build index from pack.
 * @param {Object} pack - Dictionary pack
 * @returns {Map} - Index map
 */
function buildIndex(pack) {
  const index = new Map();

  for (const entry of pack.entries) {
    const lemma = entry.lemma.toLowerCase();
    if (!index.has(lemma)) {
      index.set(lemma, []);
    }
    index.get(lemma).push(entry);
  }

  return index;
}

/**
 * Lookup lemma in index.
 * @param {Map} index - Index map
 * @param {string} lemma - Lemma to lookup
 * @returns {Object[]} - Array of entries, or empty array if not found
 */
function lookup(index, lemma) {
  const key = lemma.toLowerCase();
  return index.get(key) || [];
}

/**
 * Create evidence object for DICT_LOOKUP operation.
 * @param {string} lemma - Lemma looked up
 * @param {Object[]} results - Lookup results
 * @param {string} dict_id - Dictionary ID
 * @param {string} dict_hash - Dictionary pack hash
 * @returns {Object} - Evidence object with ΔC, ΔS, ΔP
 */
function createLookupEvidence(lemma, results, dict_id, dict_hash) {
  return {
    ΔC: {
      dict_id,
      dict_hash,
      lemma,
      found: results.length > 0
    },
    ΔS: {
      results: results.map(r => ({
        lemma: r.lemma,
        pos: r.pos,
        sense_count: r.senses.length
      }))
    },
    ΔP: {
      lookup_time: new Date().toISOString(),
      result_count: results.length
    }
  };
}

/**
 * Check if lemma exists in index.
 * @param {Map} index - Index map
 * @param {string} lemma - Lemma to check
 * @returns {boolean} - true if found
 */
function exists(index, lemma) {
  const key = lemma.toLowerCase();
  return index.has(key);
}

/**
 * Get all lemmas in index.
 * @param {Map} index - Index map
 * @returns {string[]} - Array of lemmas
 */
function getAllLemmas(index) {
  return Array.from(index.keys());
}

module.exports = {
  buildIndex,
  lookup,
  createLookupEvidence,
  exists,
  getAllLemmas
};
