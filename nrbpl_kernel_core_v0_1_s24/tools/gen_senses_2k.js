#!/usr/bin/env node
/**
 * tools/gen_senses_2k.js — NTL Sense 2K Generator v0.1
 *
 * Deterministic, evidence-first:
 * - Requires lemmas file (2k)
 * - For each lemma|pos:
 *   - Prefer Oxford senses; else WordNet senses
 *   - Take 1..MAX senses (default 3), MUST have trace fields
 * - No empty trace; no empty en_gloss; no inference markers; no multi-gloss separators
 * - sense_id canonical: `${lemma}.${pos}.${NN}` where NN=01..03 (or up to max)
 * - Output sorted by (lemma,pos,sense_id)
 *
 * Required sense source record schema (JSONL):
 *   {
 *     "lemma":"run",
 *     "pos":"v",
 *     "rank":1,
 *     "en_gloss":"move fast on foot",
 *     "vi_gloss":"chạy",
 *     "ref":"oxford3000:run_v_1"
 *   }
 *
 * Trace derivation:
 * - source_file_sha256 = sha256(source_file_bytes)
 * - record_sha256 = sha256(canonical_json(source_record_object))
 *
 * Usage:
 *   node tools/gen_senses_2k.js --max 3
 */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const SOURCES = path.join(ROOT, "sources");
const LEXICON = path.join(ROOT, "lexicon");

const DEFAULT_LEMMAS = path.join(LEXICON, "en_vi_lemmas_2k.jsonl");
const DEFAULT_OXF_SENSES = path.join(SOURCES, "oxford3000_senses.jsonl");
const DEFAULT_WN_SENSES = path.join(SOURCES, "wordnet_senses.jsonl");
const DEFAULT_OUT = path.join(LEXICON, "en_vi_senses_2k.jsonl");

const POS_SET = new Set(["n", "v", "adj", "adv", "prep", "conj", "det", "pron", "num", "interj"]);

function sha256Hex(bufOrStr) {
  return crypto.createHash("sha256").update(bufOrStr).digest("hex");
}

function die(msg) {
  console.error(msg);
  process.exit(3);
}

// Canonical JSON: recursive key sort, JSON.stringify no spacing
function canonicalize(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const keys = Object.keys(value).sort();
  const obj = {};
  for (const k of keys) obj[k] = canonicalize(value[k]);
  return obj;
}

function readText(fp) {
  if (!fs.existsSync(fp)) die(`REFUSE: file not found: ${fp}`);
  const raw = fs.readFileSync(fp, "utf8");
  if (!raw.trim()) die(`REFUSE: empty file: ${fp}`);
  return raw;
}

function loadJsonLines(fp) {
  const raw = readText(fp);
  const lines = raw.split("\n").filter(l => l.trim().length > 0);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = i + 1;
    try {
      out.push({ line: ln, obj: JSON.parse(lines[i]) });
    } catch (e) {
      die(`REFUSE: JSON parse error at ${fp}:${ln}: ${e.message}`);
    }
  }
  return out;
}

function isLowerAlpha(s) {
  return /^[a-z]+$/.test(s);
}

function hasInferenceMarkers(s) {
  return /(\?\?|\btbd\b|\bunknown\b|\bmaybe\b|\bprobably\b|\bapprox\b|~)/i.test(s);
}

function hasMultiGlossSeparators(s) {
  return /[;|\/\\]/.test(s) || /\s,\s/.test(s) || /\s-\s/.test(s);
}

function validateLemmaRow(fp, row) {
  const o = row.obj;
  for (const f of ["lemma", "pos", "vi_gloss", "frame"]) {
    if (!(f in o)) die(`REFUSE: ${fp}:${row.line}: missing '${f}'`);
  }
  if (typeof o.lemma !== "string" || !isLowerAlpha(o.lemma.trim())) die(`REFUSE: ${fp}:${row.line}: lemma invalid`);
  if (typeof o.pos !== "string" || !POS_SET.has(o.pos.trim())) die(`REFUSE: ${fp}:${row.line}: pos invalid`);
  if (typeof o.vi_gloss !== "string" || !o.vi_gloss.trim()) die(`REFUSE: ${fp}:${row.line}: vi_gloss required`);
  if (typeof o.frame !== "string" || o.frame !== "") die(`REFUSE: ${fp}:${row.line}: frame must be "" in v0.1`);
  return { lemma: o.lemma.trim(), pos: o.pos.trim(), vi_gloss: o.vi_gloss.trim() };
}

function validateSenseSourceRow(fp, row) {
  const o = row.obj;
  // required: lemma,pos,rank,en_gloss,vi_gloss,ref
  for (const f of ["lemma", "pos", "rank", "en_gloss", "vi_gloss", "ref"]) {
    if (!(f in o)) die(`REFUSE: ${fp}:${row.line}: missing '${f}'`);
  }
  if (typeof o.lemma !== "string" || !isLowerAlpha(o.lemma.trim())) die(`REFUSE: ${fp}:${row.line}: lemma invalid`);
  if (typeof o.pos !== "string" || !POS_SET.has(o.pos.trim())) die(`REFUSE: ${fp}:${row.line}: pos invalid`);
  if (!Number.isInteger(o.rank) || o.rank < 1) die(`REFUSE: ${fp}:${row.line}: rank must be integer >=1`);
  if (typeof o.en_gloss !== "string" || !o.en_gloss.trim()) die(`REFUSE: ${fp}:${row.line}: en_gloss required`);
  if (typeof o.vi_gloss !== "string" || !o.vi_gloss.trim()) die(`REFUSE: ${fp}:${row.line}: vi_gloss required`);

  const eg = o.en_gloss.trim();
  const vg = o.vi_gloss.trim();
  if (hasInferenceMarkers(eg) || hasInferenceMarkers(vg)) die(`REFUSE: ${fp}:${row.line}: inference markers forbidden`);
  if (hasMultiGlossSeparators(eg) || hasMultiGlossSeparators(vg)) die(`REFUSE: ${fp}:${row.line}: multi-gloss separators forbidden`);

  if (typeof o.ref !== "string" || !o.ref.trim()) die(`REFUSE: ${fp}:${row.line}: ref required`);
  return {
    lemma: o.lemma.trim(),
    pos: o.pos.trim(),
    rank: o.rank,
    en_gloss: eg,
    vi_gloss: vg,
    ref: o.ref.trim(),
    _record_sha256: sha256Hex(JSON.stringify(canonicalize(o)))
  };
}

function pad2(n) {
  const s = String(n);
  return s.length === 1 ? "0" + s : s;
}

function main(argv) {
  const args = parseArgs(argv);

  const lemmasFp = args.lemmas;
  const oxFp = args.oxford;
  const wnFp = args.wordnet;
  const outFp = args.out;
  const MAX = args.max;

  const lemRows = loadJsonLines(lemmasFp);
  const lemmas = lemRows.map(r => validateLemmaRow(lemmasFp, r));

  const oxBytes = fs.readFileSync(oxFp);
  const wnBytes = fs.readFileSync(wnFp);
  const oxFileSha = sha256Hex(oxBytes);
  const wnFileSha = sha256Hex(wnBytes);

  const oxRows = loadJsonLines(oxFp).map(r => validateSenseSourceRow(oxFp, r));
  const wnRows = loadJsonLines(wnFp).map(r => validateSenseSourceRow(wnFp, r));

  // Group by lemma|pos, deterministic order by rank then ref
  function group(rows) {
    const m = new Map();
    for (const s of rows) {
      const k = `${s.lemma}|${s.pos}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(s);
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => (a.rank - b.rank) || a.ref.localeCompare(b.ref));
      m.set(k, arr);
    }
    return m;
  }

  const oxMap = group(oxRows);
  const wnMap = group(wnRows);

  const out = [];
  for (const le of lemmas) {
    const k = `${le.lemma}|${le.pos}`;
    let src = "oxford3000";
    let fileSha = oxFileSha;
    let arr = oxMap.get(k) || [];
    if (arr.length === 0) {
      src = "wordnet";
      fileSha = wnFileSha;
      arr = wnMap.get(k) || [];
    }
    if (arr.length === 0) {
      // Evidence-first: if no senses available for lemma, REFUSE (no inference).
      die(`REFUSE: no sense source records for lemma|pos: ${k}`);
    }

    const take = Math.min(MAX, arr.length);
    for (let i = 1; i <= take; i++) {
      const s = arr[i - 1];
      out.push({
        sense_id: `${le.lemma}.${le.pos}.${pad2(i)}`,
        lemma: le.lemma,
        pos: le.pos,
        vi_gloss: s.vi_gloss,
        en_gloss: s.en_gloss,
        frame: "",
        trace: {
          source: src,
          source_file_sha256: fileSha,
          record_sha256: s._record_sha256,
          ref: s.ref
        }
      });
    }
  }

  // Sort by lemma,pos,sense_id
  out.sort((a, b) => a.lemma.localeCompare(b.lemma) || a.pos.localeCompare(b.pos) || a.sense_id.localeCompare(b.sense_id));

  fs.mkdirSync(path.dirname(outFp), { recursive: true });
  fs.writeFileSync(outFp, out.map(x => JSON.stringify(x)).join("\n") + "\n");

  const outSha = sha256Hex(fs.readFileSync(outFp));
  const lemSha = sha256Hex(fs.readFileSync(lemmasFp));

  const report = {
    spec: "NTL_SENSES_2K_BUILD_REPORT_v0_1",
    tool: "tools/gen_senses_2k.js",
    tool_version: "0.1.0",
    inputs: {
      lemmas: { path: path.relative(ROOT, lemmasFp), sha256: lemSha },
      oxford3000_senses: { path: path.relative(ROOT, oxFp), sha256: oxFileSha },
      wordnet_senses: { path: path.relative(ROOT, wnFp), sha256: wnFileSha }
    },
    policy: { prefer: "oxford3000", max_senses_per_lemma: MAX, missing_sense_source: "REFUSE" },
    output: { path: path.relative(ROOT, outFp), senses: out.length, sha256: outSha }
  };

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  process.exit(0);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { lemmas: DEFAULT_LEMMAS, oxford: DEFAULT_OXF_SENSES, wordnet: DEFAULT_WN_SENSES, out: DEFAULT_OUT, max: 3 };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--lemmas") out.lemmas = args[++i];
    else if (a === "--oxford") out.oxford = args[++i];
    else if (a === "--wordnet") out.wordnet = args[++i];
    else if (a === "--out") out.out = args[++i];
    else if (a === "--max") out.max = parseInt(args[++i], 10);
  }
  if (!Number.isFinite(out.max) || out.max < 1 || out.max > 9) die("REFUSE: --max must be integer 1..9");
  return out;
}

if (require.main === module) main(process.argv);
