#!/usr/bin/env node
/**
 * NRBPL_STREAM_VALIDATOR v0.1
 *
 * Validates an opcode stream against the NRBPL Opcode Registry.
 * Checks: syntax, verb registration, target requirements, stream constraints.
 *
 * Usage:
 *   node NRBPL_STREAM_VALIDATOR.js <stream.json> <registry.json>
 *
 * Exit codes:
 *   0 = PASS (all opcodes valid)
 *   1 = FAIL (validation errors found)
 *   2 = ERROR (file/parse error)
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node NRBPL_STREAM_VALIDATOR.js <stream.json> <registry.json>");
  process.exit(2);
}

const streamPath = path.resolve(args[0]);
const registryPath = path.resolve(args[1]);

// ---------------------------------------------------------------------------
// Load files
// ---------------------------------------------------------------------------
let stream, registry;
try {
  stream = JSON.parse(fs.readFileSync(streamPath, "utf-8"));
} catch (e) {
  console.error(`[ERROR] Cannot read/parse stream file: ${streamPath}`);
  console.error(e.message);
  process.exit(2);
}

try {
  registry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
} catch (e) {
  console.error(`[ERROR] Cannot read/parse registry file: ${registryPath}`);
  console.error(e.message);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Validation engine
// ---------------------------------------------------------------------------
const OPCODE_RE = /^([A-Z][A-Z0-9_]*):([A-Z]+)\(([A-Z0-9_]+)\)(->([A-Z][A-Z0-9_]*))?$/;

const registeredVerbs = new Set(Object.keys(registry.opcode_patterns));
const targetRequiredVerbs = new Set(registry.validation_rules.target_required_for || []);

const errors = [];
const warnings = [];

function validate(opcodes) {
  if (!Array.isArray(opcodes) || opcodes.length === 0) {
    errors.push({ index: -1, opcode: null, reason: "Stream is empty or not an array" });
    return;
  }

  if (opcodes.length > (registry.validation_rules.max_stream_length || 10000)) {
    errors.push({
      index: -1,
      opcode: null,
      reason: `Stream length ${opcodes.length} exceeds max ${registry.validation_rules.max_stream_length}`
    });
    return;
  }

  opcodes.forEach((op, idx) => {
    // 1. Type check
    if (typeof op !== "string") {
      errors.push({ index: idx, opcode: op, reason: "Opcode is not a string" });
      return;
    }

    // 2. Syntax match
    const m = op.match(OPCODE_RE);
    if (!m) {
      errors.push({ index: idx, opcode: op, reason: "Syntax mismatch against opcode_regex" });
      return;
    }

    const [, entity, verb, argument, , target] = m;

    // 3. Verb registration
    if (!registeredVerbs.has(verb)) {
      // CTX uses the category as verb position — special handling
      if (entity === "CTX") {
        // CTX verbs are the categories: TEMPORAL, SPATIAL, etc.
        const ctxDef = registry.opcode_patterns["CTX"];
        if (ctxDef && ctxDef.categories && !ctxDef.categories.includes(verb)) {
          errors.push({ index: idx, opcode: op, reason: `Unknown CTX category: ${verb}` });
        }
        // CTX categories are valid even if not top-level verbs
      } else {
        errors.push({ index: idx, opcode: op, reason: `Unregistered verb: ${verb}` });
      }
    }

    // 4. Target requirement
    if (targetRequiredVerbs.has(verb) && !target) {
      errors.push({ index: idx, opcode: op, reason: `Verb '${verb}' requires a target (->TARGET)` });
    }

    // 5. Target present but verb doesn't need one (warning, not error)
    if (target && !targetRequiredVerbs.has(verb) && verb !== "GIVE") {
      warnings.push({ index: idx, opcode: op, reason: `Verb '${verb}' has target but none expected` });
    }

    // 6. Entity/argument length
    if (entity.length > (registry.syntax_rules.max_entity_name_length || 32)) {
      errors.push({ index: idx, opcode: op, reason: `Entity name too long: ${entity.length}` });
    }
    if (argument.length > (registry.syntax_rules.max_argument_length || 32)) {
      errors.push({ index: idx, opcode: op, reason: `Argument too long: ${argument.length}` });
    }
  });
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const opcodes = stream.opcodes || [];
validate(opcodes);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const result = {
  validator: "NRBPL_STREAM_VALIDATOR_v0.1",
  stream_file: path.basename(streamPath),
  registry_file: path.basename(registryPath),
  opcode_count: opcodes.length,
  error_count: errors.length,
  warning_count: warnings.length,
  verdict: errors.length === 0 ? "PASS" : "FAIL",
  errors,
  warnings
};

console.log(JSON.stringify(result, null, 2));
process.exit(errors.length === 0 ? 0 : 1);
