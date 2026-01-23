#!/usr/bin/env node
/**
 * validators/lexicon_gate.js — NTL/NRBPL Lexicon Gate v1.1.0
 *
 * Deterministic, evidence-first, fail-fast by default.
 * Emits a deterministic JSON Gate Report to STDOUT.
 *
 * Scope (v0.1):
 * - Lemma inventory: lexicon/en_vi_lemmas*.jsonl
 * - Optional senses: lexicon/en_vi_senses*.jsonl
 * - Optional collocations: lexicon/collocations_en*.jsonl
 * - Optional frames catalog: frames/meaning_frames.json
 *
 * Hard rules:
 * - lemma: lowercase [a-z]+ only; MUST NOT contain spaces or '-'
 * - pos: enum {n,v,adj,adv,prep,conj,det,pron,num,interj}
 * - vi_gloss: MUST exist; 1–4 tokens; MUST NOT contain inference markers or multi-gloss separators
 * - frame: MUST be "" (scope-lock v0.1)
 * - sorted: file MUST be sorted by (lemma asc, pos asc) for lemmas; (lemma,pos,sense_id) for senses
 * - duplicates disallowed
 *
 * Sense rules (if senses file provided):
 * - sense_id: `${lemma}.${pos}.${NN}` where NN is 2-digit "01".."99"
 * - Each sense MUST have trace: {source, source_file_sha256, record_sha256, ref}
 * - No sense-selection without trace (if vi_gloss multiword in sense, trace MUST exist; in this gate: trace is mandatory anyway)
 *
 * Output:
 * - JSON report includes:
 *   artifact_hashes.set_sha256  (hash of artifact set)
 *   report_hashes.canonical_sha256 (hash of canonical report with canonical_sha256="")
 * - Sidecar report bytes hash is REQUIRED by schema but is emitted by caller tooling (repo_audit / dc pack),
 *   or you can use: `node ... > report.json && sha256sum report.json > report.json.sha256`
 *
 * Exit codes:
 *   0: SUPPORTED
 *   2: INSUFFICIENT / CONTRADICTORY
 *   3: REFUSE (hard fail: schema/policy/integrity)
 */

"use strict";

const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const TOOL = "validators/lexicon_gate.js";
const VERSION = "1.1.0";

const EXIT_OK = 0;
const EXIT_SOFT = 2;
const EXIT_REFUSE = 3;

const POS_SET = new Set(["n", "v", "adj", "adv", "prep", "conj", "det", "pron", "num", "interj"]);

const REASON = {
  FILE_NOT_FOUND: "LEX_FILE_NOT_FOUND",
  EMPTY_FILE: "LEX_EMPTY_FILE",
  JSON_PARSE: "LEX_JSON_PARSE_ERROR",
  SCHEMA: "LEX_SCHEMA_VIOLATION",
  DUP_LEMMA_POS: "LEX_DUPLICATE_LEMMA_POS",
  DUP_SENSE_ID: "LEX_DUPLICATE_SENSE_ID",
  DUP_COLLOC_ID: "LEX_DUPLICATE_COLLOC_ID",
  UNSORTED: "LEX_NOT_SORTED",
  BAD_LEMMA: "LEX_BAD_LEMMA",
  BAD_POS: "LEX_BAD_POS",
  BAD_VI_GLOSS: "LEX_BAD_VI_GLOSS",
  INFERENCE_MARKER: "LEX_INFERENCE_MARKER",
  MULTIGLOSS: "LEX_MULTIGLOSS",
  FRAME_SCOPE_LOCK: "LEX_FRAME_SCOPE_LOCK_VIOLATION",
  FRAME_UNKNOWN: "LEX_UNKNOWN_FRAME",
  SENSE_TRACE_MISSING: "LEX_SENSE_TRACE_MISSING",
  SENSE_LEMMA_MISSING: "LEX_SENSE_LEMMA_MISSING",
  COLLOC_LEMMA_MISSING: "LEX_COLLOC_LEMMA_MISSING"
};

function sha256Hex(bufOrStr) {
  return crypto.createHash("sha256").update(bufOrStr).digest("hex");
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw hard(`${filePath}: not found`, REASON.FILE_NOT_FOUND, filePath, 1);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const trimmed = raw.trim();
  if (!trimmed) {
    throw hard(`${filePath}: empty`, REASON.EMPTY_FILE, filePath, 1);
  }
  return raw;
}

function loadJsonLines(filePath) {
  const raw = readText(filePath);
  const lines = raw.split("\n").filter(l => l.trim().length > 0);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    try {
      const obj = JSON.parse(lines[i]);
      out.push({ file: filePath, line: lineNo, obj });
    } catch (e) {
      throw hard(`JSON parse error at ${filePath}:${lineNo}: ${e.message}`, REASON.JSON_PARSE, filePath, lineNo);
    }
  }
  return out;
}

// Canonical JSON: sort keys recursively, JSON.stringify with no spacing.
function canonicalize(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const keys = Object.keys(value).sort();
  const obj = {};
  for (const k of keys) obj[k] = canonicalize(value[k]);
  return obj;
}

function hard(message, code, file, line) {
  const err = new Error(message);
  err._gate = { severity: "REFUSE", code, file, line };
  return err;
}

function softReason(reasons, code, message, file, line) {
  reasons.push({ code, message, file, line });
}

function isLowerAlpha(lemma) {
  return /^[a-z]+$/.test(lemma);
}

// Inference markers / multi-gloss separators (normative deny-list for v0.1)
function hasInferenceMarkers(s) {
  // Minimal deny markers: "maybe", "probably", "approx", "??", "tbd", "unknown", "~"
  return /(\?\?|\btbd\b|\bunknown\b|\bmaybe\b|\bprobably\b|\bapprox\b|~)/i.test(s);
}

function hasMultiGlossSeparators(s) {
  // deny separators often used to pack multiple senses/glosses
  return /[;|\/\\]/.test(s) || /\s,\s/.test(s) || /\s-\s/.test(s);
}

function tokenCount(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function validateLemmaEntry(row, reasons) {
  const { file, line, obj } = row;
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    softReason(reasons, REASON.SCHEMA, "Entry must be an object", file, line);
    return;
  }
  const req = ["lemma", "pos", "vi_gloss", "frame"];
  for (const f of req) {
    if (!(f in obj)) {
      softReason(reasons, REASON.SCHEMA, `Missing required field '${f}'`, file, line);
      return;
    }
  }

  if (typeof obj.lemma !== "string" || obj.lemma.length < 1) {
    softReason(reasons, REASON.SCHEMA, "lemma must be non-empty string", file, line);
    return;
  }
  if (!isLowerAlpha(obj.lemma)) {
    softReason(reasons, REASON.BAD_LEMMA, "lemma must be lowercase [a-z]+ only (no mutation allowed)", file, line);
    return;
  }

  if (typeof obj.pos !== "string" || !POS_SET.has(obj.pos)) {
    softReason(reasons, REASON.BAD_POS, `pos must be one of: ${Array.from(POS_SET).join(",")}`, file, line);
    return;
  }

  if (typeof obj.vi_gloss !== "string" || obj.vi_gloss.trim().length < 1) {
    softReason(reasons, REASON.BAD_VI_GLOSS, "vi_gloss is required (evidence-first); empty is forbidden", file, line);
    return;
  }
  const gloss = obj.vi_gloss.trim();
  if (hasInferenceMarkers(gloss)) softReason(reasons, REASON.INFERENCE_MARKER, "vi_gloss contains inference marker(s)", file, line);
  if (hasMultiGlossSeparators(gloss)) softReason(reasons, REASON.MULTIGLOSS, "vi_gloss contains multi-gloss separator(s)", file, line);
  const tc = tokenCount(gloss);
  if (tc < 1 || tc > 4) softReason(reasons, REASON.BAD_VI_GLOSS, "vi_gloss must be 1–4 tokens (v0.1 constraint)", file, line);

  if (typeof obj.frame !== "string") {
    softReason(reasons, REASON.SCHEMA, "frame must be string", file, line);
    return;
  }
  if (obj.frame !== "") {
    softReason(reasons, REASON.FRAME_SCOPE_LOCK, "frame MUST be empty string in v0.1 (scope-lock)", file, line);
  }
}

function validateSenseEntry(row, reasons) {
  const { file, line, obj } = row;
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    softReason(reasons, REASON.SCHEMA, "Sense entry must be an object", file, line);
    return;
  }
  const req = ["sense_id", "lemma", "pos", "vi_gloss", "en_gloss", "frame", "trace"];
  for (const f of req) {
    if (!(f in obj)) {
      softReason(reasons, REASON.SCHEMA, `Missing required field '${f}'`, file, line);
      return;
    }
  }
  if (typeof obj.lemma !== "string" || !isLowerAlpha(obj.lemma)) {
    softReason(reasons, REASON.BAD_LEMMA, "sense.lemma must be lowercase [a-z]+", file, line);
    return;
  }
  if (typeof obj.pos !== "string" || !POS_SET.has(obj.pos)) {
    softReason(reasons, REASON.BAD_POS, "sense.pos invalid", file, line);
    return;
  }

  // sense_id canonical: lemma.pos.NN
  if (typeof obj.sense_id !== "string") {
    softReason(reasons, REASON.SCHEMA, "sense_id must be string", file, line);
    return;
  }
  const expectPrefix = `${obj.lemma}.${obj.pos}.`;
  if (!obj.sense_id.startsWith(expectPrefix) || !/^\d{2}$/.test(obj.sense_id.slice(expectPrefix.length))) {
    softReason(reasons, REASON.SCHEMA, "sense_id must be `${lemma}.${pos}.${NN}` where NN is 2-digit", file, line);
  }

  if (typeof obj.vi_gloss !== "string" || obj.vi_gloss.trim().length < 1) {
    softReason(reasons, REASON.BAD_VI_GLOSS, "sense.vi_gloss required", file, line);
  } else {
    const g = obj.vi_gloss.trim();
    if (hasInferenceMarkers(g)) softReason(reasons, REASON.INFERENCE_MARKER, "sense.vi_gloss contains inference marker(s)", file, line);
    if (hasMultiGlossSeparators(g)) softReason(reasons, REASON.MULTIGLOSS, "sense.vi_gloss contains multi-gloss separator(s)", file, line);
  }

  if (typeof obj.en_gloss !== "string" || obj.en_gloss.trim().length < 1) {
    softReason(reasons, REASON.SCHEMA, "en_gloss required (evidence trace anchor for sense)", file, line);
  }

  if (typeof obj.frame !== "string" || obj.frame !== "") {
    softReason(reasons, REASON.FRAME_SCOPE_LOCK, "sense.frame MUST be empty string in v0.1", file, line);
  }

  // trace required
  if (obj.trace === null || typeof obj.trace !== "object" || Array.isArray(obj.trace)) {
    softReason(reasons, REASON.SENSE_TRACE_MISSING, "trace must be object", file, line);
    return;
  }
  for (const f of ["source", "source_file_sha256", "record_sha256", "ref"]) {
    if (!(f in obj.trace) || typeof obj.trace[f] !== "string" || obj.trace[f].trim().length < 1) {
      softReason(reasons, REASON.SENSE_TRACE_MISSING, `trace.${f} required`, file, line);
    }
  }
  if ("source_file_sha256" in obj.trace && !/^[a-f0-9]{64}$/.test(obj.trace.source_file_sha256)) {
    softReason(reasons, REASON.SCHEMA, "trace.source_file_sha256 must be sha256 hex", file, line);
  }
  if ("record_sha256" in obj.trace && !/^[a-f0-9]{64}$/.test(obj.trace.record_sha256)) {
    softReason(reasons, REASON.SCHEMA, "trace.record_sha256 must be sha256 hex", file, line);
  }
}

function validateCollocEntry(row, reasons) {
  const { file, line, obj } = row;
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    softReason(reasons, REASON.SCHEMA, "Collocation entry must be an object", file, line);
    return;
  }
  const req = ["collocation_id", "lemma", "pos", "collocation", "frame"];
  for (const f of req) {
    if (!(f in obj)) {
      softReason(reasons, REASON.SCHEMA, `Missing required field '${f}'`, file, line);
      return;
    }
  }
  if (typeof obj.collocation_id !== "string" || obj.collocation_id.trim().length < 1) {
    softReason(reasons, REASON.SCHEMA, "collocation_id must be non-empty", file, line);
  }
  if (typeof obj.lemma !== "string" || !isLowerAlpha(obj.lemma)) {
    softReason(reasons, REASON.BAD_LEMMA, "colloc.lemma must be lowercase [a-z]+", file, line);
  }
  if (typeof obj.pos !== "string" || !POS_SET.has(obj.pos)) {
    softReason(reasons, REASON.BAD_POS, "colloc.pos invalid", file, line);
  }
  if (typeof obj.frame !== "string" || obj.frame !== "") {
    softReason(reasons, REASON.FRAME_SCOPE_LOCK, "colloc.frame MUST be empty string in v0.1", file, line);
  }
}

function isSortedLemmaRows(rows) {
  // sorted by lemma asc, pos asc (stable)
  let prev = null;
  for (const r of rows) {
    const o = r.obj;
    const key = `${o.lemma}\u0000${o.pos}`;
    if (prev !== null && key < prev) return false;
    prev = key;
  }
  return true;
}

function isSortedSenseRows(rows) {
  let prev = null;
  for (const r of rows) {
    const o = r.obj;
    const key = `${o.lemma}\u0000${o.pos}\u0000${o.sense_id}`;
    if (prev !== null && key < prev) return false;
    prev = key;
  }
  return true;
}

function computeArtifactSetHash(fileShaMap) {
  // fileShaMap: {filename: sha256hex}
  const lines = Object.keys(fileShaMap)
    .sort()
    .map(fn => `${fileShaMap[fn]}  ${fn}`);
  const setSha = sha256Hex(lines.join("\n") + "\n");
  return { setSha, lines };
}

function main(argv) {
  // CLI:
  //   node validators/lexicon_gate.js --lemmas lexicon/en_vi_lemmas.jsonl [--senses ...] [--collocations ...] [--frames ...] [--all] [--no-fail-fast]
  // Default: requires --lemmas.
  const args = parseArgs(argv);

  const lemmasPath = args.lemmas;
  if (!lemmasPath) {
    console.error("Usage: node validators/lexicon_gate.js --lemmas <lemmas.jsonl> [--senses <senses.jsonl>] [--collocations <collocations.jsonl>] [--frames <frames.json>] [--all] [--no-fail-fast]");
    process.exit(EXIT_SOFT);
  }

  const failFast = args.failFast;

  const reasons = [];
  const notes = [];

  // Load frames (optional)
  let frameSet = null;
  if (args.frames) {
    const framesRaw = readText(args.frames);
    let framesObj;
    try {
      framesObj = JSON.parse(framesRaw);
    } catch (e) {
      throw hard(`frames JSON parse error: ${e.message}`, REASON.JSON_PARSE, args.frames, 1);
    }
    if (framesObj && typeof framesObj === "object" && !Array.isArray(framesObj)) {
      frameSet = new Set(Object.keys(framesObj));
    } else {
      throw hard(`frames must be an object keyed by frame_id`, REASON.SCHEMA, args.frames, 1);
    }
  }

  // Load lemma rows
  const lemmaRows = loadJsonLines(lemmasPath);
  for (const row of lemmaRows) {
    validateLemmaEntry(row, reasons);
    if (failFast && reasons.length > 0) break;
  }

  // Duplicate lemma+pos
  const lemmaKeySet = new Set();
  let dupLemmaPos = 0;
  if (!(failFast && reasons.length > 0)) {
    for (const row of lemmaRows) {
      const o = row.obj;
      const key = `${o.lemma}|${o.pos}`;
      if (lemmaKeySet.has(key)) {
        dupLemmaPos++;
        softReason(reasons, REASON.DUP_LEMMA_POS, `Duplicate lemma+pos: ${key}`, row.file, row.line);
        if (failFast) break;
      }
      lemmaKeySet.add(key);
    }
  }

  // Sorted check
  const lemmasSorted = isSortedLemmaRows(lemmaRows);
  if (!lemmasSorted) softReason(reasons, REASON.UNSORTED, "Lemmas file must be sorted by (lemma asc, pos asc)", lemmasPath, 1);

  // Optional senses
  let senseRows = [];
  let dupSenseId = 0;
  let senseLemmaMissing = 0;
  let sensesSorted = true;

  if (args.senses) {
    senseRows = loadJsonLines(args.senses);
    for (const row of senseRows) {
      validateSenseEntry(row, reasons);
      if (failFast && reasons.length > 0) break;
    }
    if (!(failFast && reasons.length > 0)) {
      const senseIdSet = new Set();
      for (const row of senseRows) {
        const o = row.obj;
        if (senseIdSet.has(o.sense_id)) {
          dupSenseId++;
          softReason(reasons, REASON.DUP_SENSE_ID, `Duplicate sense_id: ${o.sense_id}`, row.file, row.line);
          if (failFast) break;
        }
        senseIdSet.add(o.sense_id);

        const lk = `${o.lemma}|${o.pos}`;
        if (!lemmaKeySet.has(lk)) {
          senseLemmaMissing++;
          softReason(reasons, REASON.SENSE_LEMMA_MISSING, `Sense references missing lemma+pos: ${lk}`, row.file, row.line);
          if (failFast) break;
        }
      }
    }
    sensesSorted = isSortedSenseRows(senseRows);
    if (!sensesSorted) softReason(reasons, REASON.UNSORTED, "Senses file must be sorted by (lemma,pos,sense_id)", args.senses, 1);
  }

  // Optional collocations
  let collocRows = [];
  let dupCollocId = 0;
  let collocLemmaMissing = 0;
  if (args.collocations) {
    collocRows = loadJsonLines(args.collocations);
    for (const row of collocRows) {
      validateCollocEntry(row, reasons);
      if (failFast && reasons.length > 0) break;
    }
    if (!(failFast && reasons.length > 0)) {
      const collocIdSet = new Set();
      for (const row of collocRows) {
        const o = row.obj;
        if (collocIdSet.has(o.collocation_id)) {
          dupCollocId++;
          softReason(reasons, REASON.DUP_COLLOC_ID, `Duplicate collocation_id: ${o.collocation_id}`, row.file, row.line);
          if (failFast) break;
        }
        collocIdSet.add(o.collocation_id);

        const lk = `${o.lemma}|${o.pos}`;
        if (!lemmaKeySet.has(lk)) {
          collocLemmaMissing++;
          softReason(reasons, REASON.COLLOC_LEMMA_MISSING, `Collocation references missing lemma+pos: ${lk}`, row.file, row.line);
          if (failFast) break;
        }
      }
    }
  }

  // Frame existence check: v0.1 scope-lock requires frame==""; if frames catalog exists, we only enforce "known frames" when frame non-empty.
  // Since frame must be "", frames_known is true iff no row violated that lock (already captured).
  const unknownFrames = 0;

  // Artifact hashes
  const fileShaMap = {};
  fileShaMap[lemmasPath] = sha256Hex(fs.readFileSync(lemmasPath));
  if (args.senses) fileShaMap[args.senses] = sha256Hex(fs.readFileSync(args.senses));
  if (args.collocations) fileShaMap[args.collocations] = sha256Hex(fs.readFileSync(args.collocations));
  if (args.frames) fileShaMap[args.frames] = sha256Hex(fs.readFileSync(args.frames));

  const { setSha, lines: manifestLines } = computeArtifactSetHash(fileShaMap);

  // Compute checks booleans (derived from reasons)
  const checks = {
    schema_pass: !reasons.some(r => r.code === REASON.SCHEMA || r.code === REASON.JSON_PARSE || r.code === REASON.FILE_NOT_FOUND || r.code === REASON.EMPTY_FILE),
    sorted: lemmasSorted && (args.senses ? sensesSorted : true),
    no_duplicates: (dupLemmaPos === 0) && (dupSenseId === 0) && (dupCollocId === 0),
    no_inference_markers: !reasons.some(r => r.code === REASON.INFERENCE_MARKER),
    no_multigloss: !reasons.some(r => r.code === REASON.MULTIGLOSS),
    no_sense_selection_without_trace: !reasons.some(r => r.code === REASON.SENSE_TRACE_MISSING),
    frame_scope_lock: !reasons.some(r => r.code === REASON.FRAME_SCOPE_LOCK),
    frames_known: !reasons.some(r => r.code === REASON.FRAME_UNKNOWN),
    crossref_sense_lemma: (senseLemmaMissing === 0),
    crossref_colloc_lemma: (collocLemmaMissing === 0)
  };

  // Verdict mapping (deterministic):
  // - REFUSE if schema_pass false OR frame_scope_lock false (policy hard)
  // - else INSUFFICIENT if any reasons exist
  // - else SUPPORTED
  let verdict = "SUPPORTED";
  let exitCode = EXIT_OK;

  if (!checks.schema_pass || !checks.frame_scope_lock) {
    verdict = "REFUSE";
    exitCode = EXIT_REFUSE;
  } else if (reasons.length > 0) {
    verdict = "INSUFFICIENT";
    exitCode = EXIT_SOFT;
  }

  // Assemble report (without report_hashes.canonical_sha256 first), then compute canonical_sha256 as specified.
  const report = {
    spec: "NTL_LEXICON_GATE_REPORT_v0_1",
    tool: TOOL,
    tool_version: VERSION,
    mode: args.modeLabel,
    verdict,
    exit_code: exitCode,
    fail_fast: failFast,
    files: {
      lemmas: lemmasPath,
      ...(args.senses ? { senses: args.senses } : {}),
      ...(args.collocations ? { collocations: args.collocations } : {}),
      ...(args.frames ? { frames: args.frames } : {})
    },
    artifact_hashes: {
      set_sha256: setSha,
      manifest_lines: manifestLines
    },
    report_hashes: {
      canonical_sha256: "",
      bytes_sha256_sidecar_required: true
    },
    checks,
    stats: {
      lemmas: lemmaRows.length,
      senses: senseRows.length,
      collocations: collocRows.length,
      dup_lemma_pos: dupLemmaPos,
      dup_sense_id: dupSenseId,
      dup_colloc_id: dupCollocId,
      unknown_frames: unknownFrames,
      sense_lemma_missing: senseLemmaMissing,
      colloc_lemma_missing: collocLemmaMissing
    },
    reasons,
    notes
  };

  const canonicalForHash = canonicalize(report);
  canonicalForHash.report_hashes.canonical_sha256 = "";
  const canonicalSha = sha256Hex(JSON.stringify(canonicalForHash));
  report.report_hashes.canonical_sha256 = canonicalSha;

  // Emit deterministic JSON
  process.stdout.write(JSON.stringify(canonicalize(report), null, 2) + "\n");
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = {
    lemmas: null,
    senses: null,
    collocations: null,
    frames: null,
    failFast: true,
    modeLabel: "--custom"
  };

  const args = argv.slice(2);
  if (args.includes("--all")) out.modeLabel = "--all";
  if (args.includes("--no-fail-fast")) out.failFast = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--lemmas") out.lemmas = args[++i];
    else if (a === "--senses") out.senses = args[++i];
    else if (a === "--collocations") out.collocations = args[++i];
    else if (a === "--frames") out.frames = args[++i];
  }
  if (out.modeLabel === "--all" && !out.lemmas) out.lemmas = "lexicon/en_vi_lemmas.jsonl";
  return out;
}

if (require.main === module) {
  try {
    main(process.argv);
  } catch (e) {
    // Hard fail only: deterministic REFUSE
    const meta = e && e._gate ? e._gate : { severity: "REFUSE", code: REASON.SCHEMA, file: "unknown", line: 1 };
    const report = {
      spec: "NTL_LEXICON_GATE_REPORT_v0_1",
      tool: TOOL,
      tool_version: VERSION,
      mode: "--exception",
      verdict: "REFUSE",
      exit_code: EXIT_REFUSE,
      fail_fast: true,
      files: { lemmas: "UNKNOWN" },
      artifact_hashes: { set_sha256: sha256Hex(""), manifest_lines: [] },
      report_hashes: { canonical_sha256: sha256Hex(""), bytes_sha256_sidecar_required: true },
      checks: {
        schema_pass: false,
        sorted: false,
        no_duplicates: false,
        no_inference_markers: false,
        no_multigloss: false,
        no_sense_selection_without_trace: false,
        frame_scope_lock: false,
        frames_known: false,
        crossref_sense_lemma: false,
        crossref_colloc_lemma: false
      },
      stats: {
        lemmas: 0, senses: 0, collocations: 0,
        dup_lemma_pos: 0, dup_sense_id: 0, dup_colloc_id: 0,
        unknown_frames: 0, sense_lemma_missing: 0, colloc_lemma_missing: 0
      },
      reasons: [{ code: meta.code, message: String(e.message || e), file: meta.file, line: meta.line }],
      notes: []
    };
    const canonicalForHash = canonicalize(report);
    canonicalForHash.report_hashes.canonical_sha256 = "";
    report.report_hashes.canonical_sha256 = sha256Hex(JSON.stringify(canonicalForHash));
    process.stdout.write(JSON.stringify(canonicalize(report), null, 2) + "\n");
    process.exit(EXIT_REFUSE);
  }
}
