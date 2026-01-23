#!/usr/bin/env node
/**
 * validators/lexicon_gate.js — NRBPL Lexicon Gate v1.0.1
 *
 * Goals:
 *   - minimal / no deps
 *   - deterministic
 *   - fail-fast with UGTS exit codes
 *   - --all mode: load 3 files + cross-check consistency
 *   - stdout: audit JSON (machine-readable)
 *
 * Exit codes:
 *   0: SUPPORTED
 *   2: INSUFFICIENT
 *   3: REFUSE
 *
 * Usage:
 *   node validators/lexicon_gate.js --all \
 *     --lemmas lexicon/en_vi_lemmas.jsonl \
 *     --senses lexicon/en_vi_senses.jsonl \
 *     --collocations lexicon/collocations_en.jsonl \
 *     --frames frames/meaning_frames.json
 */

"use strict";

const fs = require("fs");
const path = require("path");

const EXIT_SUPPORTED = 0;
const EXIT_INSUFFICIENT = 2;
const EXIT_REFUSE = 3;

const REASON = {
  FILE_MISSING: "LEX_FILE_MISSING",
  FILE_EMPTY: "LEX_FILE_EMPTY",
  JSON_PARSE_ERROR: "LEX_JSON_PARSE_ERROR",

  DUP_LEMMA_POS: "LEX_DUP_LEMMA_POS",
  MULTIWORD_LEMMA: "LEX_MULTIWORD_LEMMA",
  BAD_LEMMA_SCHEMA: "LEX_BAD_LEMMA_SCHEMA",
  SENSE_COUNT_CLAIM: "LEX_SENSE_COUNT_CLAIM",

  BAD_SENSE_SCHEMA: "LEX_BAD_SENSE_SCHEMA",
  DUP_SENSE_ID: "LEX_DUP_SENSE_ID",
  SENSE_LEMMA_MISSING: "LEX_SENSE_LEMMA_MISSING",

  BAD_COLLOC_SCHEMA: "LEX_BAD_COLLOC_SCHEMA",
  DUP_COLLOC_ID: "LEX_DUP_COLLOC_ID",
  COLLOC_LEMMA_MISSING: "LEX_COLLOC_LEMMA_MISSING",

  UNKNOWN_FRAME: "LEX_UNKNOWN_FRAME"
};

function nowUtcISO() {
  // NOTE: audit may include timestamps; pack canonical must not.
  return new Date().toISOString();
}

function die(audit, verdict, code, reasonCode, detail) {
  audit.verdict = verdict;
  audit.fail_fast = true;
  audit.reasons.push({ code: reasonCode, detail: detail || "" });
  // stdout MUST be machine-readable JSON only
  process.stdout.write(JSON.stringify(audit, null, 2) + "\n");
  process.exit(code);
}

function ok(audit) {
  // stdout MUST be machine-readable JSON only
  process.stdout.write(JSON.stringify(audit, null, 2) + "\n");
  process.exit(EXIT_SUPPORTED);
}

function parseArgs(argv) {
  const args = { all: false, lemmas: null, senses: null, collocations: null, frames: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") args.all = true;
    else if (a === "--lemmas") args.lemmas = argv[++i];
    else if (a === "--senses") args.senses = argv[++i];
    else if (a === "--collocations") args.collocations = argv[++i];
    else if (a === "--frames") args.frames = argv[++i];
  }
  return args;
}

function loadJsonLines(filePath, audit, label) {
  if (!filePath) die(audit, "REFUSE", EXIT_REFUSE, REASON.FILE_MISSING, `missing --${label} argument`);
  if (!fs.existsSync(filePath)) die(audit, "REFUSE", EXIT_REFUSE, REASON.FILE_MISSING, `${label} not found: ${filePath}`);

  const raw = fs.readFileSync(filePath, "utf8");
  const content = raw.trim();
  if (!content) die(audit, "REFUSE", EXIT_REFUSE, REASON.FILE_EMPTY, `${label} empty: ${filePath}`);

  const lines = content.split("\n").filter(l => l.trim());
  const out = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const lineNo = idx + 1;
    try {
      const obj = JSON.parse(lines[idx]);
      out.push({ line: lineNo, obj });
    } catch (e) {
      die(audit, "REFUSE", EXIT_REFUSE, REASON.JSON_PARSE_ERROR, `${label} line ${lineNo}: ${e.message}`);
    }
  }

  // deterministic ordering for downstream checks
  out.sort((a, b) => JSON.stringify(a.obj).localeCompare(JSON.stringify(b.obj)));
  return out;
}

function loadFrameSet(framesPath, audit) {
  if (!framesPath) return null;
  if (!fs.existsSync(framesPath)) {
    // frames missing => do not REFUSE; frames check becomes INSUFFICIENT only if frame fields exist
    audit.notes.push(`frames catalog missing: ${framesPath} (frame existence checks relaxed)`);
    return null;
  }
  try {
    const data = JSON.parse(fs.readFileSync(framesPath, "utf8"));
    if (data && typeof data === "object") {
      // accept either {FRAME_ID: {...}} or {frames:[{id:""}]}
      if (Array.isArray(data.frames)) {
        return new Set(data.frames.map(x => x.id).filter(Boolean));
      }
      return new Set(Object.keys(data));
    }
  } catch (e) {
    die(audit, "REFUSE", EXIT_REFUSE, REASON.JSON_PARSE_ERROR, `frames parse error: ${e.message}`);
  }
  return null;
}

function isMultiwordLemma(s) {
  // inventory lemma MUST be single token base form
  return /\s/.test(s) || /-/.test(s);
}

function validateLemmaSchema(entry, audit) {
  const e = entry.obj;
  if (!e || typeof e !== "object") die(audit, "REFUSE", EXIT_REFUSE, REASON.BAD_LEMMA_SCHEMA, `lemma line ${entry.line}: not an object`);
  if (typeof e.lemma !== "string" || e.lemma.trim().length < 1) die(audit, "REFUSE", EXIT_REFUSE, REASON.BAD_LEMMA_SCHEMA, `lemma line ${entry.line}: missing lemma`);
  if (typeof e.pos !== "string" || e.pos.trim().length < 1) die(audit, "REFUSE", EXIT_REFUSE, REASON.BAD_LEMMA_SCHEMA, `lemma line ${entry.line}: missing pos`);

  // reject sense_count claim (unsupported inference)
  if (Object.prototype.hasOwnProperty.call(e, "sense_count")) {
    die(audit, "REFUSE", EXIT_REFUSE, REASON.SENSE_COUNT_CLAIM, `lemma line ${entry.line}: sense_count prohibited`);
  }

  if (isMultiwordLemma(e.lemma)) {
    die(audit, "REFUSE", EXIT_REFUSE, REASON.MULTIWORD_LEMMA, `lemma line ${entry.line}: multiword lemma '${e.lemma}' prohibited`);
  }

  if (Object.prototype.hasOwnProperty.call(e, "frame") && typeof e.frame !== "string") {
    die(audit, "REFUSE", EXIT_REFUSE, REASON.BAD_LEMMA_SCHEMA, `lemma line ${entry.line}: invalid frame type`);
  }
}

function validateSenseSchema(entry, audit) {
  const e = entry.obj;
  if (!e || typeof e !== "object") die(audit, "REFUSE", EXIT_REFUSE, REASON.BAD_SENSE_SCHEMA, `sense line ${entry.line}: not an object`);
  if (typeof e.sense_id !== "string" || e.sense_id.trim().length < 1) die(audit, "REFUSE", EXIT_REFUSE, REASON.BAD_SENSE_SCHEMA, `sense line ${entry.line}: missing sense_id`);
  if (typeof e.lemma !== "string" || e.lemma.trim().length < 1) die(audit, "REFUSE", EXIT_REFUSE, REASON.BAD_SENSE_SCHEMA, `sense line ${entry.line}: missing lemma`);
  if (typeof e.pos !== "string" || e.pos.trim().length < 1) die(audit, "REFUSE", EXIT_REFUSE, REASON.BAD_SENSE_SCHEMA, `sense line ${entry.line}: missing pos`);
  if (Object.prototype.hasOwnProperty.call(e, "frame") && typeof e.frame !== "string") {
    die(audit, "REFUSE", EXIT_REFUSE, REASON.BAD_SENSE_SCHEMA, `sense line ${entry.line}: invalid frame type`);
  }
}

function validateCollocSchema(entry, audit) {
  const e = entry.obj;
  if (!e || typeof e !== "object") die(audit, "REFUSE", EXIT_REFUSE, REASON.BAD_COLLOC_SCHEMA, `colloc line ${entry.line}: not an object`);
  if (typeof e.collocation_id !== "string" || e.collocation_id.trim().length < 1) die(audit, "REFUSE", EXIT_REFUSE, REASON.BAD_COLLOC_SCHEMA, `colloc line ${entry.line}: missing collocation_id`);
  if (typeof e.lemma !== "string" || e.lemma.trim().length < 1) die(audit, "REFUSE", EXIT_REFUSE, REASON.BAD_COLLOC_SCHEMA, `colloc line ${entry.line}: missing lemma`);
  if (typeof e.pattern !== "string" || e.pattern.trim().length < 1) die(audit, "REFUSE", EXIT_REFUSE, REASON.BAD_COLLOC_SCHEMA, `colloc line ${entry.line}: missing pattern`);
}

function main() {
  const args = parseArgs(process.argv);

  const audit = {
    tool: "validators/lexicon_gate.js",
    version: "1.0.1",
    mode: args.all ? "--all" : "single",
    timestamp_utc: nowUtcISO(),
    verdict: "SUPPORTED",
    fail_fast: false,
    reasons: [],
    notes: [],
    files: {
      lemmas: args.lemmas,
      senses: args.senses,
      collocations: args.collocations,
      frames: args.frames
    },
    stats: {
      lemmas: 0,
      senses: 0,
      collocations: 0,
      dup_lemma_pos: 0,
      dup_sense_id: 0,
      dup_colloc_id: 0,
      unknown_frames: 0,
      sense_lemma_missing: 0,
      colloc_lemma_missing: 0
    }
  };

  if (!args.all) {
    die(audit, "REFUSE", EXIT_REFUSE, REASON.BAD_LEMMA_SCHEMA, "lexicon_gate.js requires --all mode for NRBPL governance L1");
  }

  const frames = loadFrameSet(args.frames, audit);

  // Load
  const lemmaEntries = loadJsonLines(args.lemmas, audit, "lemmas");
  const senseEntries = loadJsonLines(args.senses, audit, "senses");
  const collocEntries = loadJsonLines(args.collocations, audit, "collocations");

  audit.stats.lemmas = lemmaEntries.length;
  audit.stats.senses = senseEntries.length;
  audit.stats.collocations = collocEntries.length;

  // Validate schemas + duplicates
  const seenLemmaPos = new Set();
  const lemmaIndex = new Set(); // lemma|pos keys
  for (const x of lemmaEntries) {
    validateLemmaSchema(x, audit);
    const e = x.obj;
    const key = `${e.lemma}|${e.pos}`;
    if (seenLemmaPos.has(key)) {
      die(audit, "REFUSE", EXIT_REFUSE, REASON.DUP_LEMMA_POS, `duplicate lemma+pos '${key}' at line ${x.line}`);
    }
    seenLemmaPos.add(key);
    lemmaIndex.add(key);

    // frame existence => if frames available, strict REFUSE
    if (frames && e.frame && !frames.has(e.frame)) {
      die(audit, "REFUSE", EXIT_REFUSE, REASON.UNKNOWN_FRAME, `unknown frame '${e.frame}' in lemma '${e.lemma}'`);
    }
    if (!frames && e.frame) {
      // no frames catalog: not refuse, but mark insufficient
      audit.stats.unknown_frames++;
    }
  }

  const seenSenseId = new Set();
  for (const x of senseEntries) {
    validateSenseSchema(x, audit);
    const e = x.obj;

    if (seenSenseId.has(e.sense_id)) {
      die(audit, "REFUSE", EXIT_REFUSE, REASON.DUP_SENSE_ID, `duplicate sense_id '${e.sense_id}' at line ${x.line}`);
    }
    seenSenseId.add(e.sense_id);

    // cross-check lemma existence
    const key = `${e.lemma}|${e.pos}`;
    if (!lemmaIndex.has(key)) {
      audit.stats.sense_lemma_missing++;
      // lemma missing => REFUSE (L1 governance requires closure)
      die(audit, "REFUSE", EXIT_REFUSE, REASON.SENSE_LEMMA_MISSING, `sense '${e.sense_id}' references missing lemma+pos '${key}'`);
    }

    if (frames && e.frame && !frames.has(e.frame)) {
      die(audit, "REFUSE", EXIT_REFUSE, REASON.UNKNOWN_FRAME, `unknown frame '${e.frame}' in sense '${e.sense_id}'`);
    }
    if (!frames && e.frame) audit.stats.unknown_frames++;
  }

  const seenCollocId = new Set();
  for (const x of collocEntries) {
    validateCollocSchema(x, audit);
    const e = x.obj;

    if (seenCollocId.has(e.collocation_id)) {
      die(audit, "REFUSE", EXIT_REFUSE, REASON.DUP_COLLOC_ID, `duplicate collocation_id '${e.collocation_id}' at line ${x.line}`);
    }
    seenCollocId.add(e.collocation_id);

    // colloc lemma should exist in lemma inventory
    // NOTE: collocations may be surface, but lemma must be base lemma
    const keyAnyPos = Array.from(seenLemmaPos).some(k => k.startsWith(`${e.lemma}|`));
    if (!keyAnyPos) {
      audit.stats.colloc_lemma_missing++;
      die(audit, "REFUSE", EXIT_REFUSE, REASON.COLLOC_LEMMA_MISSING, `collocation '${e.collocation_id}' references missing lemma '${e.lemma}'`);
    }
  }

  // If frames catalog missing but frames referenced => INSUFFICIENT (not REFUSE)
  if (!frames && audit.stats.unknown_frames > 0) {
    audit.verdict = "INSUFFICIENT";
    audit.reasons.push({ code: REASON.UNKNOWN_FRAME, detail: "frames catalog missing; cannot verify referenced frames" });
    process.stdout.write(JSON.stringify(audit, null, 2) + "\n");
    process.exit(EXIT_INSUFFICIENT);
  }

  // PASS
  ok(audit);
}

main();
