#!/usr/bin/env node
/**
 * NRBPL_RUNTIME v0.1
 *
 * Deterministic, LLM-independent runtime for executing NRBPL opcode streams.
 * Reads a validated stream, builds canonical entity state, writes final_state.json.
 *
 * Usage:
 *   node NRBPL_RUNTIME_v0_1.js <stream.json> <output.json> [registry.json]
 *
 * Exit codes:
 *   0 = OK
 *   1 = Runtime assertion failure
 *   2 = File/parse error
 */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node NRBPL_RUNTIME_v0_1.js <stream.json> <output.json> [registry.json]");
  process.exit(2);
}

const streamPath = path.resolve(args[0]);
const outputPath = path.resolve(args[1]);
const registryPath = args[2] ? path.resolve(args[2]) : null;

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------
let stream;
try {
  stream = JSON.parse(fs.readFileSync(streamPath, "utf-8"));
} catch (e) {
  console.error(`[ERROR] Cannot read/parse stream: ${streamPath}`);
  console.error(e.message);
  process.exit(2);
}

let registry = null;
if (registryPath) {
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  } catch (e) {
    console.error(`[WARN] Cannot load registry, proceeding without: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Opcode parser
// ---------------------------------------------------------------------------
const OPCODE_RE = /^([A-Z][A-Z0-9_]*):([A-Z]+)\(([A-Z0-9_]+)\)(->([A-Z][A-Z0-9_]*))?$/;

function parseOpcode(raw) {
  const m = raw.match(OPCODE_RE);
  if (!m) return null;
  return {
    raw,
    entity: m[1],
    verb: m[2],
    argument: m[3],
    target: m[5] || null
  };
}

// ---------------------------------------------------------------------------
// World State
// ---------------------------------------------------------------------------
class WorldState {
  constructor() {
    this.entities = {};       // name -> { properties, relations, emotions, actions, type }
    this.context = {};        // category -> value
    this.timeline = [];       // ordered execution log
    this.assertions = 0;
  }

  ensureEntity(name) {
    if (!this.entities[name]) {
      this.entities[name] = {
        name,
        type: null,
        properties: [],
        relations: [],
        emotions: [],
        actions: [],
        state: {}
      };
    }
    return this.entities[name];
  }

  setContext(category, value) {
    this.context[category] = value;
    this.assertions++;
    this.timeline.push({ step: this.timeline.length, type: "CTX", category, value });
  }

  // --- Verb handlers ---

  execGIVE(entity, argument, target) {
    const giver = this.ensureEntity(entity);
    const receiver = this.ensureEntity(target);
    const obj = this.ensureEntity(argument);

    giver.actions.push({ verb: "GIVE", object: argument, to: target });
    receiver.relations.push({ rel: "HAS", object: argument, from: entity });
    obj.relations.push({ rel: "OWNED_BY", entity: target });

    this.assertions++;
    this.timeline.push({ step: this.timeline.length, type: "ACTION", entity, verb: "GIVE", argument, target });
  }

  execIN(entity, container) {
    const obj = this.ensureEntity(entity);
    const cont = this.ensureEntity(container);

    obj.state.location = container;
    obj.relations.push({ rel: "INSIDE", container });
    cont.relations.push({ rel: "CONTAINS", object: entity });

    this.assertions++;
    this.timeline.push({ step: this.timeline.length, type: "RELATION", entity, verb: "IN", argument: container });
  }

  execOPEN(agent, object) {
    const a = this.ensureEntity(agent);
    const o = this.ensureEntity(object);

    a.actions.push({ verb: "OPEN", object });
    o.state.opened = true;

    // Reveal contents: anything IN this object becomes accessible
    for (const [name, ent] of Object.entries(this.entities)) {
      if (ent.state.location === object) {
        ent.state.accessible = true;
      }
    }

    this.assertions++;
    this.timeline.push({ step: this.timeline.length, type: "ACTION", entity: agent, verb: "OPEN", argument: object });
  }

  execSEE(agent, object) {
    const a = this.ensureEntity(agent);
    this.ensureEntity(object);

    a.actions.push({ verb: "SEE", object });
    a.state.lastSeen = object;

    this.assertions++;
    this.timeline.push({ step: this.timeline.length, type: "PERCEPTION", entity: agent, verb: "SEE", argument: object });
  }

  execIS(entity, type) {
    const e = this.ensureEntity(entity);
    e.type = type;

    this.assertions++;
    this.timeline.push({ step: this.timeline.length, type: "IDENTITY", entity, verb: "IS", argument: type });
  }

  execHAS(entity, attribute) {
    const e = this.ensureEntity(entity);
    e.properties.push(attribute);

    this.assertions++;
    this.timeline.push({ step: this.timeline.length, type: "PROPERTY", entity, verb: "HAS", argument: attribute });
  }

  execMOVE(entity, manner) {
    const e = this.ensureEntity(entity);
    e.actions.push({ verb: "MOVE", manner });
    e.state.moving = true;
    e.state.moveManner = manner;

    this.assertions++;
    this.timeline.push({ step: this.timeline.length, type: "MOTION", entity, verb: "MOVE", argument: manner });
  }

  execFEEL(agent, emotion) {
    const a = this.ensureEntity(agent);
    a.emotions.push(emotion);
    a.state.currentEmotion = emotion;

    this.assertions++;
    this.timeline.push({ step: this.timeline.length, type: "EMOTION", entity: agent, verb: "FEEL", argument: emotion });
  }

  execHUG(agent, target) {
    const a = this.ensureEntity(agent);
    this.ensureEntity(target);

    a.actions.push({ verb: "HUG", target });

    this.assertions++;
    this.timeline.push({ step: this.timeline.length, type: "SOCIAL", entity: agent, verb: "HUG", argument: target });
  }

  execFACE(entity, expression) {
    const e = this.ensureEntity(entity);
    e.state.faceExpression = expression;
    e.actions.push({ verb: "FACE", expression });

    this.assertions++;
    this.timeline.push({ step: this.timeline.length, type: "EXPRESSION", entity, verb: "FACE", argument: expression });
  }
}

// ---------------------------------------------------------------------------
// Verb dispatch table
// ---------------------------------------------------------------------------
const VERB_DISPATCH = {
  GIVE:     (ws, op) => ws.execGIVE(op.entity, op.argument, op.target),
  IN:       (ws, op) => ws.execIN(op.entity, op.argument),
  OPEN:     (ws, op) => ws.execOPEN(op.entity, op.argument),
  SEE:      (ws, op) => ws.execSEE(op.entity, op.argument),
  IS:       (ws, op) => ws.execIS(op.entity, op.argument),
  HAS:      (ws, op) => ws.execHAS(op.entity, op.argument),
  MOVE:     (ws, op) => ws.execMOVE(op.entity, op.argument),
  FEEL:     (ws, op) => ws.execFEEL(op.entity, op.argument),
  HUG:      (ws, op) => ws.execHUG(op.entity, op.argument),
  FACE:     (ws, op) => ws.execFACE(op.entity, op.argument),
};

// ---------------------------------------------------------------------------
// Execute stream
// ---------------------------------------------------------------------------
const world = new WorldState();
const opcodes = stream.opcodes || [];
const runtimeErrors = [];

opcodes.forEach((raw, idx) => {
  const op = parseOpcode(raw);
  if (!op) {
    runtimeErrors.push({ index: idx, opcode: raw, reason: "Parse failure" });
    return;
  }

  // CTX opcodes are special
  if (op.entity === "CTX") {
    world.setContext(op.verb, op.argument);
    return;
  }

  const handler = VERB_DISPATCH[op.verb];
  if (!handler) {
    runtimeErrors.push({ index: idx, opcode: raw, reason: `No handler for verb: ${op.verb}` });
    return;
  }

  try {
    handler(world, op);
  } catch (e) {
    runtimeErrors.push({ index: idx, opcode: raw, reason: e.message });
  }
});

// ---------------------------------------------------------------------------
// Build canonical output
// ---------------------------------------------------------------------------
const entityNames = Object.keys(world.entities).sort();

const canonicalState = {
  runtime: "NRBPL_RUNTIME_v0_1",
  version: "0.1.0",
  timestamp: new Date().toISOString(),
  stream_file: path.basename(streamPath),
  registry_file: registryPath ? path.basename(registryPath) : null,

  summary: {
    opcode_count: opcodes.length,
    entity_count: entityNames.length,
    assertion_count: world.assertions,
    error_count: runtimeErrors.length,
    context_keys: Object.keys(world.context).sort()
  },

  context: world.context,
  entities: world.entities,
  timeline: world.timeline,

  errors: runtimeErrors,

  verdict: runtimeErrors.length === 0 ? "PASS" : "FAIL",
  exit_code: runtimeErrors.length === 0 ? 0 : 1
};

// Compute SHA-256 of deterministic payload (entities + context + timeline)
const hashPayload = JSON.stringify({
  context: world.context,
  entities: world.entities,
  timeline: world.timeline
}, null, 0);
canonicalState.state_hash = crypto.createHash("sha256").update(hashPayload).digest("hex");

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
try {
  fs.writeFileSync(outputPath, JSON.stringify(canonicalState, null, 2), "utf-8");
} catch (e) {
  console.error(`[ERROR] Cannot write output: ${outputPath}`);
  console.error(e.message);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Console summary
// ---------------------------------------------------------------------------
const report = {
  verdict: canonicalState.verdict,
  exit_code: canonicalState.exit_code,
  runtime: canonicalState.runtime,
  opcode_count: canonicalState.summary.opcode_count,
  entity_count: canonicalState.summary.entity_count,
  assertion_count: canonicalState.summary.assertion_count,
  state_hash: canonicalState.state_hash,
  output_file: path.basename(outputPath)
};

console.log(JSON.stringify(report, null, 2));

if (runtimeErrors.length > 0) {
  console.error(`\n[RUNTIME ERRORS]`);
  runtimeErrors.forEach(e => console.error(`  [${e.index}] ${e.opcode}: ${e.reason}`));
}

process.exit(runtimeErrors.length === 0 ? 0 : 1);
