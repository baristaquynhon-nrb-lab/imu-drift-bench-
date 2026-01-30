"use strict";

function stableNormalize(v) {
  if (v === null || v === undefined) return v;
  if (typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(stableNormalize);

  const keys = Object.keys(v).sort();
  const out = {};
  for (const k of keys) out[k] = stableNormalize(v[k]);
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableNormalize(value));
}

module.exports = { stableNormalize, stableStringify };
