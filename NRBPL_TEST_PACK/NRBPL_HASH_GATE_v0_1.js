#!/usr/bin/env node
/**
 * NRBPL_HASH_GATE v0.1 — STATE_HASH_GATE
 *
 * Goal:
 *   expected_hash == computed_hash ? PASS : FAIL
 *
 * Ensures runtime output has not drifted between runs or environments.
 * Compares the state_hash_canonical from canonical_state.json against
 * a frozen expected hash (from manifest or CLI argument).
 *
 * Usage:
 *   node NRBPL_HASH_GATE_v0_1.js <canonical_state.json> <expected_hashes.json>
 *   node NRBPL_HASH_GATE_v0_1.js <canonical_state.json> --hash <expected_sha256>
 *
 * Exit codes:
 *   0  PASS (hash matches)
 *   1  FAIL (hash mismatch — runtime drift detected)
 *   2  ERROR (IO/parse/missing field)
 */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function die(code, msg, obj) {
  console.error(msg);
  if (obj) console.error(JSON.stringify(obj, null, 2));
  process.exit(code);
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    die(2, `ERROR: cannot read/parse JSON: ${p} -- ${e.message}`);
  }
}

function sha256File(p) {
  const content = fs.readFileSync(p, "utf8");
  return crypto.createHash("sha256").update(content).digest("hex");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error("Usage:");
  console.error("  node NRBPL_HASH_GATE_v0_1.js <canonical_state.json> <expected_hashes.json>");
  console.error("  node NRBPL_HASH_GATE_v0_1.js <canonical_state.json> --hash <expected_sha256>");
  process.exit(2);
}

const canonicalPath = path.resolve(args[0]);

// Parse mode: manifest file or inline --hash
let expectedStateHash = null;
let expectedFileHash = null;
let manifestFile = null;

if (args[1] === "--hash") {
  if (!args[2]) die(2, "ERROR: --hash requires a SHA-256 value");
  expectedStateHash = args[2].toLowerCase().trim();
} else {
  manifestFile = path.resolve(args[1]);
  const manifest = readJson(manifestFile);

  if (!manifest || typeof manifest !== "object") {
    die(2, "ERROR: manifest must be a JSON object");
  }

  expectedStateHash = (manifest.state_hash_canonical || "").toLowerCase().trim();
  expectedFileHash = (manifest.file_hash_canonical || "").toLowerCase().trim();

  if (!expectedStateHash && !expectedFileHash) {
    die(2, "ERROR: manifest must contain state_hash_canonical or file_hash_canonical", manifest);
  }
}

// Load canonical state
const canonical = readJson(canonicalPath);
const computedStateHash = (canonical.state_hash_canonical || "").toLowerCase().trim();

if (!computedStateHash) {
  die(2, "ERROR: canonical_state.json missing state_hash_canonical field");
}

// Compute file-level hash
const computedFileHash = sha256File(canonicalPath);

// ---------------------------------------------------------------------------
// Gate logic
// ---------------------------------------------------------------------------

const checks = [];
let gatePass = true;

// Check 1: state_hash_canonical match
if (expectedStateHash) {
  const match = computedStateHash === expectedStateHash;
  checks.push({
    check: "state_hash_canonical",
    expected: expectedStateHash,
    computed: computedStateHash,
    match
  });
  if (!match) gatePass = false;
}

// Check 2: file-level SHA-256 match (if manifest provides it)
if (expectedFileHash) {
  const match = computedFileHash === expectedFileHash;
  checks.push({
    check: "file_hash_canonical",
    expected: expectedFileHash,
    computed: computedFileHash,
    match
  });
  if (!match) gatePass = false;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const report = {
  gate: "NRBPL_HASH_GATE_v0.1",
  verdict: gatePass ? "PASS" : "FAIL",
  exit_code: gatePass ? 0 : 1,
  canonical_file: path.basename(canonicalPath),
  manifest_file: manifestFile ? path.basename(manifestFile) : null,
  checks,
  computed_file_hash: computedFileHash
};

if (!gatePass) {
  report.drift_detected = true;
  report.explanation = "Hash mismatch indicates runtime drift between runs or environments. " +
    "Investigate: opcode stream change, registry change, runtime logic change, " +
    "or canonicalizer behavior change.";
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.exit_code);
