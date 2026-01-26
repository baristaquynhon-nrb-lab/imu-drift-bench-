#!/usr/bin/env node
/**
 * NRBPL_CANONICALIZER v0.1
 *
 * Goal:
 *   Same opcode stream -> same canonical JSON -> same SHA-256 hash
 *
 * What it does:
 *   - Removes non-deterministic fields (timestamp, exit_code, any runtime-only noise)
 *   - Deep-sorts all object keys (recursive)
 *   - Sorts arrays deterministically (entities/actions/relations/properties/emotions/timeline/errors)
 *   - Emits byte-stable JSON (with trailing newline)
 *   - Computes SHA-256 over the semantic core: { context, entities, timeline }
 *
 * Usage:
 *   node NRBPL_CANONICALIZER_v0_1.js <final_state.json> <canonical_state.json>
 *
 * Exit codes:
 *   0 = PASS
 *   2 = FAIL (IO/parse/write error)
 */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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

// ---------------------------------------------------------------------------
// Deterministic comparison helpers
// ---------------------------------------------------------------------------

/** Lexicographic compare with numeric fallback (stable across locales). */
function cmp(a, b) {
  if (a === b) return 0;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : 1;
}

function cmpNumOrStr(a, b) {
  const na = typeof a === "number" ? a : Number.NaN;
  const nb = typeof b === "number" ? b : Number.NaN;
  const aNum = Number.isFinite(na);
  const bNum = Number.isFinite(nb);
  if (aNum && bNum) return na - nb;
  return cmp(a, b);
}

/**
 * Choose a stable sort key for arrays of objects.
 * Intentionally conservative: only keys that exist in NRBPL artifacts.
 */
function bestKey(obj) {
  const candidates = [
    "step",
    "index",
    "event_id",
    "name",
    "entity",
    "rel",
    "verb",
    "type",
    "object",
    "container",
    "to",
    "from",
    "target",
    "argument",
    "category",
    "value"
  ];
  for (const k of candidates) {
    if (obj && typeof obj === "object" && k in obj) return k;
  }
  return null;
}

/**
 * Stable stringify requires:
 * - deterministic key order (we will deep-sort keys)
 * - deterministic array order (we will apply schema-aware sorts)
 */

// ---------------------------------------------------------------------------
// Array sorting — schema-aware, deterministic
// ---------------------------------------------------------------------------

function sortArrayDeterministically(arr) {
  // Scalar array: sort lexicographically (stable meaning for sets like properties/emotions).
  if (arr.length === 0) return arr;
  const first = arr[0];
  const isScalar = (v) => v === null || ["string", "number", "boolean"].includes(typeof v);

  if (arr.every(isScalar)) {
    return arr.slice().sort((a, b) => cmpNumOrStr(a, b));
  }

  // Object array: sort by bestKey, then by JSON string fallback.
  const canon = arr.slice();
  canon.sort((a, b) => {
    const ka = bestKey(a);
    const kb = bestKey(b);

    if (ka && kb) {
      const primary = cmpNumOrStr(a[ka], b[kb]); // note: kb == ka usually; safe
      if (primary !== 0) return primary;

      // Tie-break with second-level keys if present
      const tieKeys = [
        "verb", "rel", "object", "container", "target",
        "argument", "entity", "name"
      ];
      for (const tk of tieKeys) {
        const ha = a && typeof a === "object" ? a[tk] : undefined;
        const hb = b && typeof b === "object" ? b[tk] : undefined;
        if (ha !== undefined || hb !== undefined) {
          const t = cmpNumOrStr(ha, hb);
          if (t !== 0) return t;
        }
      }
    } else if (ka && !kb) {
      return -1;
    } else if (!ka && kb) {
      return 1;
    }

    // Final fallback: stable JSON compare
    const sa = JSON.stringify(a);
    const sb = JSON.stringify(b);
    return cmp(sa, sb);
  });

  return canon;
}

// ---------------------------------------------------------------------------
// Deep canonicalization — remove noise, sort keys, sort arrays
// ---------------------------------------------------------------------------

const DROP_KEYS_GLOBAL = new Set([
  "timestamp",            // non-deterministic
  "exit_code",            // derived
  "state_hash",           // derived in runtime
  "state_hash_canonical", // derived here
  "output_file",          // environment-dependent naming sometimes
  "input_file",
  "errors",               // keep errors if you want; we keep but canonicalize below
]);

function canonicalizeNode(node, ctx = { path: "" }) {
  if (node === null || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    const mapped = node.map((x, i) => canonicalizeNode(x, { path: `${ctx.path}[${i}]` }));
    return sortArrayDeterministically(mapped);
  }

  // Object: filter out non-deterministic keys, sort remaining
  const keys = Object.keys(node)
    .filter((k) => !DROP_KEYS_GLOBAL.has(k))
    .sort();

  const out = {};
  for (const k of keys) {
    out[k] = canonicalizeNode(node[k], { path: ctx.path ? `${ctx.path}.${k}` : k });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Build canonical state with explicit field selection
// ---------------------------------------------------------------------------

function buildCanonicalState(raw) {
  const canonical = {
    runtime: raw.runtime || "NRBPL_RUNTIME_v0_1",
    version: raw.version || "0.1.0",

    // Traceability (stable strings only)
    stream_file: raw.stream_file || null,
    registry_file: raw.registry_file || null,

    // Deterministic semantic core
    context: raw.context || {},
    entities: raw.entities || {},
    timeline: raw.timeline || [],

    // Keep summary if present (not in hash core, but canonicalized)
    summary: raw.summary || {},

    verdict: raw.verdict || "UNKNOWN",
  };

  // Canonicalize recursively (keys + arrays)
  return canonicalizeNode(canonical);
}

function sha256Hex(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

// ----------------------- Main -----------------------
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node NRBPL_CANONICALIZER_v0_1.js <final_state.json> <canonical_state.json>");
  process.exit(2);
}

const inputPath = path.resolve(args[0]);
const outputPath = path.resolve(args[1]);

const raw = readJson(inputPath);
const canonical = buildCanonicalState(raw);

// Hash only semantic core (strict)
const hashPayload = JSON.stringify(
  {
    context: canonical.context || {},
    entities: canonical.entities || {},
    timeline: canonical.timeline || [],
  },
  null,
  0
);

const stateHashCanonical = sha256Hex(hashPayload);
canonical.state_hash_canonical = stateHashCanonical;

// Byte-stable JSON output (sorted keys already, arrays already)
const outText = JSON.stringify(canonical, null, 2) + "\n";
try {
  fs.writeFileSync(outputPath, outText, "utf8");
} catch (e) {
  die(2, `FAIL: cannot write output: ${outputPath} -- ${e.message}`);
}

const report = {
  canonicalizer: "NRBPL_CANONICALIZER_v0.1",
  verdict: "PASS",
  exit_code: 0,
  input_file: path.basename(inputPath),
  output_file: path.basename(outputPath),
  entity_count: canonical.entities ? Object.keys(canonical.entities).length : 0,
  timeline_steps: Array.isArray(canonical.timeline) ? canonical.timeline.length : 0,
  state_hash_canonical: stateHashCanonical,
};

console.log(JSON.stringify(report, null, 2));
process.exit(0);
