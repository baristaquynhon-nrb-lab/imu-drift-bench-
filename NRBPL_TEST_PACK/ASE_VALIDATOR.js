#!/usr/bin/env node
/**
 * ASE_VALIDATOR.js
 * Validate ASE events against ASE_SCHEMA_REGISTRY_v1_0.json
 *
 * Exit codes:
 *   0  PASS
 *   2  FAIL  (IO / JSON parse error)
 *   3  REFUSE (spec/gate violation: unknown schema, missing role, style contamination)
 *
 * Usage:
 *   node ASE_VALIDATOR.js <event_file.json> [registry.json]
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function die(code, msg, obj) {
  if (msg) console.error(msg);
  if (obj) console.error(JSON.stringify(obj, null, 2));
  process.exit(code);
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    die(2, `FAIL: cannot read/parse JSON: ${p}`, { error: e.message });
  }
}

// ---------------------------------------------------------------------------
// Style contamination detector (normative v1.0)
// ---------------------------------------------------------------------------
const STYLE_AMPLIFIERS = ["VERY_", "SO_", "EXTREMELY_", "REALLY_", "SUPER_"];

function hasStyleContamination(value) {
  if (typeof value !== "string") return false;
  const upper = value.toUpperCase();
  return STYLE_AMPLIFIERS.some(amp => upper.includes(amp));
}

// ---------------------------------------------------------------------------
// Validate single event
// ---------------------------------------------------------------------------
function validateEvent(event, registry, index) {
  if (typeof event !== "object" || event === null) {
    return { ok: false, code: 3, index, reason: "EVENT_NOT_OBJECT" };
  }

  // Schema presence
  if (!event.schema || typeof event.schema !== "string") {
    return { ok: false, code: 3, index, reason: "MISSING_SCHEMA" };
  }

  // Schema registration
  const schemaDef = registry.schemas[event.schema];
  if (!schemaDef) {
    return { ok: false, code: 3, index, reason: "UNKNOWN_SCHEMA", schema: event.schema };
  }

  // Required roles
  const requiredRoles = schemaDef.roles || [];
  for (const role of requiredRoles) {
    if (!(role in event)) {
      return { ok: false, code: 3, index, reason: `MISSING_ROLE:${role}`, schema: event.schema };
    }
  }

  // Style contamination check on value fields
  const checkFields = ["state", "attribute", "expression", "action", "speed",
                       "identity", "value", "location", "object"];
  for (const field of checkFields) {
    if (field in event && hasStyleContamination(event[field])) {
      return {
        ok: false, code: 3, index,
        reason: "STYLE_CONTAMINATION",
        field,
        value: event[field]
      };
    }
  }

  return { ok: true, code: 0, index };
}

// ---------------------------------------------------------------------------
// Validate file
// ---------------------------------------------------------------------------
function validateFile(eventsPath, registryPath) {
  const registry = readJson(registryPath);
  if (!registry || !registry.schemas) {
    die(2, "FAIL: invalid registry structure (missing 'schemas')");
  }

  const events = readJson(eventsPath);
  if (!Array.isArray(events)) {
    die(2, "FAIL: events file must contain a JSON array");
  }

  if (events.length === 0) {
    die(3, "REFUSE: empty event array");
  }

  const results = [];
  let hasFailure = false;

  events.forEach((ev, i) => {
    const result = validateEvent(ev, registry, i);
    results.push(result);
    if (!result.ok) {
      hasFailure = true;
      console.error(`Event ${i} REFUSE: ${result.reason}` +
        (result.schema ? ` [${result.schema}]` : "") +
        (result.field ? ` (field: ${result.field})` : ""));
    }
  });

  // Summary
  const summary = {
    validator: "ASE_VALIDATOR_v1.0",
    events_file: path.basename(eventsPath),
    registry_file: path.basename(registryPath),
    event_count: events.length,
    pass_count: results.filter(r => r.ok).length,
    refuse_count: results.filter(r => !r.ok).length,
    verdict: hasFailure ? "REFUSE" : "PASS",
    exit_code: hasFailure ? 3 : 0
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.exit_code);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: node ASE_VALIDATOR.js <event_file.json> [registry.json]");
  process.exit(2);
}

const eventsPath = path.resolve(args[0]);
const registryPath = path.resolve(args[1] || path.join(process.cwd(), "ASE_SCHEMA_REGISTRY_v1_0.json"));

validateFile(eventsPath, registryPath);
