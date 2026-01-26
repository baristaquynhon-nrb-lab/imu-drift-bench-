#!/usr/bin/env node
/**
 * ASE_EVENT_COMPILER.js
 * Compile ASE events -> NRBPL opcode stream (canonical)
 *
 * Exit codes:
 *   0  PASS
 *   2  FAIL  (IO / JSON parse / unexpected runtime error)
 *   3  REFUSE (spec/gate violation: unknown schema, missing role, invalid value)
 *
 * Usage:
 *   node ASE_EVENT_COMPILER.js <ase_events.json> <out_stream.json> [registry.json]
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
    die(2, `FAIL: cannot read/parse JSON: ${p}`, { error: String(e) });
  }
}

function isNonEmptyString(x) {
  return typeof x === "string" && x.trim().length > 0;
}

/**
 * Canonical atom normalization.
 * Uppercase, ASCII-only, snake_case for deterministic opcode tokens.
 */
function normalizeAtom(x) {
  if (!isNonEmptyString(x)) return "";
  return x
    .trim()
    .toUpperCase()
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

// Short alias
function S(x) { return normalizeAtom(x); }

// ---------------------------------------------------------------------------
// Style contamination detector
// ---------------------------------------------------------------------------
const STYLE_AMPLIFIERS = ["VERY_", "SO_", "EXTREMELY_", "REALLY_", "SUPER_"];

function hasStyleContamination(value) {
  if (typeof value !== "string") return false;
  const n = normalizeAtom(value);
  return STYLE_AMPLIFIERS.some(amp => n.includes(amp));
}

// ---------------------------------------------------------------------------
// Validation (gate)
// ---------------------------------------------------------------------------

function requireRole(ev, role) {
  if (!(role in ev)) {
    die(3, `REFUSE: missing role '${role}'`, { event: ev });
  }
}

function validateAgainstRegistry(ev, registry) {
  if (!isNonEmptyString(ev.schema)) {
    die(3, "REFUSE: missing schema", { event: ev });
  }

  const entry = registry.schemas[ev.schema];
  if (!entry) {
    die(3, `REFUSE: unknown schema '${ev.schema}'`, { event: ev });
  }

  // Required roles
  const roles = entry.roles || [];
  for (const r of roles) requireRole(ev, r);

  // Atom sanity: REFUSE if any role value normalizes to empty
  for (const k of Object.keys(ev)) {
    if (k === "event_id" || k === "schema") continue;
    const v = ev[k];
    if (typeof v === "string") {
      const n = normalizeAtom(v);
      if (!n) die(3, `REFUSE: invalid/empty atom for '${k}'`, { event: ev });
    }
  }

  // Style contamination gate
  const checkFields = ["state", "attribute", "expression", "action", "speed",
                       "identity", "value"];
  for (const k of checkFields) {
    if (k in ev && hasStyleContamination(ev[k])) {
      die(3, "REFUSE: style contamination detected", {
        event: ev,
        field: k,
        normalized: normalizeAtom(ev[k])
      });
    }
  }
}

// ---------------------------------------------------------------------------
// ASE Schema -> NRBPL Opcode mapping (deterministic, v1.0)
// ---------------------------------------------------------------------------

function opcodeFromEvent(ev) {
  const schema = ev.schema;

  switch (schema) {
    case "TEMPORAL_CONTEXT":
      return `CTX:TEMPORAL(${S(ev.value)})`;

    case "MOVE_TO_LOCATION":
      return `${S(ev.agent)}:MOVE_TO(${S(ev.location)})`;

    case "MOVE_STATE":
      return `${S(ev.agent)}:MOVE_STATE(${S(ev.state)})`;

    case "PERCEPTION_VISUAL":
      return `${S(ev.agent)}:SEE(${S(ev.object)})`;

    case "PERCEPTION_AUDITORY":
      return `${S(ev.agent)}:HEAR(${S(ev.object)})`;

    case "OBJECT_LOCATION":
      return `${S(ev.object)}:IN(${S(ev.location)})`;

    case "CONTAINER_OPEN":
      return `${S(ev.agent)}:OPEN(${S(ev.object)})`;

    case "OBJECT_IDENTIFICATION":
      return `${S(ev.object)}:IS(${S(ev.identity)})`;

    case "PHYSICAL_ATTRIBUTE":
      return `${S(ev.object)}:HAS(${S(ev.attribute)})`;

    case "OBJECT_ACTION":
      return `${S(ev.agent)}:DO(${S(ev.action)})`;

    case "OBJECT_MOTION":
      return `${S(ev.agent)}:MOVE(${S(ev.speed)})`;

    case "GIFT_GIVING":
      return `${S(ev.agent)}:GIVE(${S(ev.object)})->${S(ev.recipient)}`;

    case "CONSUMPTION":
      return `${S(ev.agent)}:EAT(${S(ev.object)})`;

    case "EMOTIONAL_STATE":
      return `${S(ev.agent)}:FEEL(${S(ev.state)})`;

    case "AFFECTION_ACTION":
      return `${S(ev.agent)}:${S(ev.action)}(${S(ev.target)})`;

    case "SPEECH_ACT_ADMONISH":
      return `${S(ev.agent)}:SAY(ADMONISH)->${S(ev.target)}`;

    case "SPEECH_ACT_ADVISE":
      return `${S(ev.agent)}:SAY(ADVISE)->${S(ev.target)}`;

    case "SPEECH_ACT_CHALLENGE":
      return `${S(ev.agent)}:SAY(CHALLENGE)->${S(ev.target)}`;

    case "FACIAL_EXPRESSION":
      return `${S(ev.agent)}:FACE(${S(ev.expression)})`;

    case "LOSS_EVENT":
      return `${S(ev.agent)}:LOSE(${S(ev.object)})`;

    case "STATE_TRANSITION":
      return `${S(ev.agent)}:STATE(${S(ev.from_state)})->${S(ev.to_state)}`;

    default:
      die(2, `FAIL: compiler missing mapping for schema '${schema}'`, { event: ev });
  }
}

// ---------------------------------------------------------------------------
// Compile
// ---------------------------------------------------------------------------

function compile(events, registry, meta) {
  if (!Array.isArray(events)) {
    die(2, "FAIL: input events must be a JSON array");
  }

  if (events.length === 0) {
    die(3, "REFUSE: empty event array");
  }

  const opcodes = [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (typeof ev !== "object" || ev === null) {
      die(3, "REFUSE: event must be an object", { index: i, event: ev });
    }

    validateAgainstRegistry(ev, registry);

    const opcode = opcodeFromEvent(ev);
    if (!isNonEmptyString(opcode)) {
      die(2, "FAIL: empty opcode (unexpected)", { event: ev });
    }

    opcodes.push(opcode);
  }

  return {
    spec: "NRBPL_OPCODE_STREAM_v0_1",
    source: {
      type: "ASE_EVENT_GRAPH",
      ase_spec: "ASE_SPEC_v1_0",
      registry: "ASE_SCHEMA_REGISTRY_v1_0"
    },
    meta: meta || {},
    opcodes
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    console.error("Usage: node ASE_EVENT_COMPILER.js <ase_events.json> <out_stream.json> [registry.json]");
    console.error("Default registry: ./ASE_SCHEMA_REGISTRY_v1_0.json");
    process.exit(2);
  }

  const inFile = path.resolve(argv[0]);
  const outFile = path.resolve(argv[1]);
  const regFile = path.resolve(argv[2] || path.join(process.cwd(), "ASE_SCHEMA_REGISTRY_v1_0.json"));

  const registry = readJson(regFile);
  if (!registry || !registry.schemas) {
    die(2, "FAIL: invalid registry structure", { regFile });
  }

  const events = readJson(inFile);

  const meta = {
    input_file: path.basename(inFile),
    event_count: Array.isArray(events) ? events.length : null
  };

  const stream = compile(events, registry, meta);

  try {
    fs.writeFileSync(outFile, JSON.stringify(stream, null, 2) + "\n", "utf8");
  } catch (e) {
    die(2, `FAIL: cannot write output: ${outFile}`, { error: String(e) });
  }

  // Summary
  const summary = {
    compiler: "ASE_EVENT_COMPILER_v1.0",
    verdict: "PASS",
    exit_code: 0,
    input_file: path.basename(inFile),
    output_file: path.basename(outFile),
    event_count: events.length,
    opcode_count: stream.opcodes.length
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

main();
