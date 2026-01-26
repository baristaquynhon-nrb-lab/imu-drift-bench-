#!/usr/bin/env node
/**
 * NRBPL_CANONICALIZER v0.1
 *
 * Produces a byte-stable canonical representation of runtime state.
 * Strips non-deterministic fields (timestamp), sorts all keys and arrays,
 * computes canonical SHA-256 hash.
 *
 * Input:  final_state.json (from NRBPL_RUNTIME)
 * Output: canonical_state.json (byte-stable, hash-auditable)
 *
 * Exit codes:
 *   0  PASS
 *   2  FAIL (IO/parse error)
 */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function die(code, msg) {
  console.error(msg);
  process.exit(code);
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    die(2, `FAIL: cannot read/parse JSON: ${p} -- ${e.message}`);
  }
}

/**
 * Deep-sort all object keys recursively for byte-stable JSON output.
 * Arrays of objects are sorted by a stable key (step, event_id, name, rel, verb).
 */
function canonicalize(obj) {
  if (obj === null || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    // Sort arrays of objects by stable key for determinism
    const sorted = obj.map(canonicalize);
    if (sorted.length > 0 && typeof sorted[0] === "object" && sorted[0] !== null) {
      // Find best sort key
      const sortKey = ["step", "event_id", "name", "rel", "verb", "index"]
        .find(k => k in sorted[0]);
      if (sortKey) {
        sorted.sort((a, b) => {
          const av = a[sortKey];
          const bv = b[sortKey];
          if (typeof av === "number" && typeof bv === "number") return av - bv;
          return String(av).localeCompare(String(bv));
        });
      }
    }
    return sorted;
  }

  // Sort object keys
  const keys = Object.keys(obj).sort();
  const result = {};
  for (const k of keys) {
    result[k] = canonicalize(obj[k]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node NRBPL_CANONICALIZER_v0_1.js <final_state.json> <canonical_state.json>");
  process.exit(2);
}

const inputPath = path.resolve(args[0]);
const outputPath = path.resolve(args[1]);

const state = readJson(inputPath);

// Strip non-deterministic fields
const canonical = {
  runtime: state.runtime || "NRBPL_RUNTIME_v0_1",
  version: state.version || "0.1.0",
  stream_file: state.stream_file || null,
  registry_file: state.registry_file || null,
  summary: canonicalize(state.summary || {}),
  context: canonicalize(state.context || {}),
  entities: canonicalize(state.entities || {}),
  timeline: canonicalize(state.timeline || []),
  verdict: state.verdict || "UNKNOWN"
};

// Compute canonical hash (of entities + context + timeline only — the semantic core)
const hashPayload = JSON.stringify({
  context: canonical.context,
  entities: canonical.entities,
  timeline: canonical.timeline
});
const stateHash = crypto.createHash("sha256").update(hashPayload).digest("hex");

canonical.state_hash_canonical = stateHash;

// Write byte-stable output
const output = JSON.stringify(canonical, null, 2) + "\n";
try {
  fs.writeFileSync(outputPath, output, "utf8");
} catch (e) {
  die(2, `FAIL: cannot write output: ${outputPath} -- ${e.message}`);
}

// Summary
const report = {
  canonicalizer: "NRBPL_CANONICALIZER_v0.1",
  verdict: "PASS",
  exit_code: 0,
  input_file: path.basename(inputPath),
  output_file: path.basename(outputPath),
  state_hash_canonical: stateHash,
  entity_count: Object.keys(canonical.entities).length,
  timeline_steps: canonical.timeline.length
};

console.log(JSON.stringify(report, null, 2));
process.exit(0);
