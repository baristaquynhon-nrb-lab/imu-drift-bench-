/**
 * cjson.js — Canonical JSON (RFC 8785 subset) for NRBPL
 *
 * Ensures deterministic serialization for hash computation.
 * Requirements:
 * - Sort object keys alphabetically
 * - No whitespace
 * - Consistent number formatting
 * - UTF-8 encoding
 */

/**
 * Serialize to canonical JSON string.
 * @param {*} obj - Object to canonicalize
 * @returns {string} - Canonical JSON string
 */
function canonicalize(obj) {
  if (obj === null) return 'null';
  if (obj === undefined) return 'null';

  const type = typeof obj;

  if (type === 'boolean') return obj.toString();
  if (type === 'number') {
    if (!Number.isFinite(obj)) {
      throw new Error('Cannot canonicalize non-finite number');
    }
    // Use precise number formatting (no exponential for small numbers)
    return JSON.stringify(obj);
  }
  if (type === 'string') return JSON.stringify(obj);

  if (Array.isArray(obj)) {
    const elements = obj.map(canonicalize);
    return '[' + elements.join(',') + ']';
  }

  if (type === 'object') {
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(key => {
      return JSON.stringify(key) + ':' + canonicalize(obj[key]);
    });
    return '{' + pairs.join(',') + '}';
  }

  throw new Error(`Cannot canonicalize type: ${type}`);
}

/**
 * Parse canonical JSON (standard JSON.parse, but validate canonical form).
 * @param {string} str - JSON string
 * @returns {*} - Parsed object
 */
function parse(str) {
  const obj = JSON.parse(str);
  // Verify round-trip consistency
  const recanon = canonicalize(obj);
  if (recanon !== str) {
    throw new Error('Input JSON is not in canonical form');
  }
  return obj;
}

module.exports = {
  canonicalize,
  parse
};
