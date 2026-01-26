#!/usr/bin/env node
/**
 * NRBPL_STREAM_VALIDATOR v0.1
 *
 * Validate NRBPL opcode stream against the frozen opcode registry.
 * UGTS-style exit codes: 0=PASS, 2=FAIL (IO/format), 3=REFUSE (spec violation).
 *
 * Usage:
 *   node NRBPL_STREAM_VALIDATOR.js <stream.json> [registry.json]
 *
 * Exit codes:
 *   0  PASS
 *   2  FAIL  (IO / JSON parse / format error)
 *   3  REFUSE (registry mismatch / semantic violation)
 */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

// ---------------------------------------------------------------------------
// Opcode parser
// ---------------------------------------------------------------------------

function parseOpcode(line) {
  if (typeof line !== "string") return null;

  // CTX:TEMPORAL(CHRISTMAS)
  const ctxMatch = line.match(/^CTX:([A-Z_]+)\(([A-Z0-9_]+)\)$/);
  if (ctxMatch) {
    return { opcode: "CTX:" + ctxMatch[1], args: [ctxMatch[2]], target: null };
  }

  // DAD:GIVE(TOY)->TIM  or  DAD:SAY(ADVISE)->TIM  or  AGENT:STATE(OLD)->NEW
  const arrowMatch = line.match(/^([A-Z][A-Z0-9_]*):([A-Z_]+)\(([^)]*)\)->([A-Z][A-Z0-9_]*)$/);
  if (arrowMatch) {
    return {
      subject: arrowMatch[1],
      opcode: arrowMatch[2],
      args: arrowMatch[3] ? arrowMatch[3].split(",").map(s => s.trim()) : [],
      target: arrowMatch[4]
    };
  }

  // TIM:OPEN(BOX)  or  CAR:MOVE(FAST)
  const normalMatch = line.match(/^([A-Z][A-Z0-9_]*):([A-Z_]+)\(([^)]*)\)$/);
  if (normalMatch) {
    return {
      subject: normalMatch[1],
      opcode: normalMatch[2],
      args: normalMatch[3] ? normalMatch[3].split(",").map(s => s.trim()) : [],
      target: null
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Validation engine
// ---------------------------------------------------------------------------

function validateStream(stream, registry) {
  if (!stream || !Array.isArray(stream.opcodes)) {
    die(3, "REFUSE: stream missing 'opcodes' array");
  }

  const opcodes = stream.opcodes;

  if (opcodes.length === 0) {
    die(3, "REFUSE: empty opcode stream");
  }

  const maxLen = (registry.validation_rules && registry.validation_rules.max_stream_length) || 10000;
  if (opcodes.length > maxLen) {
    die(3, `REFUSE: stream length ${opcodes.length} exceeds max ${maxLen}`);
  }

  const errors = [];

  opcodes.forEach((line, i) => {
    if (typeof line !== "string") {
      errors.push({ index: i, line, reason: "NOT_A_STRING" });
      return;
    }

    const parsed = parseOpcode(line);
    if (!parsed) {
      errors.push({ index: i, line, reason: "INVALID_SYNTAX" });
      return;
    }

    // Look up opcode in registry
    const entry = registry.opcode_set[parsed.opcode];
    if (!entry) {
      errors.push({ index: i, line, reason: `UNKNOWN_OPCODE: ${parsed.opcode}` });
      return;
    }

    // Argument count check: target counts as an additional arg for multi-arg opcodes
    const totalArgs = parsed.args.length + (parsed.target ? 1 : 0);
    if (entry.args.length !== totalArgs) {
      errors.push({
        index: i, line,
        reason: `ARG_COUNT_MISMATCH: expected ${entry.args.length}, got ${totalArgs}`
      });
      return;
    }

    // Entity/argument length checks
    const maxNameLen = (registry.syntax_rules && registry.syntax_rules.max_entity_name_length) || 32;
    const maxArgLen = (registry.syntax_rules && registry.syntax_rules.max_argument_length) || 32;

    if (parsed.subject && parsed.subject.length > maxNameLen) {
      errors.push({ index: i, line, reason: `ENTITY_TOO_LONG: ${parsed.subject.length}` });
    }
    for (const arg of parsed.args) {
      if (arg.length > maxArgLen) {
        errors.push({ index: i, line, reason: `ARG_TOO_LONG: ${arg.length}` });
      }
    }
  });

  return errors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    console.error("Usage: node NRBPL_STREAM_VALIDATOR.js <stream.json> [registry.json]");
    process.exit(2);
  }

  const streamFile = path.resolve(argv[0]);
  const regFile = path.resolve(argv[1] || path.join(process.cwd(), "NRBPL_OPCODE_REGISTRY_v0_1.json"));

  const stream = readJson(streamFile);
  const registry = readJson(regFile);

  if (!registry || !registry.opcode_set) {
    die(2, "FAIL: invalid registry structure (missing 'opcode_set')");
  }

  const errors = validateStream(stream, registry);
  const opcodes = stream.opcodes || [];
  const digest = sha256(JSON.stringify(opcodes));

  const hasErrors = errors.length > 0;

  // Print errors
  if (hasErrors) {
    errors.forEach(e => {
      console.error(`REFUSE: [${e.index}] ${e.line} -- ${e.reason}`);
    });
  }

  // Summary
  const result = {
    validator: "NRBPL_STREAM_VALIDATOR_v0.1",
    stream_file: path.basename(streamFile),
    registry_file: path.basename(regFile),
    opcode_count: opcodes.length,
    error_count: errors.length,
    verdict: hasErrors ? "REFUSE" : "PASS",
    exit_code: hasErrors ? 3 : 0,
    sha256: digest
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.exit_code);
}

main();
